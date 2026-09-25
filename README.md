# Raycast Tools

A collection of small personal [Raycast](https://www.raycast.com) extensions.

| Extension | Description |
| --- | --- |
| [SSH Connect](ssh-connect) | Search hosts from `~/.ssh/config` and connect in WezTerm or Terminal.app, with pinned and recent hosts |

## Installing an extension

These extensions are not published to the Raycast Store. To install one:

```bash
git clone https://github.com/bbnoir/raycast-tools.git
cd raycast-tools/<extension>
npm install
npm run dev
```

`npm run dev` imports the extension into Raycast; it stays installed after you stop the dev server.

## License

[MIT](LICENSE)
