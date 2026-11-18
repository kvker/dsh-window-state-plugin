# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Renamed the package to `dsh-window-state-plugin` to match the repository. The stored rectangle keeps the existing
  `dsh-window-state:v1` key, so saved window positions survive the rename.

## [0.1.0] - 2026-11-17

### Added

- Remember the desktop window rectangle across launches by injecting a script through the supported
  `webserver/index-inject` seam; the renderer restores it with `window.moveTo()` / `window.resizeTo()`.
- Persist the rectangle in `localStorage` on a timer and on `pagehide` / `beforeunload`.
- Skip saving while maximized or fullscreen, so the last normal size survives.
- Clamp the restored rectangle into the current work area on single-display machines.
- Restrict the behavior to the desktop shell (`dsh-app://`), leaving browser Web UI sessions untouched.
- Diagnostic load marker at `~/.dsh/window-state/loaded.json`, configurable options, and unit tests.
