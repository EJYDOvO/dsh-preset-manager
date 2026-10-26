// Component event tests, not a browser/visual acceptance claim. The production client is evaluated in memory.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
const source = (await readFile(new URL('../client.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
function clientHarness() {
  let cursor = 0, effects = [], registrations = []
  const slots = [], values = [], cleanups = []
  const React = {
    Component: class {}, Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
    useState(initial) { const at = cursor++; if (!(at in values)) values[at] = typeof initial === 'function' ? initial() : initial; return [values[at], next => { values[at] = typeof next === 'function' ? next(values[at]) : next }] },
    useRef(initial) { const at = cursor++; return values[at] ??= { current: initial } },
    useEffect(effect, deps) { const at = cursor++; if (!values[at] || deps.some((v, i) => v !== values[at].deps[i])) { values[at]?.cleanup?.(); values[at] = { deps }; effects.push(() => { values[at].cleanup = effect() }) } },
  }
  const window = { __ModuleLoader__: { load: entry => { registrations.push(entry) } } }
  const instrumented = source.replace("    return {\n      inject: ['slots', 'locale', 'connection']", "    window.testComponents = { InstalledPlugins, InstalledSkills };\n    return {\n      inject: ['slots', 'locale', 'connection']")
  assert(instrumented.includes('window.testComponents'), 'Client test hook must be installed')
  vm.runInNewContext(instrumented, { window, console, setTimeout, clearTimeout, AbortController })
  const plugin = registrations[0].factory(name => { assert.equal(name, 'react'); return React })
  const render = (component, props) => { cursor = 0; const node = component(props); const pending = effects; effects = []; pending.forEach(f => f()); return node }
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...node.props.children.flatMap(flatten)]
  const button = (tree, label) => { const found = flatten(tree).find(node => node.type === 'button' && node.props.children.join('') === label); assert(found, label); return found }
  return { plugin, render, flatten, button, component: window.testComponents, cleanups, slots }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const t = key => key
test('plugin editor renders installed candidates and confirms literal add before one mutation', async () => {
  const h = clientHarness(), calls = [], saved = []
  const preset = { id: 'fixture', source: 'builtin', pluginRevision: 'rev', rows: [] }
  const ui = { t, pending: new Set(), describe: e => e.message, call: async (action, body) => { calls.push(action); return { modules: [{ module: 'installed-worker', addable: true }], diagnostics: [] } }, run: async (...args) => saved.push(args) }
  const render = () => h.render(h.component.InstalledPlugins, { ui, preset })
  let tree = render(); await flush(); tree = render()
  const input = label => h.flatten(tree).find(n => n.props['aria-label'] === label)
  input('pm.module').props.onChange({ target: { value: 'installed-worker' } }); tree = render()
  input('pm.rowId').props.onChange({ target: { value: 'custom-plugin' } }); tree = render()
  input('pm.config').props.onChange({ target: { value: '{"count":2}' } }); tree = render()
  h.button(tree, 'pm.add').props.onClick(); tree = render()
  assert.equal(saved.length, 0)
  h.button(tree, 'pm.commit').props.onClick()
  assert.equal(saved.length, 1); assert.equal(saved[0][1], 'editPlugin'); assert.equal(saved[0][2].base, 'rev')
  assert.equal(saved[0][2].module, 'installed-worker'); assert.equal(saved[0][2].config.count, 2)
})
test('late inspection cannot attach metadata to a different selected module', async () => {
  const h = clientHarness(); let settle
  const preset = { id: 'fixture', pluginRevision: 'rev', rows: [] }
  const ui = { t, pending: new Set(), describe: e => e.message, call: action => action === 'inspectPlugin' ? new Promise(resolve => { settle = resolve }) : Promise.resolve({ modules: [], diagnostics: [] }) }
  const render = () => h.render(h.component.InstalledPlugins, { ui, preset })
  let tree = render(); await flush(); tree = render()
  const choose = value => { h.flatten(tree).find(n => n.props['aria-label'] === 'pm.module').props.onChange({ target: { value } }); tree = render() }
  choose('first'); h.button(tree, 'pm.inspect').props.onClick(); choose('second')
  settle({ module: 'first', schema: { secret: 'stale' } }); await flush(); tree = render()
  assert(!h.flatten(tree).some(node => node.type === 'pre' && node.props.children.join('').includes('stale')))
})
test('installed Skill assignment sends only a discovered name and confirmed Preset revision', async () => {
  const h = clientHarness(), saved = [], preset = { id: 'worker-any-id', source: 'custom', pluginRevision: 'rev2' }
  const ui = { t, scope: preset.id, presets: [preset], pending: new Set(), describe: e => e.message, announce() {}, call: async () => ({ skills: [{ name: 'installed-skill', description: 'fixture' }] }), run: (...args) => saved.push(args) }
  const render = () => h.render(h.component.InstalledSkills, { ui })
  let tree = render(); await flush(); tree = render()
  h.button(tree, 'pm.assign').props.onClick(); tree = render(); assert.equal(saved.length, 0)
  h.button(tree, 'pm.commit').props.onClick(); assert.equal(saved.length, 1)
  assert.equal(saved[0][2].id, 'worker-any-id'); assert.equal(saved[0][2].base, 'rev2'); assert.equal(saved[0][2].skill, 'installed-skill')
  assert(!('path' in saved[0][2]))
})
test('native client unload aborts pending RPC and refuses late results', async () => {
  const h = clientHarness(), cleanups = []; let render, signal, settle
  const ctx = { connection: { rpc: { call: (_channel, _method, _body, s) => { signal = s; return new Promise(resolve => { settle = resolve }) } } },
    locale: { register: () => () => {}, bind: () => t }, effect: fn => { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
    slots: { inject: (_name, callback) => callback(), register: (_meta, value) => { render = value; return () => {} } } }
  h.plugin.apply(ctx)
  const tree = render({}), api = tree.props.children[0].props.api
  const pending = api('list'); assert.equal(signal.aborted, false)
  for (const release of cleanups.reverse()) release()
  assert.equal(signal.aborted, true)
  settle({ ok: true, value: { ok: true, value: {} } })
  await assert.rejects(pending, /unloaded/)
  await assert.rejects(api('list'), /unloaded/)
})
