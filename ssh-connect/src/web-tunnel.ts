import { closeMainWindow, environment, open, showToast, Toast } from "@raycast/api";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WebPage {
  id: string;
  name: string;
  host: string;
  sshPort?: number;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  // Close the tunnel after this many minutes without connections; 0 keeps it open.
  idleMinutes: number;
}

const STORE = path.join(environment.supportPath, "web-pages.json");

export function loadWebPages(): WebPage[] {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
}

export function saveWebPages(pages: WebPage[]): void {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(pages, null, 2) + "\n");
}

export function pageUrl(p: WebPage): string {
  return `http://localhost:${p.localPort}`;
}

export function sshArgs(p: WebPage): string[] {
  return [
    "-N",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "BatchMode=yes",
    "-o",
    "ServerAliveInterval=30",
    "-L",
    `${p.localPort}:${p.remoteHost}:${p.remotePort}`,
    ...(p.sshPort ? ["-p", String(p.sshPort)] : []),
    p.host,
  ];
}

// The process listening on a local port, if any.
export async function listener(port: number): Promise<{ pid: number; command: string } | undefined> {
  try {
    const { stdout } = await execFileAsync("/usr/sbin/lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"]);
    const pid = stdout.match(/^p(\d+)/m);
    const command = stdout.match(/^c(.*)/m);
    return pid ? { pid: Number(pid[1]), command: command?.[1] ?? "" } : undefined;
  } catch {
    return undefined; // lsof exits 1 when nothing matches
  }
}

// Runs ssh and, when an idle limit is set, kills it once the forwarded port has had
// no established connections for that long. Args: port, idle seconds, log file, ssh args...
const TUNNEL_SCRIPT = `
port=$1; idle_limit=$2; log=$3; shift 3
/usr/bin/ssh "$@" 2>"$log" &
pid=$!
if [ "$idle_limit" -gt 0 ]; then
  (
    idle=0
    while sleep 15; do
      if /usr/sbin/lsof -nP -a -p $pid -iTCP:$port -sTCP:ESTABLISHED >/dev/null 2>&1; then
        idle=0
      else
        idle=$((idle + 15))
        [ $idle -ge $idle_limit ] && { kill $pid; exit; }
      fi
    done
  ) &
  monitor=$!
fi
wait $pid
status=$?
[ -n "$monitor" ] && kill $monitor 2>/dev/null
exit $status
`;

// Starts the tunnel in a detached process that outlives Raycast, and resolves once the
// local port is listening. Rejects with ssh's stderr if ssh exits first.
export async function startTunnel(p: WebPage, timeoutMs = 20000): Promise<void> {
  const log = path.join(environment.supportPath, `tunnel-${p.id}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const child = spawn(
    "/bin/bash",
    ["-c", TUNNEL_SCRIPT, "ssh-web-tunnel", String(p.localPort), String(p.idleMinutes * 60), log, ...sshArgs(p)],
    { detached: true, stdio: "ignore" },
  );

  let exited = false;
  child.on("exit", () => (exited = true));
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      if (exited) {
        const err = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim() : "";
        throw new Error(err.split("\n").pop() || "ssh exited");
      }
      if (await listener(p.localPort)) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    child.kill();
    throw new Error("Timed out waiting for the tunnel");
  } finally {
    child.unref();
  }
}

// Stops the tunnel on the page's local port; refuses to kill anything that isn't ssh.
export async function stopTunnel(p: WebPage): Promise<boolean> {
  const l = await listener(p.localPort);
  if (!l || l.command !== "ssh") return false;
  process.kill(l.pid);
  return true;
}

// Opens the page, starting its tunnel first unless one is already listening.
export async function openWebPage(p: WebPage): Promise<void> {
  const l = await listener(p.localPort);
  if (l && l.command !== "ssh") {
    await showToast({
      style: Toast.Style.Failure,
      title: `Port ${p.localPort} is in use`,
      message: `${l.command} (pid ${l.pid}) is listening on it`,
    });
    return;
  }
  if (!l) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Opening tunnel to ${p.host}…` });
    try {
      await startTunnel(p);
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Tunnel failed";
      toast.message = e instanceof Error ? e.message : String(e);
      return;
    }
    await toast.hide();
  }
  await open(pageUrl(p));
  await closeMainWindow();
}
