import assert from 'node:assert/strict'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { LlmAdapter, createUserMessage } from '@deepseek-ai/dsh-llm'
import { clientEntryFromHtml } from './client-graph.js'

export const inject = ['agentPresets', 'configEditor', 'pluginPackages', 'agents', 'tools', 'skills', 'connection', 'webServer', 'llm', 'subagents']
export function apply(ctx, config) {
  ctx.effect(() => { const timer = setTimeout(() => run(ctx, config), 350); return () => clearTimeout(timer) })
}
async function run(ctx, config) {
  const { home, runId } = config, result = { runId, phase: 0, ok: false, checks: [] }
  const file = join(home, 'restart.json'), source = new URL('./fixture/cordis.patch.yml', import.meta.url)
  const hash = text => createHash('sha256').update(text).digest('hex')
  const resources = []
  try {
    const attempted=new Set()
    class Fixture extends LlmAdapter { async *stream(request) {
      const input=request.messages.filter(m=>m.role==='user'&&!['runtime-context','time-context','skill-catalog','agent-instructions'].includes(m.source?.kind)).at(-1),key=request.sessionId+':'+input?.id
      if(JSON.stringify(input).includes('Invoke configured tool')&&!attempted.has(key)){attempted.add(key);yield {type:'tool-call-delta',index:0,id:randomUUID(),name:'pm_fixture',argumentsDelta:'{}'}}
      else yield { type: 'text-delta', index: 0, text: 'Isolated worker result.' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } }
    ctx.llm.registerAdapter(['preset-manager-fixture'], new Fixture())
    const restarted = await stat(file).then(() => true, () => false); result.phase = Number(restarted)
    const origin = ctx.webServer.getOrigin(), login = await fetch(ctx.connection.authenticatedUrl(origin + '/'), { redirect: 'manual' })
    const cookie = login.headers.get('set-cookie').split(';')[0], endpoint = origin + '/api/dsh-preset-manager'
    const raw = (body, headers = {}) => fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', cookie, origin, ...headers }, body: JSON.stringify(body) })
    const call = async (action, args = {}) => {
      const response = await raw({ action, ...args }); assert.equal(response.status, 200)
      return response.json()
    }
    const good = async (action, args) => { const value = await call(action, args); assert.equal(value.ok, true, JSON.stringify(value)); return value.value }
    const preset = async () => (await good('list')).presets.find(p => p.id === 'pm-fixture')
    const edit = async args => good('editPlugin', { id: 'pm-fixture', base: (await preset()).pluginRevision, ...args })
    const names = async id => {
      const lease = await ctx.agentPresets.acquireScope(id)
      try { return ctx.tools.schemas(lease.key).map(t => t.name) } finally { await lease[Symbol.asyncDispose]() }
    }
    assert.equal((await raw({ action: 'list' }, { cookie: '' })).status, 401)
    assert.equal((await raw({ action: 'list' }, { origin: 'https://untrusted.invalid' })).status, 403)
    const peer = ctx.connection.createPeer({ principal: { kind: 'agent', sessionId: 'forged' } })
    const shared = ctx.connection.createSharedFetchHandler('/api')
    for (const action of ['list', 'pluginCatalog', 'editPlugin', 'installedSkills', 'assignSkill']) {
      const response = await shared.fetch(new Request(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }), peer)
      assert.equal(response.status, 403)
    }
    await peer.dispose()
    const rpc = await (await raw({ type: 'client-request', rpcId: runId, method: 'dsh-preset-manager', payload: { action: 'list' } })).json()
    assert.equal(rpc.type, 'server-response'); assert.equal(rpc.result.value.ok, true)
    result.checks.push('Native authentication, Origin, non-owner Peer and Web/Desktop RPC envelope')
    const html = await (await fetch(origin + '/', { headers: { cookie } })).text()
    const clientEntry = clientEntryFromHtml(html, 'dsh-preset-manager')
    const clientResponse = await fetch(new URL(clientEntry.url, origin + '/'))
    assert.equal(clientResponse.status, 200)
    const clientCode = await clientResponse.text(); assert(clientCode.includes('settings.section') && clientCode.includes('Preset 管理'))
    assert.equal((await fetch(origin + '/plugins/dsh-preset-manager/client.js')).status, 404, 'Unversioned client resource is deliberately unavailable')
    result.checks.push('Actual frontend graph advertises and serves the versioned manager client bundle')
    const catalog = await good('pluginCatalog')
    assert(catalog.modules.some(p=>p.module==='@deepseek-ai/dsh-persona'&&p.origin==='official'))
    assert(catalog.modules.some(p=>p.module==='dsh-pm-fixture/unused'&&p.origin==='extra'))
    assert(catalog.modules.some(p => p.module === 'dsh-pm-fixture/unused' && p.referenced === restarted))
    const schema = await good('inspectPlugin', { module: 'dsh-pm-fixture/unused' })
    assert(schema.hasSchema); assert(schema.required.includes('tools')); assert(schema.schema)
    assert(schema.form.fields.some(f=>f.key==='count'&&f.type==='integer'));assert(schema.form.fields.some(f=>f.key==='enabled'&&f.type==='boolean'));assert(schema.form.fallback.includes('nested'))
    const skills = await good('installedSkills'); assert(skills.skills.some(s => s.name === 'manager-probe'&&s.origin==='extra'&&s.assignable===true));assert(skills.skills.some(s=>s.name==='invalid-policy'&&s.assignable===false))
    result.checks.push('Actual installed unreferenced plugin/Skill discovery and native Config projection')
    const sourceHash = hash(await readFile(source))
    let state = restarted ? JSON.parse(await readFile(file, 'utf8')) : { sourceHash }
    if (!restarted) {
      assert(!(await names('pm-fixture')).includes('pm_fixture'))
      const old = await ctx.agentPresets.acquireScope('pm-fixture'); resources.push(() => old[Symbol.asyncDispose]())
      await edit({ op: 'add', module: 'dsh-pm-fixture/unused', rowId: 'fixture-tool', config: { count: 2 } })
      assert((await names('pm-fixture')).includes('pm_fixture'))
      assert(!ctx.tools.schemas(old.key).some(t => t.name === 'pm_fixture'), 'old revision retained')
      const after = await preset(); assert.equal(after.source, 'overridden')
      const stale = await call('editPlugin', { id: 'pm-fixture', base: 'stale', op: 'remove', rowId: 'fixture-tool' }); assert.equal(stale.code, 'plugin-conflict')
      const [a, b] = await Promise.all([call('editPlugin', { id: 'pm-fixture', base: after.pluginRevision, op: 'configure', rowId: 'fixture-tool', config: { count: 3 } }), call('editPlugin', { id: 'pm-fixture', base: after.pluginRevision, op: 'configure', rowId: 'fixture-tool', config: { count: 4 } })])
      assert.equal([a,b].filter(r => r.ok).length, 1); assert.equal([a,b].find(r => !r.ok).code, 'plugin-conflict')
      result.checks.push('Native Override persistence, revision retention, stale and concurrent CAS saves')
      const before = await readFile(ctx.configEditor.documentPath, 'utf8')
      for (const [module, content] of [['dsh-pm-fixture/needs', {}], ['dsh-pm-fixture/host', {}], ['dsh-pm-fixture/throws', {}], ['dsh-pm-fixture/unused', { count: -1 }]]) {
        const rejection = await call('editPlugin', { id: 'pm-fixture', base: (await preset()).pluginRevision, op: 'add', module, rowId: 'invalid-probe', config: content })
        assert.equal(rejection.ok, false, module); assert.equal(rejection.code, 'composition-invalid')
        assert.equal(await readFile(ctx.configEditor.documentPath, 'utf8'), before)
      }
      assert(!(await ctx.agentPresets.list()).some(p => p.id.startsWith('pm-check-')))
      assert.equal(ctx.get('pmHostOnlyService'), undefined)
      result.checks.push('Native missing dependency, Host scope leakage, activation and Schema failure preserve saved Profile; probes released')
      const semanticBefore = (await preset()).pluginRevision
      const flaky = await call('editPlugin', { id: 'pm-fixture', base: semanticBefore, op: 'add', module: 'dsh-pm-fixture/flaky', rowId: 'flaky', config: {} })
      assert.equal(flaky.code, 'composition-invalid'); assert.match(flaky.error, /previous configuration restored/)
      assert.equal((await preset()).pluginRevision, semanticBefore); assert(!(await preset()).broken)
      result.checks.push('Failure after successful preflight restores the actual saved Preset without recording a false merge base')
      await edit({ op: 'move', rowId: 'fixture-tool', direction: -1 })
      await edit({ op: 'toggle', rowId: 'fixture-tool', enabled: false }); assert(!(await names('pm-fixture')).includes('pm_fixture'))
      await edit({ op: 'toggle', rowId: 'fixture-tool', enabled: true }); assert((await names('pm-fixture')).includes('pm_fixture'))
      await good('assignSkill', { id: 'pm-fixture', base: (await preset()).pluginRevision, skill: 'manager-probe', enabled: true })
      assert((await good('skills')).skills.find(s=>s.name==='manager-probe').modes['pm-fixture'].assigned)
      await good('setSkillGlobal',{skill:'manager-probe',enabled:false})
      const globallyDisabled=(await good('skills')).skills.find(s=>s.name==='manager-probe');assert(globallyDisabled.off);assert(globallyDisabled.modes['pm-fixture'].managed)
      await good('setSkillGlobal',{skill:'manager-probe',enabled:true})
      let lease = await ctx.agentPresets.acquireScope('pm-fixture')
      try { assert((await ctx.skills.snapshot({ scope: lease.key })).skills.some(s => s.name === 'manager-probe' && s.invocation.modelInvocable !== false)) } finally { await lease[Symbol.asyncDispose]() }
      const switched = await good('setSkillModes', { changes: [{ preset: 'pm-fixture', skill: 'manager-probe', enabled: false }] }); assert.equal(switched.effect.results[0].status, 'saved')
      lease = await ctx.agentPresets.acquireScope('pm-fixture')
      try { assert(!(await ctx.skills.snapshot({ scope: lease.key })).skills.some(s => s.name === 'manager-probe' && s.invocation.modelInvocable !== false)) } finally { await lease[Symbol.asyncDispose]() }
      await good('setSkillModes', { changes: [{ preset: 'pm-fixture', skill: 'manager-probe', enabled: true }] })
      await good('skills',{refresh:true})
      const savedVersion=await good('saveSkillVersion',{skill:'manager-probe',note:'Synthetic Profile update regression'})
      state.skillVersion=savedVersion.effect.version;assert(state.skillVersion)
      await good('setSkillModes',{changes:[{preset:'pm-fixture',skill:'manager-probe',pin:state.skillVersion}]})
      await good('assignSkill', { id: 'pm-fixture', base: (await preset()).pluginRevision, skill: 'no-auto', enabled: true })
      assert.equal((await ctx.get('dshModes').assignedSkill('pm-fixture', 'no-auto')).meta.invocation.modelInvocable, false)
      const invalidSkill = await call('assignSkill', { id: 'pm-fixture', base: (await preset()).pluginRevision, skill: 'invalid-policy', enabled: true })
      assert.equal(invalidSkill.code, 'skill-conflict')
      result.checks.push('Plugin reorder/off/on and installed Skill assignment/off/on in real scoped registry')
      const custom = await good('create', { id: 'pm-custom', name: 'Custom fixture', from: 'pm-fixture' })
      assert(custom.presets.some(p => p.id === 'pm-custom' && p.source === 'custom'))
      const worker = (await good('list')).presets.find(p => p.id === 'root-planner-worker')
      await good('editPlugin', { id: worker.id, base: worker.pluginRevision, op: 'add', module: 'dsh-pm-fixture/unused', rowId: 'ordinary-worker-tool', config: { count: 1 } })
      const workerWithTool=(await good('list')).presets.find(p=>p.id===worker.id)
      await good('editPlugin',{id:worker.id,base:workerWithTool.pluginRevision,op:'add',module:'@deepseek-ai/dsh-tool-skill',rowId:'worker-skill-loader',config:{}})
      assert((await names(worker.id)).includes('pm_fixture'), 'Worker remains an ordinary editable Preset')
      await good('create', { id: 'pm-root', name: 'Synthetic orchestrator', from: 'cordis' })
      const parent = (await good('list')).presets.find(p => p.id === 'pm-root')
      const spawnRow = parent.rows.find(row => row.module === '@deepseek-ai/dsh-tool-subagent' && row.config?.provider === 'spawn')
      assert(spawnRow)
      await good('editPlugin', { id: 'pm-root', base: parent.pluginRevision, op: 'configure', rowId: spawnRow.id, config: { ...spawnRow.config, agentPreset: 'root-planner-worker', allowedAgentPresets: ['root-planner-worker'], maxDepth: 1 } })
      state.revision = (await preset()).pluginRevision
      result.checks.push('Modes custom container and ordinary Worker edits without an added boundary')
    } else {
      const stored = JSON.parse(await readFile(file, 'utf8'))
      assert.equal(sourceHash, stored.sourceHash); assert.equal((await preset()).pluginRevision, stored.revision)
      const moved=JSON.parse(await readFile(join(home,'profile-switch.json'),'utf8'));assert(moved.unchanged&&moved.copied>3)
      assert((await names('pm-fixture')).includes('pm_fixture')); assert((await names('root-planner-worker')).includes('pm_fixture'))
      assert((await good('list')).presets.some(p => p.id === 'pm-custom' && p.source === 'custom'))
      const lease = await ctx.agentPresets.acquireScope('pm-fixture')
      try { assert((await ctx.skills.snapshot({ scope: lease.key })).skills.some(s => s.name === 'manager-probe' && s.invocation.modelInvocable !== false)) } finally { await lease[Symbol.asyncDispose]() }
      const policy=await ctx.get('dshModes').skillPolicy('pm-fixture');assert.equal(policy.pins.get('manager-probe'),stored.skillVersion);assert(await ctx.get('dshModes').skillVersion('manager-probe',stored.skillVersion))
      const beforeSync=(await preset()).rows.find(r=>r.id==='fixture-tool').config
      await good('sync',{id:'pm-fixture'})
      const synced=await preset();assert(synced.rows.some(r=>r.id==='upstream-new'));assert.deepEqual(synced.rows.find(r=>r.id==='fixture-tool').config,beforeSync)
      const bases=JSON.parse(await readFile(join(home,'profiles/manager/.dsh-preset-manager/state.json'),'utf8'));assert(bases.presets['pm-fixture'].base.some(r=>r.id==='upstream-new'))
      result.checks.push('Actual Profile replacement + Host restart retains custom Presets, Overrides, rows, Skill assignments/versions; upstream merge updates baseline')
    }
    const options = { agentOptions: { provider: 'preset-manager-fixture', model: 'fixture' }, setup: async c => { await ctx.agentPresets.mount(c, 'pm-root') } }
    const handle = await (restarted ? ctx.agents.resume({ ...options, resumeSessionId: state.parent }) : ctx.agents.create({ ...options, sessionId: randomUUID(), meta: { cwd: home, agentPreset: 'pm-root' } }))
    resources.push(() => handle.dispose())
    const parentAgent = handle.agent
    if (!restarted) {
      const child = await ctx.tools.get('subagent', parentAgent).execute({ description: 'Native reviewed target', prompt: 'Return fixture result', agent_preset: 'root-planner-worker' }, { agent: parentAgent, signal: AbortSignal.timeout(10000) })
      state.child = child.subagentId; state.parent = parentAgent.id
    } else await ctx.subagents.sendMessage(parentAgent, state.child, [{ type: 'text', text: 'Resume the same real Preset' }], { signal: AbortSignal.timeout(10000) })
    const child = ctx.agents.get(state.child); assert(child); await child.whenIdle()
    assert.equal(ctx.agentPresets.composedPreset(child.ctx), 'root-planner-worker')
    assert.notEqual(child.id, parentAgent.id)
    assert(!ctx.tools.schemas(scopeOf(child.ctx)).some(tool=>tool.name==='str_replace_editor'),'Unconfigured Creator tools must not appear in the Worker')
    assert(ctx.tools.schemas(scopeOf(child.ctx)).some(tool => tool.name === 'pm_fixture'), 'No Worker Boundary is restored')
    child.followup(createUserMessage({content:[{type:'text',text:'Invoke configured tool'}],source:{kind:'fixture'}}));await child.whenIdle()
    const events=child.session.snapshotEvents(),callEvent=events.findLast(e=>e.type==='tool/call'&&e.data.name==='pm_fixture');assert(callEvent,'Configured Worker tool must actually be called');const returned=events.find(e=>e.type==='tool/result'&&e.data.message?.toolCallId===callEvent.data.callId)?.data.message;assert(returned&&!returned.isError);assert.deepEqual(returned.content,[{type:'text',text:'1'}],'Configured tool must return its real value')
    await ctx.subagents.drainChildren(parentAgent, [child.id])
    if (!restarted) await writeFile(file, JSON.stringify(state))
    result.checks.push('Native Spawn real ID, independent child Session and cold recovery remain compatible after Override')
    const managerEntry = ctx.configEditor.entries().find(entry => entry.options.id === 'dsh-preset-manager')
    assert(managerEntry?.fiber)
    await managerEntry.fiber.dispose()
    assert.equal(ctx.get('dshModes'), undefined)
    assert((await raw({ action: 'list' })).status >= 400, 'Unloaded route must refuse')
    const base = pathToFileURL(join(ctx.configEditor.documentPath, '..', 'package.json')).href
    const remounted = await ctx.plugin(await ctx.loader.internal.import('dsh-preset-manager', base, {}))
    await remounted.await()
    assert((await good('list')).presets.some(p => p.id === 'pm-custom'))
    result.checks.push('Native unload removes service/routes; remount recovers persisted configuration')
    assert.equal(hash(await readFile(source)), sourceHash)
    // Keep an authenticated local preview only in ignored test data; never print credentials.
    if (config.preview && !restarted) await writeFile(join(home, 'preview.json'), JSON.stringify({ loginUrl: ctx.connection.authenticatedUrl(origin + '/'), origin }))
    result.ok = true
  } catch (error) { result.error = { name: error.name, message: error.message, stack: error.stack } }
  finally {
    for (const release of resources.reverse()) await release().catch(() => {})
    await writeFile(join(home, 'result.json'), JSON.stringify(result, null, 2))
  }
}
