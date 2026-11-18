/**
 * DSH host 插件：记住桌面窗口上次的位置与尺寸。
 *
 * 桌面壳的窗口由 Electron 主进程创建（固定 1280×820，不保存状态），插件运行在
 * 独立的 host 进程里，碰不到 BrowserWindow。但 Web 服务提供了受支持的
 * `webserver/index-inject` 注入口：桌面壳启动时会收集注入行并通过 boot 传给渲染层
 * 执行 `<script>`。本插件就利用这个口子注入一段窗口状态脚本，在页面里用
 * `window.moveTo` / `window.resizeTo` 还原与记录窗口矩形。
 *
 * @module dsh-window-state-plugin
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { buildWindowStateScript, normalizeOptions } from './script.js'

/**
 * 记录一次加载，便于排查「插件到底装上没有」。
 *
 * @param {object} options - 规范化选项。
 * @param {object} logger - Cordis logger。
 * @returns {void}
 */
function recordLoad(options, logger) {
  const file = path.join(options.stateDir, 'loaded.json')
  const payload = {
    at: new Date().toISOString(),
    storageKey: options.storageKey,
    pid: process.pid,
  }
  fs.mkdir(path.dirname(file), { recursive: true })
    .then(() => fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`))
    .catch((error) => logger.warn(`[window-state] 写加载标记失败：${error instanceof Error ? error.message : String(error)}`))
}

/** 插件名（Cordis / Loader 用）。 */
export const name = 'window-state'

/**
 * 安装插件。
 *
 * @param {object} ctx - Cordis 上下文。
 * @param {Record<string, unknown>} config - Loader 传入的行配置。
 */
export function apply(ctx, config) {
  const options = normalizeOptions(config)
  if (!options.enabled) {
    ctx.logger.info('[window-state] 已关闭（enabled: false）')
    return
  }

  const row = {
    kind: 'script',
    placement: 'body',
    text: buildWindowStateScript(options),
  }

  ctx.effect(() => {
    const off = ctx.on('webserver/index-inject', (table) => {
      if (!Array.isArray(table)) return
      if (table.some(item => item?.kind === 'script' && item?.text === row.text)) return
      table.push(row)
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, 'window-state: index injection')

  ctx.logger.info(`[window-state] 已启用：窗口位置与尺寸会记在 localStorage（${options.storageKey}）`)
  recordLoad(options, ctx.logger)
}
