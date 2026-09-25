import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type TerminalApp = "wezterm" | "terminal";

export async function openSsh(alias: string, terminal: TerminalApp): Promise<void> {
  if (terminal === "wezterm") {
    // Launch via LaunchServices so the new WezTerm instance is activated and focused;
    // spawning the binary directly from Raycast leaves the window in the background.
    await execFileAsync("open", ["-n", "-a", "WezTerm", "--args", "ssh", alias]);
  } else {
    const cmd = `ssh ${alias}`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await execFileAsync("osascript", [
      "-e",
      `tell application "Terminal"`,
      "-e",
      `do script "${cmd}"`,
      "-e",
      "activate",
      "-e",
      "end tell",
    ]);
  }
}
