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
  const instrumented = source.replace("    return {\n      inject: ['slots', 'locale', 'connection']", "    window.testComponents = { InstalledPlugins, SkillsView, PluginConfigForm, resourceSections, pluginState };\n    return {\n      inject: ['slots', 'locale', 'connection']")
  assert(instrumented.includes('window.testComponents'), 'Client test hook must be installed')
  vm.runInNewContext(instrumented, { window, console, setTimeout, clearTimeout, AbortController })
  const plugin = registrations[0].factory(name => { assert.equal(name, 'react'); return React })
  const render = (component, props) => { if(props.ui){props.ui.lang??='en';props.ui.text??=v=>typeof v==='string'?v:undefined} cursor = 0; const node = component(props); const pending = effects; effects = []; pending.forEach(f => f()); return node }
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...node.props.children.flatMap(flatten)]
  const button = (tree, label) => { const found = flatten(tree).find(node => node.type === 'button' && node.props.children.join('') === label); assert(found, label); return found }
  const unmount=()=>values.forEach(v=>v?.cleanup?.());
  return { plugin, render, flatten, button, unmount, component: window.testComponents, cleanups, slots }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const t = key => key
test('plugin editor renders installed candidates and confirms literal add before one mutation', async () => {
  const h = clientHarness(), calls = [], saved = []
  const preset = { id: 'fixture', source: 'builtin', pluginRevision: 'rev', rows: [] }
  const ui = { t, pending: new Set(), describe: e => e.message, call: async (action, body) => { calls.push(action); return { modules: [{ module: 'installed-worker', addable: true, availability:'installed' }], diagnostics: [] } }, run: async (...args) => saved.push(args) }
  const render = () => h.render(h.component.InstalledPlugins, { ui, preset })
  let tree = render(); await flush(); tree = render()
  const input = label => h.flatten(tree).find(n => n.props['aria-label'] === label)
  h.button(tree, 'pm.add').props.onClick(); tree = render()
  input('pm.rowId').props.onChange({ target: { value: 'custom-plugin' } }); tree = render()
  input('pm.config').props.onChange({ target: { value: '{"count":2}' } }); tree = render()
  h.flatten(tree).filter(n=>n.type==='button'&&n.props.children.join('')==='pm.add').at(-1).props.onClick(); tree = render()
  assert.equal(saved.length, 0)
  h.button(tree, 'pm.commit').props.onClick()
  assert.equal(saved.length, 1); assert.equal(saved[0][1], 'editPlugin'); assert.equal(saved[0][2].base, 'rev')
  assert.equal(saved[0][2].module, 'installed-worker'); assert.equal(saved[0][2].config.count, 2)
})
test('late inspection cannot attach metadata to a different selected module', async () => {
  const h = clientHarness(); let settle
  const preset = { id: 'fixture', pluginRevision: 'rev', rows: [] }
  const ui = { t, pending: new Set(), describe: e => e.message, call: action => action === 'inspectPlugin' ? new Promise(resolve => { settle = resolve }) : Promise.resolve({ modules: [{module:'first',addable:true,availability:'installed'},{module:'second',addable:true,availability:'installed'}], diagnostics: [] }) }
  const render = () => h.render(h.component.InstalledPlugins, { ui, preset })
  let tree = render(); await flush(); tree = render()
  const choose = value => { const row=h.flatten(tree).find(n=>n.type==='article'&&h.flatten(n).some(c=>c.type==='strong'&&c.props.children.includes(value))); h.button(row,'pm.add').props.onClick(); tree=render() }
  choose('first'); h.button(tree, 'pm.inspect').props.onClick(); choose('second')
  settle({ module: 'first', schema: { secret: 'stale' } }); await flush(); tree = render()
  assert(!h.flatten(tree).some(node => node.type === 'pre' && node.props.children.join('').includes('stale')))
})
test('installed Skill assignment sends only a discovered name and confirmed Preset revision', async () => {
  const h=clientHarness(),saved=[],preset={id:'worker-any-id',source:'custom',pluginRevision:'rev2',rows:[]}
  const value={modes:[{id:preset.id,editable:true,hasSkillTool:false}],skills:[{name:'installed-skill',description:'fixture',modes:{},versions:[],exists:true}]}
  const ui={t,scope:preset.id,presets:[preset],pending:new Set(),describe:e=>e.message,announce(){},nameOf:id=>id,setList(){},setScope(){},call:async(action,payload)=>{if(action==='skills')return value;saved.push({action,payload});return {effect:{skills:value}}}}
  const render=()=>h.render(h.component.SkillsView,{ui,reloadKey:0})
  let tree=render();await flush();tree=render()
  assert(h.flatten(tree).some(n=>n.props.children.includes('resources.noTool')))
  h.button(tree,'pm.assign').props.onClick();tree=render();assert.equal(saved.length,0)
  h.button(tree,'pm.commit').props.onClick();h.button(tree,'pm.commit').props.onClick();await flush()
  assert.equal(saved.length,1);assert.equal(saved[0].action,'assignSkill');assert.equal(saved[0].payload.id,preset.id);assert.equal(saved[0].payload.base,'rev2');assert.equal(saved[0].payload.skill,'installed-skill');assert(!('path' in saved[0].payload))
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

 test('Schema controls preserve complex JSON and do not submit mutations themselves', () => {
  const h=clientHarness();let value;const text=JSON.stringify({count:2,enabled:true,nested:{keep:1}});
  const tree=h.render(h.component.PluginConfigForm,{info:{form:{fields:[{key:'count',type:'integer',minimum:1,required:true},{key:'enabled',type:'boolean'}],fallback:['nested']}},text,t,busy:false,onChange:s=>{value=JSON.parse(s)}});
  h.flatten(tree).find(n=>n.props['aria-label']==='config.count').props.onChange({target:{valueAsNumber:5}});
  assert.equal(value.count,5);assert.equal(value.nested.keep,1);
  h.flatten(tree).find(n=>n.props['aria-label']==='config.enabled').props.onChange({target:{checked:false}});assert.equal(value.enabled,false);
  const complex=h.render(h.component.PluginConfigForm,{info:{form:{fields:[{key:'count',type:'integer'}],fallback:[]}},text:'{"count":{"__jsExpr":"existing"}}',t,onChange:()=>assert.fail('Must keep expression in JSON')});
  assert.equal(h.flatten(complex).find(n=>n.props['aria-label']==='config.count').props.disabled,true);
 });

test('four resource sections retain duplicate Rows, unknown origins and search membership',()=>{
 const h=clientHarness(),items=[{key:'one',added:true,origin:'official',search:'alpha'},{key:'two',added:true,origin:'official',search:'alpha'},{key:'three',added:true,origin:'unknown',search:'alpha'},{key:'available',added:false,origin:'extra',search:'beta'}];
 const render=query=>({type:'main',props:{children:h.component.resourceSections(t,items,query,item=>({type:'article',props:{children:[item.key]}}))}})
 const all=render('');assert.deepEqual(h.flatten(all).filter(n=>n.type==='article').map(n=>n.props.children[0]),['one','two','three','available']);
 const filtered=render('alpha');assert(!JSON.stringify(filtered).includes('"children":["available"]'));assert(JSON.stringify(filtered).includes('resources.extra'));assert(JSON.stringify(filtered).includes('resources.available'));
 assert.deepEqual(items.map(i=>i.key),['one','two','three','available']);
})

test('configured, conditional, failed, unresolved and mounted states remain distinct',()=>{
 const state=clientHarness().component.pluginState;
 assert.equal(state({declared:true,enabled:false},{availability:'installed'}),'unmounted');assert.equal(state({declared:false,enabled:true},{availability:'installed'}),'disabled');
 assert.equal(state({declared:'conditional',enabled:true},{availability:'installed'}),'conditional');assert.equal(state({declared:true,failure:'native failure'},{availability:'installed'}),'failedRow');
 assert.equal(state({declared:false},{availability:'unresolved'}),'missing');assert.equal(state({declared:true,enabled:true},{availability:'installed'}),'enabled');
})

test('catalog switching, refresh failure and normal rendering cannot reuse stale results or rescan every render',async()=>{
 const h=clientHarness(),pending=[],ui={t,pending:new Set(),describe:e=>e.message,call:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
 let preset={id:'one',pluginRevision:'a',rows:[]};const render=()=>h.render(h.component.InstalledPlugins,{ui,preset});render();render();assert.equal(pending.length,1);
 preset={id:'two',pluginRevision:'b',rows:[]};render();assert.equal(pending.length,2);pending[1].resolve({modules:[{module:'new-module',addable:true}],diagnostics:[]});await flush();let tree=render();
 pending[0].resolve({modules:[{module:'stale-module',addable:true}],diagnostics:[]});await flush();tree=render();assert(JSON.stringify(tree).includes('new-module'));assert(!JSON.stringify(tree).includes('stale-module'));
 h.button(tree,'resources.refresh').props.onClick();render();pending[2].reject(Error('scan failed'));await flush();tree=render();assert(JSON.stringify(tree).includes('scan failed'));h.unmount();
})

test('Skills combine native, assigned, disabled and missing entries without touching unassigned files in bulk actions',async()=>{
 const h=clientHarness(),calls=[],preset={id:'fixture',rows:[],pluginRevision:'v'};
 const skill=(name,state,extra={})=>({name,description:name,versions:[],origin:'extra',modes:{fixture:state},...extra});
 const view={modes:[{id:'fixture',editable:true,hasSkillTool:true}],skills:[skill('native',{native:true,present:true}),skill('manual',{assigned:true,present:true}),skill('off',{off:true}),skill('missing',{assigned:true,missing:true},{exists:false}),skill('global-off',{managed:true},{off:true}),skill('unassigned',{})]};
 const ui={t,scope:'fixture',presets:[preset],pending:new Set(),nameOf:id=>id,setScope(){},describe:e=>e.message,announce(){},setList(){},call:async(action,payload)=>{calls.push({action,payload});return action==='skills'?view:{effect:{skills:view}}}};
 const render=()=>h.render(h.component.SkillsView,{ui,reloadKey:0});render();await flush();let tree=render();assert(JSON.stringify(tree).includes('resources.added · 5'));assert(JSON.stringify(tree).includes('resources.available · 1'));
 assert(JSON.stringify(tree).includes('resources.disabled'));assert(JSON.stringify(tree).includes('resources.missing'));h.button(tree,'skills.allOff').props.onClick();tree=render();h.flatten(tree).filter(n=>n.type==='button'&&n.props.children.join('')==='skills.allOff').at(-1).props.onClick();await flush();
 const change=calls.find(c=>c.action==='setSkillModes');assert(change);assert(!change.payload.changes.some(c=>c.skill==='unassigned'));assert.equal(calls.filter(c=>c.action==='skills').length,1);h.unmount();
})
