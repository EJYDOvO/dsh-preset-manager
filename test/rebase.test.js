import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rebase } from '../rebase.js'

const persona = (prefix, extra = {}) => ({ id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix, suffix: 'S1', ...extra } })
const keep = row => row.name.startsWith('dsh-modes/')
const find = (rows, id) => rows.find(row => row.id === id)

const base = [
  persona('built-in v1'),
  { id: 'tool-web', name: 'web', config: { fetch: true, timeout: 1 } },
  { id: 'tool-fs', name: 'fs' },
  { id: 'old', name: 'old-mod' },
]
// The user changed the prompt, switched web off, and added the manager's tool row.
const user = [
  persona('mine'),
  { id: 'tool-web', name: 'web', disabled: true, config: { fetch: true, timeout: 1 } },
  { id: 'tool-fs', name: 'fs' },
  { id: 'old', name: 'old-mod' },
  { id: 'dsh-modes-prompt-tool', name: 'dsh-modes/prompt-tool' },
]
// Upstream changed the suffix and the web timeout, configured fs, dropped `old`, and added `new`.
const latest = [
  persona('built-in v1', { suffix: 'S2' }),
  { id: 'tool-web', name: 'web', config: { fetch: true, timeout: 2 } },
  { id: 'tool-fs', name: 'fs', config: { write: true } },
  { id: 'new', name: 'new-mod' },
]

test('keeps the user\'s changes and takes every built-in change they did not touch', () => {
  const result = rebase(user, latest, base, { keep })
  assert.equal(find(result.rows, 'persona').config.prefix, 'mine')
  assert.equal(find(result.rows, 'persona').config.suffix, 'S2')
  assert.equal(find(result.rows, 'tool-web').disabled, true)
  assert.equal(find(result.rows, 'tool-web').config.timeout, 2)
  assert.deepEqual(find(result.rows, 'tool-fs'), { id: 'tool-fs', name: 'fs', config: { write: true } })
  assert.ok(find(result.rows, 'new'))
  assert.equal(find(result.rows, 'old'), undefined)
  assert.ok(find(result.rows, 'dsh-modes-prompt-tool'))
  assert.deepEqual(result.summary.added, ['new'])
  assert.deepEqual(result.summary.removed, ['old'])
  assert.deepEqual(result.summary.updated.sort(), ['persona', 'tool-fs', 'tool-web'])
  assert.deepEqual(result.summary.conflicts, [])
  assert.equal(result.changed, true)
})

test('keeps the user\'s value when both sides changed the same setting, and reports it', () => {
  const both = user.map(row => (row.id === 'tool-web' ? { ...row, config: { ...row.config, timeout: 9 } } : row))
  const result = rebase(both, latest, base, { keep })
  assert.equal(find(result.rows, 'tool-web').config.timeout, 9)
  assert.deepEqual(result.summary.conflicts, ['tool-web.config.timeout'])
})

test('without a recorded base, treats every difference as the user\'s and still adds and drops rows', () => {
  const result = rebase(user, latest, undefined, { keep })
  assert.equal(find(result.rows, 'tool-web').config.timeout, 1)
  assert.ok(find(result.rows, 'new'))
  assert.equal(find(result.rows, 'old'), undefined)
  assert.deepEqual(result.summary.updated, [])
})

test('changes nothing when the rows already include the latest built-in rows', () => {
  const merged = rebase(user, latest, base, { keep }).rows
  assert.equal(rebase(merged, latest, latest, { keep }).changed, false)
})

test('lets a template switch off rows the built-in list added', () => {
  const result = rebase(user, latest, base, { keep, newRow: row => ({ ...row, disabled: true }) })
  assert.equal(find(result.rows, 'new').disabled, true)
})

test('matches rows nested in groups by id', () => {
  const group = rows => [{ id: 'planning', group: true, config: rows }]
  const result = rebase(
    group([{ id: 'plan', name: 'p', disabled: true }]),
    group([{ id: 'plan', name: 'p', config: { a: 1 } }, { id: 'plan2', name: 'p2' }]),
    group([{ id: 'plan', name: 'p' }]),
  )
  assert.deepEqual(result.rows, [{ id: 'planning', group: true, config: [{ id: 'plan', name: 'p', disabled: true, config: { a: 1 } }, { id: 'plan2', name: 'p2' }] }])
})

test('keeps a fixed platform choice and follows an untouched platform condition', () => {
  const conditional = { id: 'bash', name: 'b', disabled: { __jsExpr: 'process.platform === "win32"' } }
  assert.equal(rebase([{ ...conditional, disabled: false }], [conditional], [conditional]).rows[0].disabled, false)
  const changed = { ...conditional, disabled: { __jsExpr: 'x' } }
  assert.deepEqual(rebase([conditional], [changed], [conditional]).rows[0].disabled, { __jsExpr: 'x' })
})
