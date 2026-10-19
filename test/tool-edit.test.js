import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyWrites, catalogEntries, checkText, overridesOf, planEdits, planRestore, TOOL_DESCRIPTION_MAX_CHARS, TOOL_HISTORY_LIMIT } from '../tool-edit.js'

const mode = (tools, extra = {}) => ({ editable: true, ptc: false, tools: new Map(Object.entries(tools)), ...extra })
const presets = () => new Map([
  ['standard', mode({ bash: 'Execute a command', read: 'Read a file' })],
  ['research', mode({ bash: 'Execute a command', read: 'Read a file' })],
  ['minimal', mode({ bash: 'Run commands in a shell' })],
  ['code', mode({ bash: 'Execute a command' }, { ptc: true })],
  ['other', mode({ bash: 'Execute a command' }, { editable: false })],
])
const stored = (entries = {}) => new Map(Object.entries(entries).map(([id, tools]) => [id, new Map(Object.entries(tools))]))
const statuses = results => results.map(result => `${result.preset}/${result.tool}:${result.status}`)

test('saves one text to several modes and records the built-in text of each as its base', () => {
  const plan = planEdits({
    edits: ['standard', 'research', 'minimal'].map(preset => ({ preset, tool: 'bash', text: 'Run commands.' })),
    presets: presets(),
    overrides: stored(),
  })
  assert.deepEqual(statuses(plan.results), ['standard/bash:saved', 'research/bash:saved', 'minimal/bash:saved'])
  assert.deepEqual(plan.writes.get('standard').get('bash'), { text: 'Run commands.', base: 'Execute a command' })
  assert.deepEqual(plan.writes.get('minimal').get('bash'), { text: 'Run commands.', base: 'Run commands in a shell' })
})

test('edits several tools of one mode in one batch', () => {
  const plan = planEdits({
    edits: [{ preset: 'standard', tool: 'bash', text: 'A' }, { preset: 'standard', tool: 'read', text: 'B' }],
    presets: presets(),
    overrides: stored(),
  })
  assert.deepEqual([...plan.writes.get('standard').keys()], ['bash', 'read'])
})

test('refuses code mode, other plugins\' modes, unknown tools and modes, bad names, and bad text without writing', () => {
  const plan = planEdits({
    edits: [
      { preset: 'code', tool: 'bash', text: 'x' },
      { preset: 'other', tool: 'bash', text: 'x' },
      { preset: 'standard', tool: 'nope', text: 'x' },
      { preset: 'ghost', tool: 'bash', text: 'x' },
      { preset: 'standard', tool: 'ba sh', text: 'x' },
      { preset: 'standard', tool: 'bash', text: '   ' },
      { preset: 'standard', tool: 'bash', text: 'y'.repeat(TOOL_DESCRIPTION_MAX_CHARS + 1) },
    ],
    presets: presets(),
    overrides: stored(),
  })
  assert.deepEqual(plan.results.map(result => result.status), ['ptc', 'not-editable', 'unknown-tool', 'unknown-preset', 'invalid', 'invalid', 'invalid'])
  assert.equal(plan.results[5].code, 'tool-text-empty')
  assert.equal(plan.results[6].code, 'tool-text-too-long')
  assert.equal(plan.writes.size, 0)
})

test('reports a conflict when the stored override is not the one the editor saw, unless it already has the new text', () => {
  const overrides = stored({ standard: { bash: { text: 'Changed elsewhere', base: 'Execute a command' } } })
  const plan = planEdits({
    edits: [
      { preset: 'standard', tool: 'bash', text: 'Mine', expected: null },
      { preset: 'standard', tool: 'bash', text: 'Changed elsewhere', expected: null },
      { preset: 'standard', tool: 'bash', text: 'Mine', expected: 'Changed elsewhere' },
    ],
    presets: presets(),
    overrides,
  })
  assert.deepEqual(plan.results.map(result => result.status), ['conflict', 'unchanged', 'saved'])
  assert.equal(plan.results[0].current, 'Changed elsewhere')
})

test('drops the override when the text equals the built-in text, and reports no change when there was none', () => {
  const overrides = stored({ standard: { bash: { text: 'Mine', base: 'Execute a command' } } })
  const plan = planEdits({
    edits: [{ preset: 'standard', tool: 'bash', text: 'Execute a command' }, { preset: 'research', tool: 'bash', text: 'Execute a command' }],
    presets: presets(),
    overrides,
  })
  assert.deepEqual(plan.results.map(result => result.status), ['restored', 'unchanged'])
  assert.equal(plan.writes.get('standard').get('bash'), null)
  assert.equal(plan.writes.has('research'), false)
})

