import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planPluginEdit, revision, installedCatalog, discoverSkills, validateComposition, resourceOrigin, skillOrigin } from '../preset-plugins.js'
import { rebase } from '../rebase.js'
import { StateStore } from '../state.js'
import { clientEntryFromHtml } from './client-graph.js'
const catalog = [{ module: 'dsh-fixture', addable: true, availability: 'installed' }]
const base = [{ id: 'one', name: 'dsh-fixture', config: { count: 1 } }, { id: 'two', name: 'dsh-fixture' }]
const plan = (rows, input) => planPluginEdit(rows, { base: revision(rows), ...input }, catalog)

test('official origin needs Host installation provenance and resolved package location, never just a name',()=>{
 const dir=join(tmpdir(),'provenance','node_modules','@deepseek-ai'),base=join(dir,'dsh-base'),official=join(dir,'dsh-tool-fixture'),third=join(tmpdir(),'local-package');
 const packages={resolution:{entries:[{name:'@deepseek-ai/dsh-base',packageDir:base,scope:'installation'},{name:'@deepseek-ai/dsh-tool-fixture',packageDir:official,scope:'installation'},{name:'dsh-thirdparty',packageDir:third,scope:'profile'}],localPackageNames:[]}};
 assert.equal(resourceOrigin(packages,{dir:official},'@deepseek-ai/dsh-tool-fixture'),'official');
 assert.equal(resourceOrigin(packages,{dir:third},'@deepseek-ai/dsh-tool-fixture'),'unknown');assert.equal(resourceOrigin(packages,{dir:third},'dsh-thirdparty'),'extra');
 assert.equal(skillOrigin(packages,join(official,'skills','a','SKILL.md')),'official');assert.equal(skillOrigin(packages,join(third,'skills','a','SKILL.md')),'extra');assert.equal(skillOrigin(packages,join(tmpdir(),'unknown','SKILL.md')),'unknown');
});
test('frontend checks use the actual advertised resource and reject stale/missing/foreign URLs', () => {
  const html = entry => '<script>globalThis["__DSH_BOOT__"] = ' + JSON.stringify({ entries: [entry] }) + '</script>'
  const entry = { id: 'dsh-preset-manager', rev: 'abc', url: 'plugins/??dsh-preset-manager/client.js&rev=abc' }
  assert.equal(clientEntryFromHtml(html(entry), entry.id).url, entry.url)
  assert.throws(() => clientEntryFromHtml(html(entry), 'missing'), /not in/)
  assert.throws(() => clientEntryFromHtml(html({ ...entry, url: 'https://untrusted.invalid/client.js' }), entry.id), /Invalid/)
  assert.throws(() => clientEntryFromHtml(html({ ...entry, url: entry.url.replace('rev=abc', 'rev=stale') }), entry.id), /Invalid/)
})

