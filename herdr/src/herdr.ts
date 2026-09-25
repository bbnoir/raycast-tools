import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { expandHome } from "./ssh-config";

const execFileAsync = promisify(execFile);

// A Herdr to open: the local one (no alias), or a named session on an SSH host.
export interface Target {
  alias?: string;
  session?: string;
}

const HERDR_CANDIDATES = ["~/.local/bin/herdr", "/opt/homebrew/bin/herdr", "/usr/local/bin/herdr"];
const WEZTERM_CANDIDATES = [
  "/Applications/WezTerm.app/Contents/MacOS/wezterm",
  "~/Applications/WezTerm.app/Contents/MacOS/wezterm",
  "/opt/homebrew/bin/wezterm",
  "/usr/local/bin/wezterm",
];
const WEZTERM_BUNDLE_ID = "com.github.wez.wezterm";

function findExecutable(candidates: string[]): string | undefined {
  return candidates.map(expandHome).find((p) => {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

export function resolveHerdrBinary(preference?: string): string {
  const binary = findExecutable(preference?.trim() ? [preference.trim()] : HERDR_CANDIDATES);
  if (!binary) throw new Error(preference?.trim() ? `${preference} is not executable` : "herdr not found");
  return binary;
}

export function herdrArgs(target: Target): string[] {
  return target.alias ? ["--remote", target.alias, "--session", target.session ?? "default"] : [];
}

// Hosts on a shared (NFS) home also share ~/.config/herdr, so each host gets its own
// session, named after its short hostname (e.g. eda42).
export async function remoteSessionName(alias: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", alias, "hostname -s"],
    { timeout: 10_000 },
  );
  const name = stdout.trim().split("\n").pop()?.trim();
  if (!name) throw new Error(`${alias} returned no hostname`);
  return name;
}

// ttys of Herdr clients attached to `target`, from `ps -axo tty=,args=`. Clients look like
// `herdr [--session S]` locally and `herdr --remote HOST --session S` for a remote server;
// anything with a subcommand (`herdr server`, `herdr api ...`) is not a client.
export function findClientTtys(ps: string, target: Target): string[] {
  const ttys: string[] = [];
  for (const line of ps.split("\n")) {
    const [tty, cmd, ...args] = line.trim().split(/\s+/);
    if (!cmd || tty === "??" || path.basename(cmd) !== "herdr") continue;
    const flags: Record<string, string> = {};
    let isClient = true;
    for (let i = 0; i < args.length && isClient; i++) {
      if (["--remote", "--session", "--remote-keybindings"].includes(args[i])) flags[args[i]] = args[++i];
      else if (args[i] !== "--handoff") isClient = false;
    }
    if (!isClient || flags["--remote"] !== target.alias) continue;
    if ((flags["--session"] ?? "default") === (target.session ?? "default")) ttys.push(`/dev/${tty}`);
  }
  return ttys;
}

interface WezTermPane {
  pane_id: number;
  tty_name?: string;
}

async function listWezTermPanes(wezterm: string): Promise<WezTermPane[] | undefined> {
  try {
    const { stdout } = await execFileAsync(wezterm, ["cli", "list", "--format", "json"], { timeout: 3_000 });
    return JSON.parse(stdout) as WezTermPane[];
  } catch {
    return undefined; // WezTerm is not running
  }
}

// Focuses the WezTerm pane already attached to `target`, or opens a new WezTerm window for it.
export async function openHerdr(
  binary: string,
  target: Target,
  { newWindow = false } = {},
): Promise<"focused" | "opened"> {
  const wezterm = findExecutable(WEZTERM_CANDIDATES);
  if (!wezterm) throw new Error("WezTerm not found");
  const command = [binary, ...herdrArgs(target)];

  const panes = await listWezTermPanes(wezterm);
  if (!panes) {
    // Launch via LaunchServices so the new WezTerm instance is activated and focused;
    // spawning the binary directly from Raycast leaves the window in the background.
    await execFileAsync("open", ["-n", "-b", WEZTERM_BUNDLE_ID, "--args", "start", "--", ...command]);
    return "opened";
  }

  let result: "focused" | "opened" = "opened";
  const { stdout: ps } = await execFileAsync("ps", ["-axo", "tty=,args="]);
  const ttys = findClientTtys(ps, target);
  const existing = newWindow ? undefined : panes.find((p) => p.tty_name && ttys.includes(p.tty_name));
  if (existing) {
    await execFileAsync(wezterm, ["cli", "activate-pane", "--pane-id", String(existing.pane_id)]);
    result = "focused";
  } else {
    await execFileAsync(wezterm, ["cli", "spawn", "--new-window", "--", ...command]);
  }
  await execFileAsync("open", ["-b", WEZTERM_BUNDLE_ID]);
  return result;
}
