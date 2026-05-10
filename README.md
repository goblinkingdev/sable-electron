# sable-electron

Unofficial [Electron](https://www.electronjs.org/) wrapper for [Sable](https://github.com/SableClient/Sable) — an almost stable Matrix client.

Bundles the Sable web app and serves it over a local HTTP server, giving you a native desktop window with no browser chrome and no external server required.

> **Unofficial.** This project is not affiliated with the Sable authors. All credit goes to the [SableClient](https://github.com/SableClient) team.

---

## Download

Pre-built binaries are available on the [Releases](https://github.com/GoblinKingDev/sable-electron/releases) page.

| Platform | Format |
|----------|--------|
| Linux x64 / arm64 | `.AppImage`, `.deb`, `.rpm` |
| Windows x64 / arm64 | `.exe` (NSIS installer) |
| macOS x64 / arm64 | `.dmg` |

### Linux (AppImage)

```sh
chmod +x Sable-*.AppImage
./Sable-*.AppImage
```

### Windows

Run the `.exe` installer. You can choose the install directory during setup.

### macOS

Open the `.dmg`, drag Sable to Applications. If macOS blocks the app on first launch (unsigned build), right-click → Open.

---

## NixOS

Install directly from the flake without cloning:

```sh
nix run github:GoblinKingDev/sable-electron
```

Or add it to your system packages in `flake.nix`:

```nix
inputs.sable-electron.url = "github:GoblinKingDev/sable-electron";

# then in your packages:
inputs.sable-electron.packages.${system}.default
```

---

## Building from source

### Requirements

- Node.js 24
- pnpm 10
- Git

```sh
git clone --recurse-submodules https://github.com/GoblinKingDev/sable-electron
cd sable-electron
npm install
npm run build:sable
npm run dev
```

To produce distributable packages:

```sh
npm run dist:linux   # AppImage + deb + rpm
npm run dist:win     # .exe (requires Wine on Linux)
npm run dist:mac     # .dmg (macOS only)
```

### NixOS / Nix

The repo ships a `flake.nix` with a full dev shell that handles everything — patchelf, library paths, build tools.

```sh
git clone --recurse-submodules https://github.com/GoblinKingDev/sable-electron
cd sable-electron
nix develop
npm install
npm run build:sable
npm run dev
```

---

## Updating Sable

```sh
git -C sable pull origin dev
git add sable
git commit -m "chore: bump sable submodule"
```

Tag a new release to publish updated binaries.

---

## Why Electron and not a PWA?

Sable works as a PWA, but browser-based PWAs come with limitations: no taskbar presence, browser UI chrome, permissions prompts, and varying service worker behaviour across browsers. Electron gives a consistent, native-feeling window across all platforms with a single distributable.

### What about Android / iOS?

Electron does not support mobile platforms. Maybe I'll make a separate project using [Capacitor](https://capacitorjs.com/).

---

## Project structure

```
sable-electron/
├── electron/
│   ├── main.ts          — main process + embedded HTTP server
│   └── preload.ts       — context bridge
├── sable/               — git submodule (SableClient/Sable @ dev)
├── resources/           — app icons (see contributing)
├── .github/workflows/
│   ├── ci.yml           — build check on push / PR
│   └── release.yml      — build + publish on version tag
├── electron-builder.yml
├── flake.nix
├── package.json
└── tsconfig.json
```

---

## Contributing

Pull requests are welcome. A few notes:

- **Bugs** — if the app itself misbehaves, check whether it also happens on [app.sable.chat](https://app.sable.chat) first. If it does, report it upstream to [SableClient/Sable](https://github.com/SableClient/Sable). If it only happens in this wrapper, open an issue here.
- **Platforms** — tested on NixOS / Sway (Wayland) with an old machine. Reports and fixes for Windows and macOS are welcome.

---

## License

[AGPL-3.0-only](LICENSE) — same as Sable.
