# SSH Connect

A Raycast extension that lists the hosts in your `~/.ssh/config` and opens an SSH session in one keystroke.

## Features

- Reads hosts directly from `~/.ssh/config` (follows `Include`, skips wildcard patterns), so there is nothing to maintain separately
- Opens sessions in **WezTerm** (`wezterm ssh <host>`, default) or **Terminal.app** (`ssh <host>`)
- **Pinned** hosts stay on top in the order you choose, followed by **Recent** hosts (most recent first), then everything else
- Search by alias, hostname, or user
- Returns Raycast to the root search after connecting

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
