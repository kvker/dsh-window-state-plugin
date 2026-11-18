[Chinese](README.md) | English

# dsh-window-state-plugin

[![CI](https://github.com/kvker/dsh-window-state-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/kvker/dsh-window-state-plugin/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-window-state-plugin.svg)](https://www.npmjs.com/package/dsh-window-state-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) desktop plugin that remembers the last window
position and size, so the app stops resetting to the default 1280×820 on every launch.

## Why a plugin is needed

The desktop window is created by the Electron main process (`apps/desktop/src/main.ts` → `createWindow()`, hard-coded
`1280×820`, no state persistence), while DSH plugins run in a separate host process and cannot touch `BrowserWindow`.

DSH's web server does expose a supported extension seam, `webserver/index-inject`: at startup the desktop shell collects
injection rows and hands them to the renderer through the boot payload, which executes them as `<script>` elements (the
same path used by the theme and shortcut configuration). This plugin injects a small script that restores and records
the window rectangle with `window.moveTo()` / `window.resizeTo()`.

## Behavior

- On boot: read the saved rectangle → `resizeTo(width, height)` + `moveTo(x, y)`.
- Afterwards: write the current rectangle to `localStorage` once per second, and on `pagehide` / `beforeunload`.
- Maximized/fullscreen windows never overwrite the saved normal bounds.
- On a single-display setup the rectangle is clamped into the current screen work area, so a stale off-screen position
  cannot hide the window.
- Only runs inside the desktop shell (`dsh-app://`); a Web UI opened in a normal browser is left alone.

## Install

Requires the DeepSeek Harness desktop app (which ships the `dsh` CLI).

```sh
# from npm (recommended)
dsh plugin --profile desktop add dsh-window-state-plugin

# or straight from GitHub (newest commit, no release wait)
dsh plugin --profile desktop add github:kvker/dsh-window-state-plugin
```

The package declares `dsh.bundle.patch`, so the CLI adds it as a bundle layer and enables it.
**Restart DSH once after installing** — injection rows are collected only at startup.

Uninstall:

```sh
dsh plugin --profile desktop remove dsh-window-state-plugin
```

## Usage

1. After restarting, move the window where you want it and resize it.
2. Quit DSH normally.
3. Reopen it — the window comes back at that position and size.

The first launch has nothing saved yet, so it keeps the default geometry.

## Configuration

Override any default in `~/.dsh/profiles/desktop/cordis.patch.yml` by row id (`window-state`):

```yaml
- id: window-state
  config:
    storageKey: 'dsh-window-state:v1'
    minWidth: 520
    minHeight: 600
    saveIntervalMs: 1000
    restoreDelayMs: 400
```

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch. |
| `storageKey` | `dsh-window-state:v1` | localStorage key holding the rectangle. |
| `minWidth` / `minHeight` | `520` / `600` | Minimum size, matching the Electron main process. |
| `saveIntervalMs` | `1000` | Save polling interval. |
| `restoreDelayMs` | `400` | Extra restore attempt after the window becomes visible. |
| `stateDir` | `~/.dsh/window-state-plugin` | Directory for the diagnostic marker. |

## Troubleshooting

- `~/.dsh/window-state/loaded.json` — written when the plugin mounts; its presence proves the plugin loaded.
- The saved rectangle lives in `~/Library/Application Support/@deepseek-ai/dsh-desktop/Local Storage/leveldb`
  under the configured key.
- Code and config changes need a DSH restart, because injection rows are collected only at startup.

## Limitations

- Desktop only; a Web UI opened in a browser cannot move or resize the tab.
- Maximized and fullscreen states are not restored (the last normal size is).
- Multi-display: when `screen.isExtended === true` coordinates are not clamped; after unplugging a display the OS may
  move the window back to the main screen.
- State is kept in localStorage for the `dsh-app://app` origin; clearing the app's site data loses it.

## Development

```sh
node --test test/
```

- `lib/script.js` — builds the injected script (plain browser APIs, unit-tested).
- `lib/index.js` — the Cordis plugin that contributes one `script` row to `webserver/index-inject`.

## License

[MIT](LICENSE) © 2026 kvker