test('literal additions, configuration, toggle, sibling order and removal preserve the source', () => {
  const original = structuredClone(base)
  let rows = plan(base, { op: 'add', module: 'dsh-fixture', rowId: 'three', config: { count: 2 } })
  rows = plan(rows, { op: 'move', rowId: 'three', direction: -1 })
  assert.deepEqual(rows.map(r => r.id), ['one', 'three', 'two'])
  rows = plan(rows, { op: 'toggle', rowId: 'one', enabled: false }); assert.equal(rows[0].disabled, true)
  rows = plan(rows, { op: 'configure', rowId: 'one', config: { count: 3 } }); assert.equal(rows[0].config.count, 3)
  rows = plan(rows, { op: 'remove', rowId: 'two' }); assert.equal(rows.length, 2)
  assert.deepEqual(base, original)
})
test('rejects stale saves, duplicate ids, uninstalled modules, host-only entries and expressions', () => {
  assert.throws(() => planPluginEdit(base, { base: 'old', op: 'remove', rowId: 'one' }, catalog), /changed/)
  assert.throws(() => plan(base, { op: 'add', rowId: 'one', module: 'dsh-fixture' }), /unique/)
  assert.throws(() => plan(base, { op: 'add', rowId: 'new', module: 'https://evil/plugin.js' }), /installed/)
  assert.throws(() => planPluginEdit(base, { base: revision(base), op: 'add', rowId: 'host', module: 'host' }, [{ module: 'host', addable: false }]), /installed/)
  for (const config of [{ nested: { __jsExpr: 'true' } }, JSON.parse('{"__proto__":{}}')]) assert.throws(() => plan(base, { op: 'configure', rowId: 'one', config }), /literal/)
})
test('group edits do not reorder across scope realms and update merges retain removals and order', () => {
  const source = [{ id: 'group', group: true, name: 'cordis:group', config: base }, { id: 'tail', name: 'dsh-fixture' }]
  let rows = plan(source, { op: 'move', rowId: 'two', direction: -1 })
  rows = plan(rows, { op: 'remove', rowId: 'one' })
  const newer = structuredClone(source); newer[0].config[1].config = { updated: true }; newer.push({ id: 'new-upstream', name: 'dsh-fixture' })
  const merged = rebase(rows, newer, source, { preserveLayout: true }).rows
  assert.deepEqual(merged[0].config.map(r => r.id), ['two']); assert.equal(merged[0].config[0].config.updated, true)
  assert.equal(merged.at(-1).id, 'new-upstream')
  assert.deepEqual(rebase(merged, newer, newer, { preserveLayout: true }).rows, merged)
})
test('discovers unreferenced installed exports without executing them and marks Host rows', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pm-catalog-'))
  const manifestPath = join(dir, 'package.json')
  await writeFile(join(dir, 'index.js'), 'export function apply() {}')
  await writeFile(join(dir, 'unused.js'), 'export function apply() {}')
  await writeFile(manifestPath, JSON.stringify({ name: 'dsh-fixture', version: '1.2.3', exports: { '.': './index.js', './unused': './unused.js', './client': './client.js', './package.json': './package.json' } }))
  const packages = { resolution: { entries: [{ name: 'dsh-fixture' }] }, packageOf: () => ({ manifestPath }) }
  const ctx = { get: () => packages, configEditor: { documentPath: join(dir, 'cordis.patch.yml'), entries: () => [{ options: { name: 'dsh-fixture' } }] } }
  const view = await installedCatalog(ctx)
  assert.deepEqual(view.modules.map(r => r.module), ['dsh-fixture', 'dsh-fixture/unused'])
  assert.equal(view.modules[0].addable, false); assert.equal(view.modules[1].referenced, false)
  assert.equal(view.modules[0].availability, 'installed'); assert.equal(view.modules[0].hostOnly, true)
  const unresolved = await installedCatalog(ctx, [[{ id: 'missing', name: 'not-installed/subpath' }, { id: 'bad-export', name: 'dsh-fixture/missing-export' }]])
  for (const name of ['not-installed/subpath','dsh-fixture/missing-export']) {
    const row = unresolved.modules.find(r => r.module === name)
    assert.equal(row.referenced, true); assert.equal(row.availability, 'unresolved'); assert.equal(row.addable, false)
    assert.throws(() => planPluginEdit(base, { base: revision(base), op: 'add', rowId: 'new', module: name }, unresolved.modules), /installed/)
  }
})
test('discovers flat/directory/unassigned Skills and reports ambiguous names', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pm-skills-'))
  await mkdir(join(dir, 'one')); await mkdir(join(dir, 'two'))
  await writeFile(join(dir, 'one', 'SKILL.md'), '---\nname: report\ndescription: first\n---\nBody')
  await writeFile(join(dir, 'two', 'SKILL.md'), '---\nname: report\ndescription: second\n---\nBody')
  await writeFile(join(dir, 'flat.md'), '---\nname: flat\ndescription: flat file\n---\nBody')
  const view = await discoverSkills([dir, dir])
  assert.equal(view.skills.length, 2); assert.equal(view.skills.find(s => s.name === 'report').conflicts.length, 1)
})
test('native validation always releases its Preset and temporary scope after failure', async () => {
  let released = 0, scopeReleased = 0
  const agentPresets = { register: async () => async () => { released++ }, acquireScope: async () => ({ [Symbol.asyncDispose]: async () => { scopeReleased++ } }) }
  await validateComposition({ agentPresets }, base); assert.equal(scopeReleased, 1); assert.equal(released, 1)
  agentPresets.acquireScope = async () => { throw Error('scope leak') }
  await assert.rejects(validateComposition({ agentPresets }, base), /scope leak/); assert.equal(released, 2)
})
test('corrupt state is not overwritten and new fork disables automatic registry checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pm-state-')), store = new StateStore(dir)
  assert.equal((await store.read('settings')).checkUpdates, false)
  await writeFile(join(dir, 'state.json'), 'invalid')
  await assert.rejects(store.update('state', () => {}), /damaged/)
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), 'invalid')
})