test('saving the same text again changes nothing, but refreshes a base the built-in text has outgrown', () => {
  const overrides = stored({ standard: { bash: { text: 'Mine', base: 'An older built-in text' } }, research: { bash: { text: 'Mine', base: 'Execute a command' } } })
  const plan = planEdits({
    edits: [{ preset: 'standard', tool: 'bash', text: 'Mine' }, { preset: 'research', tool: 'bash', text: 'Mine' }],
    presets: presets(),
    overrides,
  })
  assert.deepEqual(plan.results.map(result => result.status), ['saved', 'unchanged'])
  assert.deepEqual(plan.writes.get('standard').get('bash'), { text: 'Mine', base: 'Execute a command' })
})

test('normalizes line breaks and keeps the text otherwise as written', () => {
  assert.deepEqual(checkText('a\r\nb\rc'), { ok: true, text: 'a\nb\nc' })
  assert.equal(checkText(5).ok, false)
})

test('restores single tools, whole modes, or everything, and ignores tools without an override', () => {
  const overrides = stored({ standard: { bash: { text: 'A' }, read: { text: 'B' } }, research: { bash: { text: 'C' } } })
  const single = planRestore({ selector: { items: [{ preset: 'standard', tool: 'bash' }, { preset: 'standard', tool: 'glob' }] }, overrides })
  assert.deepEqual(statuses(single.results), ['standard/bash:restored', 'standard/glob:unchanged'])
  const modes = planRestore({ selector: { presets: ['standard'] }, overrides })
  assert.deepEqual([...modes.writes.get('standard').keys()], ['bash', 'read'])
  const all = planRestore({ selector: { all: true }, overrides })
  assert.deepEqual([...all.writes.keys()], ['standard', 'research'])
  assert.equal(planRestore({ selector: {}, overrides }).results.length, 0)
})

test('applies writes to the stored file and keeps a bounded history', () => {
  const content = { version: 1, presets: {} }
  applyWrites(content, new Map([['standard', new Map([['bash', { text: 'A', base: 'O' }]])]]), 'page', 1)
  applyWrites(content, new Map([['standard', new Map([['bash', { text: 'B', base: 'O' }]])]]), 'page', 2)
  applyWrites(content, new Map([['standard', new Map([['bash', null]])]]), 'restore', 3)
  assert.deepEqual(content.presets.standard.tools, {})
  assert.deepEqual(content.presets.standard.history.map(entry => [entry.before, entry.after, entry.source]), [[null, 'A', 'page'], ['A', 'B', 'page'], ['B', null, 'restore']])
  const crowded = { version: 1, presets: {} }
  for (let index = 0; index < TOOL_HISTORY_LIMIT + 20; index++) applyWrites(crowded, new Map([['standard', new Map([['bash', { text: `v${index}` }]])]]), 'page', index)
  assert.equal(crowded.presets.standard.history.length, TOOL_HISTORY_LIMIT)
  assert.equal(crowded.presets.standard.history.at(-1).after, `v${TOOL_HISTORY_LIMIT + 19}`)
})

test('a preset with neither overrides nor history leaves no record; one with history keeps it for the page', () => {
  const content = { version: 1, presets: {} }
  applyWrites(content, new Map([['standard', new Map([['bash', null]])]]), 'restore', 1)
  assert.equal(content.presets.standard, undefined)
  applyWrites(content, new Map([['standard', new Map([['bash', { text: 'A' }]])]]), 'page', 2)
  applyWrites(content, new Map([['standard', new Map([['bash', null]])]]), 'restore', 3)
  assert.equal(overridesOf(content).has('standard'), false)
  assert.equal(content.presets.standard.history.length, 2)
})

test('builds catalog entries with outdated, missing, seen, and earlier versions', () => {
  const entries = catalogEntries({
    scanned: new Map([['bash', 'New built-in'], ['read', 'Read a file']]),
    seen: new Map([['subagent', 'Delegate work'], ['read', 'ignored']]),
    overrides: new Map([['bash', { text: 'Mine', base: 'Old built-in' }], ['gone', { text: 'Old tool' }]]),
    history: [{ tool: 'bash', before: null, after: 'First', at: 1 }, { tool: 'bash', before: 'First', after: 'Mine', at: 2 }],
  })
  const byName = Object.fromEntries(entries.map(entry => [entry.name, entry]))
  assert.deepEqual(entries.map(entry => entry.name), ['bash', 'gone', 'read', 'subagent'])
  assert.equal(byName.bash.outdated, true)
  assert.equal(byName.bash.original, 'New built-in')
  assert.deepEqual(byName.bash.previous, ['First'])
  assert.equal(byName.gone.missing, true)
  assert.equal(byName.subagent.seen, true)
  assert.equal(byName.read.seen, undefined)
  assert.equal(byName.read.original, 'Read a file')
})
