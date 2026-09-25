# Herdr

A Raycast extension that opens [Herdr](https://herdr.dev) in WezTerm, either the local one or a remote one over SSH. Everything else is done inside Herdr.

## Features

- **Open Herdr** lists **Local** and every host in `~/.ssh/config` (follows `Include`, skips wildcard patterns)
- **Pinned** machines stay on top in the order you choose, followed by **Recent** machines (most recent first), then everything else, so `↵` opens the first pinned one
- Local runs `herdr`; a host runs `herdr --remote <host> --session <hostname>`
- If that Herdr is already attached in a WezTerm pane, the pane is focused instead of opening a second client

## Remote sessions

Hosts that share an NFS home also share `~/.config/herdr`, so their default sessions would overwrite each other's socket and `session.json`. Each host therefore gets its own named session, named after its short hostname (`ssh <host> hostname -s`, e.g. `eda42`). The name is looked up on first open and cached; **Forget Session Name** looks it up again next time.

The lookup uses `BatchMode=yes`, so the host must log in with a key (or ssh-agent), which `herdr --remote` needs as well. The first open of a host may ask in the terminal to install or start the remote Herdr server.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Open Herdr (focus if already open) | `↵` |
| Open in a new window | `⌘↵` |
| Pin / Unpin | `⌘⇧P` |
| Move pinned machine up / down | `⌥⌘↑` / `⌥⌘↓` |
| Remove from Recent | `⌃X` |
| Copy Herdr command, Forget Session Name | from the `⌘K` menu |

## Preferences

| Preference | Default | Description |
| --- | --- | --- |
| Herdr Binary | auto-detect | Local `herdr` path; empty looks in `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin` |
| SSH Config Path | `~/.ssh/config` | Config file to read hosts from |

## Notes

- Focusing and spawning use `wezterm cli`, which talks to one WezTerm instance. Panes in other instances (e.g. ones opened with `open -n`) are not found, so a new window is opened there instead.
- When WezTerm is not running, it is started with `wezterm start -- herdr ...`.

## Install

```bash
cd herdr
npm install
npm run dev
```

`npm run dev` imports the extension into Raycast. It stays installed after you stop the dev server.

## Credits

Icon from [vlades/herdr](https://github.com/raycast/extensions/tree/main/extensions/herdr) (MIT, © 2026 Vlad).
