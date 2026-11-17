import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply, name } from '../lib/index.js'

/**
 * 造一个最小 Cordis 假上下文。
 *
 * @returns {{ctx: object, emitInjection: Function, messages: string[], disposers: Function[]}} 环境。
 */
async function harness() {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-window-state-'))
  const listeners = new Map()
  const messages = []
  const disposers = []
  const ctx = {
    logger: {
      info: (message) => messages.push(`info ${message}`),
      warn: (message) => messages.push(`warn ${message}`),
    },
    on: (event, handler) => {
      listeners.set(event, handler)
      return () => listeners.delete(event)
    },
    effect: (factory) => {
      disposers.push(factory())
    },
  }
  return {
    ctx,
    messages,
    disposers,
    stateDir,
    emitInjection: (table) => listeners.get('webserver/index-inject')?.(table, {}),
  }
}

test('插件名用于 Loader 行', () => {
  assert.equal(name, 'window-state')
})

test('向 index 注入一条内联脚本', async () => {
  const { ctx, emitInjection, stateDir } = await harness()
  apply(ctx, { stateDir })

  const table = []
  emitInjection(table)

  assert.equal(table.length, 1)
  assert.equal(table[0].kind, 'script')
  assert.equal(table[0].placement, 'body')
  assert.match(table[0].text, /resizeTo/)
  assert.match(table[0].text, /moveTo/)
})

test('同一页面重复收集不会重复注入', async () => {
  const { ctx, emitInjection, stateDir } = await harness()
  apply(ctx, { stateDir })

  const table = []
  emitInjection(table)
  emitInjection(table)

  assert.equal(table.length, 1)
})

test('enabled: false 时不注册监听', async () => {
  const { ctx, emitInjection, stateDir } = await harness()
  apply(ctx, { enabled: false, stateDir })

  const table = []
  emitInjection(table)

  assert.equal(table.length, 0)
})

test('卸载时移除监听', async () => {
  const { ctx, emitInjection, disposers, stateDir } = await harness()
  apply(ctx, { stateDir })

  for (const dispose of disposers.reverse()) dispose?.()

  const table = []
  emitInjection(table)
  assert.equal(table.length, 0)
})
