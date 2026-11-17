import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWindowStateScript, DEFAULTS, normalizeOptions } from '../lib/script.js'

test('默认选项符合常量', () => {
  const options = normalizeOptions()

  assert.equal(options.enabled, true)
  assert.equal(options.storageKey, DEFAULTS.storageKey)
  assert.equal(options.minWidth, 520)
  assert.equal(options.minHeight, 600)
})

test('非法配置回退到默认值', () => {
  const options = normalizeOptions({
    storageKey: '',
    minWidth: -3,
    minHeight: 0,
    saveIntervalMs: Number.NaN,
    restoreDelayMs: -1,
    enabled: false,
  })

  assert.equal(options.enabled, false)
  assert.equal(options.storageKey, DEFAULTS.storageKey)
  assert.equal(options.minWidth, DEFAULTS.minWidth)
  assert.equal(options.minHeight, DEFAULTS.minHeight)
  assert.equal(options.saveIntervalMs, DEFAULTS.saveIntervalMs)
  assert.equal(options.restoreDelayMs, DEFAULTS.restoreDelayMs)
})

test('生成的脚本可解析，且包含保存/恢复所需调用', () => {
  const text = buildWindowStateScript(normalizeOptions({ storageKey: 'custom:key' }))

  assert.doesNotThrow(() => new Function(`return ${text}`))
  assert.match(text, /window\.resizeTo/)
  assert.match(text, /window\.moveTo/)
  assert.match(text, /localStorage/)
  assert.match(text, /custom:key/)
  assert.match(text, /dsh-app:/)
  assert.match(text, /pagehide/)
})

test('自定义最小尺寸会写进脚本', () => {
  const text = buildWindowStateScript(normalizeOptions({ minWidth: 800, minHeight: 500 }))

  assert.match(text, /"minWidth":800/)
  assert.match(text, /"minHeight":500/)
})

test('脚本在非桌面协议下静默返回', () => {
  const text = buildWindowStateScript(normalizeOptions())
  const source = text.replace(/^\(function \(\) \{/, '').replace(/\}\)\(\)$/, '')

  assert.match(source, /location\.protocol !== 'dsh-app:'/)
})
