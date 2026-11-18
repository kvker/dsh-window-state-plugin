/**
 * 窗口位置/尺寸的保存与恢复脚本。
 *
 * 这段代码最终被作为 `<script>` 注入 DSH 页面，在渲染进程里执行，因此必须：
 * - 自包含（不能 import）；
 * - 只使用浏览器 API；
 * - 在非桌面（浏览器打开 Web UI）环境下自动跳过。
 *
 * @module dsh-window-state-plugin/script
 */

import os from 'node:os'
import path from 'node:path'

/** 默认配置。 */
export const DEFAULTS = Object.freeze({
  /** 总开关。 */
  enabled: true,
  /** localStorage 里的存储键。 */
  storageKey: 'dsh-window-state:v1',
  /** 与 Electron 主进程一致的窗口最小尺寸。 */
  minWidth: 520,
  minHeight: 600,
  /** 最小保存间隔，避免拖动时高频写 localStorage。 */
  saveIntervalMs: 1000,
  /** 启动后补一次恢复的延迟，用于窗口真正显示之后。 */
  restoreDelayMs: 400,
  /** 诊断文件目录。 */
  stateDir: path.join(os.homedir(), '.dsh', 'window-state-plugin'),
})

/**
 * 规范化插件配置。
 *
 * @param {Record<string, unknown>} [raw] - Loader 传入的 config。
 * @returns {typeof DEFAULTS & {enabled: boolean}} 完整选项。
 */
export function normalizeOptions(raw = {}) {
  const input = raw ?? {}
  const positive = (value, fallback) => (Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback)
  return {
    enabled: input.enabled !== false,
    storageKey: typeof input.storageKey === 'string' && input.storageKey.length > 0
      ? input.storageKey
      : DEFAULTS.storageKey,
    minWidth: positive(input.minWidth, DEFAULTS.minWidth),
    minHeight: positive(input.minHeight, DEFAULTS.minHeight),
    saveIntervalMs: positive(input.saveIntervalMs, DEFAULTS.saveIntervalMs),
    restoreDelayMs: Number.isFinite(input.restoreDelayMs) && input.restoreDelayMs >= 0
      ? Math.trunc(input.restoreDelayMs)
      : DEFAULTS.restoreDelayMs,
    stateDir: typeof input.stateDir === 'string' && input.stateDir.length > 0
      ? path.resolve(input.stateDir)
      : DEFAULTS.stateDir,
  }
}

/**
 * 生成注入用的脚本文本。
 *
 * 行为：
 * 1. 只在桌面壳（`dsh-app://`）里生效；
 * 2. 启动时读取上次保存的矩形，用 `resizeTo` + `moveTo` 还原；
 * 3. 之后定时（以及页面隐藏/卸载时）把当前矩形写回 localStorage；
 * 4. 最大化/全屏时不覆盖已保存的普通尺寸；
 * 5. 单屏环境下把矩形夹在当前显示器可用区域内，避免恢复出离屏窗口。
 *
 * @param {ReturnType<typeof normalizeOptions>} [options] - 规范化选项。
 * @returns {string} 可直接执行的脚本文本。
 */
export function buildWindowStateScript(options = normalizeOptions()) {
  const config = {
    key: options.storageKey,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    saveIntervalMs: options.saveIntervalMs,
    restoreDelayMs: options.restoreDelayMs,
  }

  return `(function () {
  try {
    if (location.protocol !== 'dsh-app:') return

    var CFG = ${JSON.stringify(config)}
    var MIN_W = CFG.minWidth
    var MIN_H = CFG.minHeight

    var store = null
    try { store = window.localStorage } catch (error) { store = null }
    if (!store) return

    function isNum(value) { return typeof value === 'number' && isFinite(value) }

    function sane(rect) {
      return !!rect && isNum(rect.x) && isNum(rect.y) && isNum(rect.width) && isNum(rect.height)
        && rect.width >= MIN_W - 1 && rect.height >= MIN_H - 1
        && rect.width <= 10000 && rect.height <= 10000
        && Math.abs(rect.x) <= 20000 && Math.abs(rect.y) <= 20000
    }

    function read() {
      try {
        var raw = store.getItem(CFG.key)
        if (!raw) return null
        var rect = JSON.parse(raw)
        return sane(rect) ? rect : null
      } catch (error) { return null }
    }

    function current() {
      return {
        x: Math.round(window.screenX),
        y: Math.round(window.screenY),
        width: Math.round(window.outerWidth),
        height: Math.round(window.outerHeight),
      }
    }

    function maximized() {
      var screenInfo = window.screen || {}
      var availWidth = screenInfo.availWidth || screenInfo.width || 0
      var availHeight = screenInfo.availHeight || screenInfo.height || 0
      return availWidth > 0 && availHeight > 0
        && window.outerWidth >= availWidth - 2
        && window.outerHeight >= availHeight - 2
    }

    function fit(rect) {
      var width = Math.min(Math.max(rect.width, MIN_W), 10000)
      var height = Math.min(Math.max(rect.height, MIN_H), 10000)
      var x = rect.x
      var y = rect.y
      var screenInfo = window.screen || {}
      if (screenInfo.isExtended !== true && isNum(screenInfo.availWidth) && isNum(screenInfo.availHeight)) {
        var left = isNum(screenInfo.availLeft) ? screenInfo.availLeft : 0
        var top = isNum(screenInfo.availTop) ? screenInfo.availTop : 0
        var maxX = left + Math.max(0, screenInfo.availWidth - Math.min(width, screenInfo.availWidth))
        var maxY = top + Math.max(0, screenInfo.availHeight - Math.min(height, screenInfo.availHeight))
        x = Math.min(Math.max(x, left), maxX)
        y = Math.min(Math.max(y, top), maxY)
      }
      return { x: x, y: y, width: width, height: height }
    }

    var settled = false
    function settle() { settled = true }
    try {
      window.addEventListener('pointerdown', settle, true)
      window.addEventListener('keydown', settle, true)
    } catch (error) { /* ignore */ }

    function apply() {
      if (settled) return
      var saved = read()
      if (!saved) return
      var rect = fit(saved)
      try {
        window.resizeTo(rect.width, rect.height)
        window.moveTo(rect.x, rect.y)
      } catch (error) { /* ignore */ }
    }

    var last = ''
    function save() {
      if (maximized()) return
      var rect = current()
      if (!sane(rect)) return
      var key = JSON.stringify(rect)
      if (key === last) return
      last = key
      try { store.setItem(CFG.key, key) } catch (error) { /* ignore */ }
    }

    apply()
    setTimeout(apply, CFG.restoreDelayMs)
    setInterval(save, CFG.saveIntervalMs)
    window.addEventListener('pagehide', save)
    window.addEventListener('beforeunload', save)
  } catch (error) { /* never break the page */ }
})()`
}
