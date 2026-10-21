import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { apply } from '../index.js'
import { FALLBACK_ROW_ID, LIVE_MODULE, PERSONA_MODULE, WHEN_GONE, WHEN_INSTALLED, guardRows, isGuard, unguardRows } from '../install-guard.js'

const gone = { __jsExpr: WHEN_GONE }
const installed = { __jsExpr: WHEN_INSTALLED }

/** The Loader's evaluator for a `!!js` value: the expression runs with the entry's context as its scope. */
// eslint-disable-next-line no-new-func
const evaluate = new Function('ctx', 'expr', 'with (ctx) { return eval(expr) }')

test('rows the manager added stay off once it is uninstalled; other rows are left alone', () => {
  const rows = [
    { id: 'persona', name: PERSONA_MODULE, config: { prefix: 'Hi' } },
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs', disabled: { __jsExpr: "process.platform === 'win32'" } },
    { id: 'dsh-modes-skills', name: 'dsh-modes/skills', config: { preset: 'standard' } },
    { id: 'dsh-modes-prompt-tool', name: 'dsh-modes/prompt-tool', disabled: true },
  ]
  assert.deepEqual(guardRows(rows), [
    rows[0],
    rows[1],
    { ...rows[2], disabled: gone },
    rows[3],
  ])
  assert.equal(rows[2].disabled, undefined, 'the input list is not changed')
})

test('a live persona is followed by an official persona row with its prompt, kept in step on every save', () => {
  const live = { id: 'persona', name: LIVE_MODULE, config: { prefix: 'New', suffix: 'End', preset: 'standard' } }
  const stale = { id: FALLBACK_ROW_ID, name: PERSONA_MODULE, config: { prefix: 'Old' }, disabled: installed }
  assert.deepEqual(guardRows([live, stale, { id: 'time-context', name: '@deepseek-ai/dsh-time-context' }]), [
    { ...live, disabled: gone },
    { id: FALLBACK_ROW_ID, name: PERSONA_MODULE, config: { prefix: 'New', suffix: 'End' }, disabled: installed },
    { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
  ])
})

test('a persona switched back from live loses the condition and its stand-in', () => {
  const official = { id: 'persona', name: PERSONA_MODULE, config: { prefix: 'Hi' }, disabled: gone }
  const fallback = { id: FALLBACK_ROW_ID, name: PERSONA_MODULE, config: { prefix: 'Hi' }, disabled: installed }
  assert.deepEqual(guardRows([official, fallback]), [{ id: 'persona', name: PERSONA_MODULE, config: { prefix: 'Hi' } }])
})

test('rows inside groups are guarded, and unguardRows takes everything back out', () => {
  const rows = [{ id: 'g', name: 'cordis:group', group: true, config: [{ id: 'persona', name: LIVE_MODULE, config: { prefix: 'A', preset: 'x' } }] }]
  const guarded = guardRows(rows)
  assert.deepEqual(guarded[0].config.map(row => row.id), ['persona', FALLBACK_ROW_ID])
  assert.ok(isGuard(guarded[0].config[0].disabled))
  assert.deepEqual(unguardRows(guarded), rows)
})

test('the conditions follow whether dsh-modes resolves from the row base', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'dsh-modes-guard-'))
  const base = { baseUrl: pathToFileURL(`${profile}/`).href }
  assert.equal(evaluate(base, WHEN_GONE), true, 'not installed: the added rows are off')
  assert.equal(evaluate(base, WHEN_INSTALLED), false, 'not installed: the stand-in persona runs')

  await mkdir(join(profile, 'node_modules', 'dsh-modes'), { recursive: true })
  await writeFile(join(profile, 'node_modules', 'dsh-modes', 'package.json'), JSON.stringify({ name: 'dsh-modes', exports: { './package.json': './package.json' } }))
  assert.equal(evaluate(base, WHEN_GONE), false, 'installed: the added rows run')
  assert.equal(evaluate(base, WHEN_INSTALLED), true, 'installed: the stand-in persona is off')

  assert.equal(evaluate({}, WHEN_GONE), false, 'no base: the added rows stay on, as before')
  assert.equal(evaluate({}, WHEN_INSTALLED), true, 'no base: the stand-in persona stays off')
})

test('the package exports the file the conditions resolve', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./package.json'], './package.json')
  assert.ok(manifest.files.includes('install-guard.js'))
})

test('on start, overrides saved without the conditions get them; others are not written', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-modes-guard-'))
  const declaration = (id, plugins, overridden = true) => ({
    entry: { options: { name: '@deepseek-ai/dsh-agent-preset', config: { id, plugins } } },
    inherited: { plugins: [] },
    override: overridden ? { config: { plugins } } : {},
  })
  const skills = { id: 'dsh-modes-skills', name: 'dsh-modes/skills', config: { preset: 'standard' } }
  const declarations = [
    declaration('standard', [{ id: 'persona', name: PERSONA_MODULE }, skills]),
    declaration('ptc', [{ id: 'persona', name: PERSONA_MODULE }, { ...skills, config: { preset: 'ptc' }, disabled: gone }]),
    declaration('minimal', [{ id: 'persona', name: PERSONA_MODULE }], false),
  ]
  const edits = []
  apply({
    configEditor: {
      documentPath: join(dir, 'cordis.patch.yml'),
      configuration: () => declarations,
      edit: async (entry, change) => { edits.push({ id: entry.options.config.id, next: change(entry.options.config) }) },
    },
    provide() {},
    get: () => undefined,
    inject: () => {},
    on: () => () => {},
    logger: { warn: message => assert.fail(message) },
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(edits.map(edit => edit.id), ['standard'])
  assert.deepEqual(edits[0].next.plugins[1], { ...skills, disabled: gone })
})
