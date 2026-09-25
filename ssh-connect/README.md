# SSH Connect

A Raycast extension that lists the hosts in your `~/.ssh/config` and opens an SSH session in one keystroke.

## Features

- Reads hosts directly from `~/.ssh/config` (follows `Include`, skips wildcard patterns), so there is nothing to maintain separately
- Opens sessions in **WezTerm** (`wezterm ssh <host>`, default) or **Terminal.app** (`ssh <host>`)
- **Pinned** hosts stay on top in the order you choose, followed by **Recent** hosts (most recent first), then everything else
- Search by alias, hostname, or user

> Tip: to have Raycast return to the root search right after connecting, set **Settings → Advanced → Pop to Root Search** to **Immediately**.

## SSH Web Pages

The **SSH Web Pages** command keeps a list of web pages served on SSH hosts (dashboards, notebooks, …). Opening one starts `ssh -N -L <local>:<remote host>:<remote port> <host>` in the background, then opens `http://localhost:<local>` in your browser. If the tunnel is already up, it just opens the page.

Each page has:

- **Name**
- **SSH host** (from your ssh config) and an optional **SSH port** override
- **Tunnel**: local port → remote host and port (as seen from the SSH server)
- **Auto-close**: the tunnel closes after this many minutes with no connections through it (checked every 15 s; `0` keeps it open). Closing the browser tab drops its connections, so the idle timer starts then.

Other actions: **Close Tunnel** (`⌘⇧W`), **Create Quicklink** (open a page straight from Raycast root search), copy the URL or the `ssh` command, edit (`⌘E`) and delete (`⌃X`). Pages are stored in `web-pages.json` in the extension's support directory.

Tunnels use `BatchMode=yes`, so the host must log in with a key (or ssh-agent); there is no password prompt.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Connect | `↵` |
| Pin / Unpin | `⌘⇧P` |
| Move pinned host up / down | `⌥⌘↑` / `⌥⌘↓` |
| Remove from Recent | `⌃X` |
| Copy SSH command | from the `⌘K` menu |

## Preferences

| Preference | Default | Description |
| --- | --- | --- |
| Terminal | WezTerm | `WezTerm` or `Terminal.app` |
| SSH Config Path | `~/.ssh/config` | Config file to read hosts from |

## Notes

- `wezterm ssh` uses WezTerm's built-in SSH client, which supports only a subset of `ssh_config` options. If a host relies on something it doesn't handle (e.g. some `ProxyJump` / `ProxyCommand` setups), switch the Terminal preference to `Terminal.app`, which uses the system `ssh`.
- With WezTerm, each connection starts a new WezTerm instance (`open -n`) so that the new window comes to the front.
- The first connection via Terminal.app will ask for permission for Raycast to control Terminal.

## Install

```bash
cd ssh-connect
npm install
npm run dev
```

`npm run dev` imports the extension into Raycast. It stays installed after you stop the dev server.

## Credits

Icon glyph: [Lucide](https://lucide.dev) `key-round`, ISC License.
