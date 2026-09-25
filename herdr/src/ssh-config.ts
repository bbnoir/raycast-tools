import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface SshHost {
  alias: string;
  hostName?: string;
  user?: string;
  port?: string;
}

export function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

// Minimal ssh_config parser: collects concrete Host aliases (skips wildcards/negations)
// and follows simple Include directives (with * globs in the file name).
export function parseSshConfig(file: string, seen = new Set<string>()): SshHost[] {
  const resolved = expandHome(file);
  if (seen.has(resolved) || !fs.existsSync(resolved)) return [];
  seen.add(resolved);

  const hosts: SshHost[] = [];
  let current: SshHost[] = [];

  for (const raw of fs.readFileSync(resolved, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(\S+?)\s*[=\s]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].replace(/^"|"$/g, "");

    if (key === "host") {
      current = value
        .split(/\s+/)
        .filter((a) => !/[*?!]/.test(a))
        .map((alias) => ({ alias }));
      hosts.push(...current);
    } else if (key === "match") {
      current = [];
    } else if (key === "include") {
      for (const inc of value.split(/\s+/)) {
        const incPath = path.isAbsolute(expandHome(inc)) ? expandHome(inc) : path.join(os.homedir(), ".ssh", inc);
        for (const f of globFiles(incPath)) hosts.push(...parseSshConfig(f, seen));
      }
    } else {
      for (const h of current) {
        if (key === "hostname") h.hostName ??= value;
        else if (key === "user") h.user ??= value;
        else if (key === "port") h.port ??= value;
      }
    }
  }
  return hosts;
}

function globFiles(p: string): string[] {
  if (!p.includes("*")) return [p];
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp(
    "^" +
      path
        .basename(p)
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") +
      "$",
  );
  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}
