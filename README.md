Chinese | [English](README.en.md)

# dsh-window-state

[![CI](https://github.com/kvker/dsh-window-state/actions/workflows/ci.yml/badge.svg)](https://github.com/kvker/dsh-window-state/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

DeepSeek Harness 桌面端插件：记住窗口上次的位置和尺寸，下次启动自动恢复，不再回到默认的 1280×820。

## 为什么需要插件

桌面窗口由 Electron 主进程创建（`apps/desktop/src/main.ts` 的 `createWindow()`，写死 `1280×820`，不保存状态），
而 DSH 插件运行在独立的 host 进程里，拿不到 `BrowserWindow`。

不过 DSH 的 Web 服务提供了受支持的注入口 `webserver/index-inject`：桌面壳启动时会收集注入行，通过 boot
交给渲染层执行 `<script>`（主题、快捷键配置走的是同一条路）。插件利用这个口子注入一小段脚本，在页面里用
`window.moveTo()` / `window.resizeTo()` 还原和记录窗口矩形。

## 行为

- 启动时读取上次矩形 → `resizeTo(width, height)` + `moveTo(x, y)`；
- 之后每秒（以及页面隐藏/卸载时）把当前矩形写进 `localStorage`；
- 最大化/全屏时不覆盖已保存的普通尺寸；
- 单显示器环境下把矩形夹进当前屏幕可用区域，避免恢复出离屏窗口；
- 只在桌面壳（`dsh-app://`）里生效，普通浏览器打开 Web UI 时静默跳过。

## 安装

需要 DeepSeek Harness 桌面端（自带 `dsh` CLI）。

```sh
# 从 GitHub 安装
dsh plugin --profile desktop add git+https://github.com/kvker/dsh-window-state.git

# 或从本地目录（开发时用，pnpm 会建 link）
dsh plugin --profile desktop add ~/Documents/deepseek-harness/plugins/dsh-window-state
```

本包声明了 `dsh.bundle.patch`，CLI 会把它作为 bundle 层追加到 profile 并启用。
**装完必须重启一次 DSH**（注入行只在启动时收集）。

卸载：

```sh
dsh plugin --profile desktop remove dsh-window-state
```

## 使用

1. 重启后把窗口拖到想要的位置、拉到想要的尺寸；
2. 正常退出 DSH；
3. 再打开，窗口回到上次的位置和尺寸。

第一次启动时还没有记录，保持默认位置；之后就会记住。

## 配置

在 `~/.dsh/profiles/desktop/cordis.patch.yml` 里用同 id（`window-state`）覆盖：

```yaml
- id: window-state
  config:
    storageKey: 'dsh-window-state:v1'
    minWidth: 520
    minHeight: 600
    saveIntervalMs: 1000
    restoreDelayMs: 400
```

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 总开关。 |
| `storageKey` | `dsh-window-state:v1` | localStorage 里保存矩形的键。 |
| `minWidth` / `minHeight` | `520` / `600` | 与 Electron 主进程一致的最小尺寸。 |
| `saveIntervalMs` | `1000` | 轮询保存间隔。 |
| `restoreDelayMs` | `400` | 窗口显示后再补一次恢复的延迟。 |
| `stateDir` | `~/.dsh/window-state` | 诊断文件目录。 |

## 排查

- `~/.dsh/window-state/loaded.json`：插件加载标记，有它说明插件挂上了；
- 保存的矩形在 `~/Library/Application Support/@deepseek-ai/dsh-desktop/Local Storage/leveldb` 里，
  键名默认 `dsh-window-state:v1`；
- 改了代码或配置后要重启 DSH 才生效（注入行只在启动时收集）。

## 限制

- 只对桌面应用有效；浏览器里打开的 Web UI 无法移动/缩放标签页窗口。
- 最大化和全屏状态不会被记住（恢复的是最后一次普通尺寸）。
- 多显示器：`screen.isExtended === true` 时不再夹取坐标，显示器拔出后系统可能会把窗口收回主屏。
- 记录存在 localStorage（`dsh-app://app` 源），清空应用站点数据会丢失。

## 开发

```sh
node --test test/
```

- `lib/script.js`：生成注入脚本（纯浏览器 API，可单测）。
- `lib/index.js`：Cordis 插件，向 `webserver/index-inject` 推一行 `script`。

## License

[MIT](LICENSE) © 2026 kvker
