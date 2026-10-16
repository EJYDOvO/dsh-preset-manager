/**
 * Host half: one authenticated POST route that lists presets and edits them, and
 * the `dshModes` service that the live persona and `mode_prompt` rows read through.
 *
 * Shipped presets are ordinary `@deepseek-ai/dsh-agent-preset` rows; an edit
 * writes the profile's `cordis.patch.yml` override for that row through
 * `configEditor.edit()`, which validates, persists, and reloads it. User-created
 * presets live in the `dsh-modes-custom` container row (container.js).
 * Running sessions keep the revision they started with; new sessions see edits.
 *
 * Every edit first merges the preset onto the latest built-in rows (rebase.js)
 * with the base recorded in `<profile>/.dsh-modes/state.json` (state.js), so a
 * DSH update reaches an edited preset without discarding the user's changes.
 */
import { dirname, join } from 'node:path'
import { allRowsById, rebase, same, stable } from './rebase.js'
import { HISTORY_LIMIT, StateStore } from './state.js'

const ROUTE = '/api/dsh-modes'
const PRESET_MODULE = '@deepseek-ai/dsh-agent-preset'
const CONTAINER_ID = 'dsh-modes-custom'
const REGISTRY_SETTINGS = 'agent-preset-registry'
const PRESET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const CUSTOM_ORDER_BASE = 100
const PERSONA_MODULE = '@deepseek-ai/dsh-persona'
const LIVE_MODULE = 'dsh-modes/live-persona'
const TOOL_MODULE = 'dsh-modes/prompt-tool'
const TOOL_ROW_ID = 'dsh-modes-prompt-tool'
const PERSONA_MODULES = new Set([PERSONA_MODULE, LIVE_MODULE])
const PROMPT_MAX_CHARS = 20000
const PROMPT_EXCERPT_CHARS = 160
const STATE_DIR = '.dsh-modes'
/** The prompt registry's reference syntax (`dsh-system-prompt` GROUP_AT / VARIABLE_NAME). */
const VARIABLE_GROUP = /^\{\{([^{}]*)\}\}/
const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/
/** One unusable-row line of a preset diagnostic: `<entry id> (<module>): <detail>`. */
const FAILURE_LINE = /^(\S+) \((.+?)\): (.+)$/

/** Rows every non-develop template keeps on: the prompt, time, compaction, and asking the user. */
const TEMPLATE_COMMON = ['persona', 'time-context', 'compaction-basic', 'command-compact', 'tool-result-pruner', 'tool-ask-user']

/**
 * Starter templates for a new mode, built on the shipped `standard` rows.
 * `allow` names the plugin rows kept as shipped; every other row is switched off at
 * creation, so a template never turns on a tool it does not name. `tweaks` merges into
 * a kept row's config. `prompt` replaces the persona prefix; `develop` keeps standard's.
 * Prompts reference only `{{model}}`, which the agent loop registers in every deployment.
 * Rows a later DSH adds to `standard` join a template mode switched off unless `allow` names them.
 */
const TEMPLATES = {
  develop: { base: 'standard' },
  write: {
    base: 'standard',
    allow: [...TEMPLATE_COMMON, 'agent-instructions', 'tool-fs', 'tool-fs-search', 'tool-todo', 'present', 'skill-filesystem', 'tool-skill'],
    prompt: {
      zh: '你是写作助手，由 {{model}} 模型驱动。\n\n只修改用户指定的文件。动笔前先通读相关内容，保持已有的人称、语气和设定一致。\n\n信息不足时直接提问或标注待定，不要自行编造设定；不要改动用户没有提到的段落。\n\n你不能运行命令，所有工作都通过读写文件完成。',
      en: 'You are a writing assistant powered by the {{model}} model.\n\nEdit only the files the user names. Read the relevant text first and keep its voice, tense, and established facts consistent.\n\nWhen information is missing, ask or mark it as undecided instead of inventing it, and leave passages the user did not mention unchanged.\n\nYou cannot run commands; do all work by reading and writing files.',
    },
  },
  chat: {
    base: 'standard',
    allow: [...TEMPLATE_COMMON, 'tool-web'],
    prompt: {
      zh: '你是对话伙伴，由 {{model}} 模型驱动。\n\n回答的长短跟随用户：简短的问题就简短地回答。不要做自我介绍，也不要罗列你能做什么。\n\n需要澄清时一次只问一个问题。需要最新信息时可以搜索网页，并说明来源。\n\n你不能读写文件，也不能运行命令，不要声称做过这些事。',
      en: 'You are a conversation partner powered by the {{model}} model.\n\nMatch the length of your answers to the user: answer short questions briefly. Do not introduce yourself or list what you can do.\n\nAsk at most one clarifying question at a time. When current information matters, search the web and name your sources.\n\nYou cannot read or write files or run commands; never claim that you did.',
    },
  },
  research: {
    base: 'standard',
    allow: [...TEMPLATE_COMMON, 'agent-instructions', 'tool-fs', 'tool-fs-search', 'tool-web', 'tool-todo', 'skill-filesystem', 'tool-skill'],
    tweaks: { 'tool-fs': { write: false, edit: false } },
    prompt: {
      zh: '你是只读调研助手，由 {{model}} 模型驱动。\n\n通过阅读代码、文档和网页回答问题，结论要给出依据：文件路径和行号，或网页链接。区分已确认的事实和推测。\n\n你不能修改文件，也不能运行命令。如果用户要求修改，说明需要切换到可写的模式，并给出具体的修改建议。',
      en: 'You are a read-only research assistant powered by the {{model}} model.\n\nAnswer by reading code, documents, and web pages, and back every conclusion with evidence: file paths and line numbers, or links. Separate confirmed facts from inference.\n\nYou cannot modify files or run commands. When the user asks for a change, say that it needs a writable mode and describe the exact change instead.',
    },
  },
}

export const name = 'dsh-modes'
export const inject = ['agentPresets', 'configEditor']

/** A refusal the page can word in its own locale; `message` is the English fallback. */
class ActionError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

export function apply(ctx) {
  const m = { ctx, store: new StateStore(join(dirname(ctx.configEditor.documentPath), STATE_DIR)) }
  ctx.provide('dshModes', {
    /** Latest saved persona config of a preset, from the loaded configuration; undefined when unknown. */
    persona: id => findPersona(savedRows(ctx, id))?.config,
    /** The preset's saved persona prefix. */
    promptText: async id => ({ prefix: findPersona(presetRows(ctx, id).plugins)?.config?.prefix ?? '' }),
    /** Save a prefix the way the Settings page does; `base` is the prefix the caller read. */
    savePrompt: async (id, prefix, base, source) => {
      await setPrompt(m, id, { prefix }, { prefix: base }, source)
      return { live: findPersona(presetRows(ctx, id).plugins)?.name === LIVE_MODULE }
    },
  })
  ctx.inject(['connection'], (c) => {
    c.effect(() => c.connection.fetch.register({
      path: ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handle(m, request),
    }), 'dsh-modes: route')
  })
}

function reply(body) {
  return Response.json(body, { headers: { 'cache-control': 'no-store' } })
}

const ACTIONS = {
  list: m => list(m),
  read: (m, body) => m.ctx.agentPresets.readDocument(String(body.id)),
  toggle: (m, body) => toggle(m, String(body.id), String(body.rowId), body.enabled === true, body.force === true),
  followPlatform: (m, body) => followPlatform(m, String(body.id), String(body.rowId)),
  resetRow: (m, body) => resetRow(m, String(body.id), String(body.rowId)),
  reset: (m, body) => reset(m, String(body.id)),
  sync: (m, body) => sync(m, String(body.id)),
  repair: (m, body) => repair(m, String(body.id)),
  create: (m, body) => create(m, body),
  update: (m, body) => update(m, body),
  remove: (m, body) => remove(m, String(body.id)),
  usage: (m, body) => usage(m, String(body.id)),
  setDefault: (m, body) => setDefault(m, String(body.id)),
  prompt: (m, body) => readPrompt(m, String(body.id)),
  setPrompt: (m, body) => setPrompt(m, String(body.id), body, body.base, 'page'),
  history: (m, body) => history(m, String(body.id)),
  setLive: (m, body) => setLive(m, String(body.id), body.live === true),
  setPromptTool: (m, body) => setPromptTool(m, String(body.id), body.enabled === true),
}
/** Actions that answer with their own value instead of the refreshed list. */
const READS = new Set(['list', 'read', 'prompt', 'history', 'usage'])

async function handle(m, request) {
  let body
  try {
    body = await request.json()
  } catch {
    return reply({ ok: false, code: 'bad-request', error: 'Request body must be JSON' })
  }
  const action = ACTIONS[body?.action]
  if (action === undefined) return reply({ ok: false, code: 'bad-request', error: `Unknown action: ${String(body?.action)}` })
  try {
    const value = await action(m, body)
    if (READS.has(body.action)) return reply({ ok: true, value })
    return reply({ ok: true, value: { ...await list(m), ...value !== null && typeof value === 'object' ? { effect: value } : {} } })
  } catch (error) {
    return reply({
      ok: false,
      code: error instanceof ActionError ? error.code : 'failed',
      error: error instanceof Error ? error.message : String(error),
      ...error instanceof ActionError && error.details !== undefined ? { details: error.details } : {},
    })
  }
}

function isExpr(value) {
  return value !== null && typeof value === 'object' && typeof value.__jsExpr === 'string'
}

function isOwnModule(name) {
  return typeof name === 'string' && name.startsWith('dsh-modes/')
}

/** Every non-group row with an id, keyed by id; nested group rows included. */
function rowsById(rows, found = new Map()) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.group === true) rowsById(row.config, found)
    else if (typeof row.id === 'string') found.set(row.id, row)
  }
  return found
}

/** Shipped or bundle-declared preset rows, keyed by preset id, with their built-in rows and profile override state. */
function declarations(ctx) {
  const found = new Map()
  for (const { entry, inherited, override } of ctx.configEditor.configuration()) {
    if (entry.options.name !== PRESET_MODULE) continue
    const config = entry.options.config ?? {}
    const builtIn = Array.isArray(inherited.plugins) ? inherited.plugins : []
    found.set(config.id, {
      entry,
      plugins: config.plugins ?? [],
      builtIn,
      inherited: rowsById(builtIn),
      overridden: Object.keys(override).length > 0,
    })
  }
  return found
}

function containerEntry(ctx) {
  const entry = ctx.configEditor.entries().find(candidate => candidate.options.id === CONTAINER_ID)
  if (entry === undefined) throw new ActionError('unavailable', `The ${CONTAINER_ID} row is not loaded`)
  return entry
}

function customPresets(ctx) {
  const presets = containerEntry(ctx).options.config?.presets
  return Array.isArray(presets) ? presets : []
}

/** A preset's saved rows from the loaded configuration, without reading the profile from disk. */
function savedRows(ctx, id) {
  const entries = ctx.configEditor.entries()
  const custom = entries.find(entry => entry.options.id === CONTAINER_ID)?.options.config?.presets
  const own = Array.isArray(custom) ? custom.find(preset => preset.id === id) : undefined
  if (own !== undefined) return own.plugins
  return entries.find(entry => entry.options.name === PRESET_MODULE && entry.options.config?.id === id)?.options.config?.plugins
}

/** Display metadata per module, read from the Plugins page's own inventory; empty when it is not composed. */
async function pluginMeta(ctx) {
  const meta = new Map()
  try {
    const inventory = await ctx.get('pluginInventory')?.list()
    for (const preset of inventory?.agentPresets ?? []) {
      for (const row of preset.rows) if (row.meta !== undefined) meta.set(row.moduleName, row.meta)
    }
  } catch (error) {
    ctx.logger.warn(`plugin metadata unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
  return meta
}

/** Open Agents per preset; persisted sessions that are not loaded are not counted. */
function liveUsage(ctx) {
  const usage = new Map()
  for (const agent of ctx.get('agents')?.list() ?? []) {
    const id = ctx.agentPresets.composedPreset(agent.ctx)
    if (id !== undefined) usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  return usage
}

/** Platform conditions any built-in or recorded base row carries, keyed by row id and module. */
function knownConditions(declared, state) {
  const found = new Map()
  const scan = (rows) => {
    for (const [id, row] of allRowsById(rows)) {
      const key = `${id}\0${row.name}`
      if (isExpr(row.disabled) && !found.has(key)) found.set(key, row.disabled.__jsExpr)
    }
  }
  for (const declaration of declared.values()) scan(declaration.builtIn)
  for (const record of Object.values(state.presets ?? {})) scan(record?.base)
  return found
}

/**
 * The rows a preset diagnostic reports as unusable, keyed by row id.
 * @param {string | undefined} broken - the registry's diagnostic: one `<entry id> (<module>): <detail>` line per row.
 * @param {object[] | undefined} plugins - the preset's rows.
 * @returns {Map<string, string>} row id → first line of its failure.
 */
function parseFailures(broken, plugins) {
  const found = new Map()
  if (typeof broken !== 'string' || plugins === undefined) return found
  const rows = rowsById(plugins)
  for (const line of broken.split('\n')) {
    const match = FAILURE_LINE.exec(line)
    if (match === null) continue
    const id = [...rows.keys()].find(rowId => match[1] === rowId || match[1].endsWith(`:${rowId}`))
    if (id !== undefined && !found.has(id)) found.set(id, match[3])
  }
  return found
}

/** Merge options for one preset: keep the manager's own rows, and switch off rows a template does not allow. */
function mergeOptions(templateId) {
  const allow = templateId === undefined ? undefined : TEMPLATES[templateId]?.allow
  return {
    keep: row => isOwnModule(row.name) || PERSONA_MODULES.has(row.name),
    ...allow === undefined ? {} : { newRow: row => (allow.includes(row.id) ? row : { ...row, disabled: true }) },
  }
}

/**
 * What syncing a preset with the latest built-in rows would change; undefined when it is up to date.
 * Custom presets follow the built-in preset recorded as their origin.
 */
function syncPreview(own, declaration, record, declared) {
  let user
  let latest
  let base
  if (own !== undefined) {
    if (record?.origin === undefined || record.base === undefined) return undefined
    latest = declared.get(record.origin)?.builtIn
    if (latest === undefined) return undefined
    user = own.plugins
    base = record.base
  } else {
    if (declaration?.overridden !== true) return undefined
    user = declaration.plugins
    latest = declaration.builtIn
    base = record?.base
  }
  const result = rebase(user, latest, base, mergeOptions(record?.template))
  if (!result.changed) return undefined
  const describe = rows => id => ({ id, module: allRowsById(rows).get(id)?.name })
  const latestById = allRowsById(latest)
  return {
    origin: record?.origin,
    added: result.summary.added.map(describe(latest)),
    removed: result.summary.removed.map(describe(user)),
    updated: result.summary.updated,
    conflicts: result.summary.conflicts.length,
    kept: [...rowsById(result.rows)].filter(([id, row]) => !latestById.has(id) || !same(row, latestById.get(id))).length,
  }
}

/** Declared rows with their declared and live enablement; nested group rows are flattened. */
function flatten(rows, context, outer = false, group = null, out = []) {
  for (const row of rows) {
    const own = isExpr(row.disabled) ? 'conditional' : Boolean(row.disabled)
    const disabled = outer === true || own === true ? true
      : outer === 'conditional' || own === 'conditional' ? 'conditional' : false
    if (row.group === true) {
      flatten(Array.isArray(row.config) ? row.config : [], context, disabled, typeof row.id === 'string' ? row.id : group, out)
      continue
    }
    const id = typeof row.id === 'string' ? row.id : null
    const mounted = context.live?.find(candidate => candidate.entryId === id || candidate.entryId?.endsWith(`:${String(id)}`))
    const base = id === null ? undefined : context.inherited?.get(id)
    const meta = context.meta.get(row.name)
    const platform = id === null || isExpr(row.disabled) ? undefined : context.conditions.get(`${id}\0${row.name}`)
    const failure = id === null ? undefined : context.failures.get(id)
    out.push({
      id,
      module: row.name,
      group,
      declared: disabled === true ? false : disabled === 'conditional' ? 'conditional' : true,
      inheritedOff: outer === true,
      ...isExpr(row.disabled) ? { condition: row.disabled.__jsExpr } : {},
      ...platform === undefined ? {} : { platform },
      ...mounted === undefined ? {} : { enabled: mounted.enabled },
      ...context.inherited === undefined ? {} : { changed: base === undefined || stable(base) !== stable(row) },
      ...base === undefined ? {} : {
        restorable: true,
        builtIn: isExpr(base.disabled) ? { declared: 'conditional', condition: base.disabled.__jsExpr } : { declared: !base.disabled },
      },
      ...PERSONA_MODULES.has(row.name) ? { essential: true } : {},
      ...row.name === LIVE_MODULE ? { live: true } : {},
      ...isOwnModule(row.name) ? { own: true } : {},
      ...failure === undefined ? {} : { failure },
      ...row.config === undefined ? {} : { config: row.config },
      ...meta === undefined ? {} : { meta: { title: meta.title, description: meta.description, icon: meta.icon } },
    })
  }
  return out
}

async function readState(m) {
  try {
    return { state: await m.store.read('state') }
  } catch (error) {
    return { state: { presets: {} }, stateError: error instanceof Error ? error.message : String(error) }
  }
}

async function list(m) {
  const { ctx } = m
  const presets = ctx.agentPresets
  const [roster, inventory, meta, { state, stateError }] = await Promise.all([presets.list(), presets.compositionInventory(), pluginMeta(ctx), readState(m)])
  const live = new Map(inventory.map(item => [item.id, item.rows]))
  const diagnostics = new Map(inventory.map(item => [item.id, item.broken]))
  const declared = declarations(ctx)
  const custom = new Map(customPresets(ctx).map(preset => [preset.id, preset]))
  const usage = liveUsage(ctx)
  const conditions = knownConditions(declared, state)
  const rows = roster.map((row) => {
    const declaration = declared.get(row.id)
    const own = custom.get(row.id)
    const plugins = own?.plugins ?? declaration?.plugins
    const failures = parseFailures(row.broken ?? diagnostics.get(row.id), plugins)
    const flat = plugins === undefined ? [] : flatten(plugins, {
      live: live.get(row.id),
      meta,
      conditions,
      failures,
      ...declaration === undefined ? {} : { inherited: declaration.inherited },
    })
    const persona = plugins === undefined ? undefined : findPersona(plugins)
    const prefix = persona?.config?.prefix
    const sync = own === undefined && declaration === undefined ? undefined : syncPreview(own, declaration, state.presets[row.id], declared)
    return {
      ...row,
      isDefault: row.id === presets.defaultId,
      source: own !== undefined ? 'custom' : declaration === undefined ? 'external' : declaration.overridden ? 'overridden' : 'builtin',
      usage: usage.get(row.id) ?? 0,
      ...typeof prefix === 'string' ? { promptExcerpt: prefix.slice(0, PROMPT_EXCERPT_CHARS) } : {},
      ...persona?.name === LIVE_MODULE ? { live: true } : {},
      ...rowsById(plugins).get(TOOL_ROW_ID)?.disabled === undefined && rowsById(plugins).has(TOOL_ROW_ID) ? { promptTool: true } : {},
      ...failures.size === 0 ? {} : { failures: [...failures].map(([rowId, detail]) => ({ rowId, detail })) },
      ...sync === undefined ? {} : { sync },
      rows: flat,
    }
  })
  const registered = new Set(roster.map(row => row.id))
  for (const [id, preset] of custom) {
    if (!registered.has(id)) {
      rows.push({ id, name: preset.name, source: 'custom', isDefault: false, usage: 0, rows: [], broken: 'Not registered: the id is taken or the definition is invalid (see the Host log)' })
    }
  }
  // Counted from the base preset's live mount, so platform conditions resolve as they do on this host.
  const templates = Object.entries(TEMPLATES).flatMap(([id, template]) => {
    if (!declared.has(template.base)) return []
    const allowed = entryId => template.allow === undefined || template.allow.some(row => entryId === row || entryId?.endsWith(`:${row}`))
    const on = (live.get(template.base) ?? []).filter(row => row.enabled === true && allowed(row.entryId)).length
    return [{ id, base: template.base, on }]
  })
  return {
    presets: rows,
    templates,
    defaultId: presets.defaultId,
    canSetDefault: ctx.get('settings') !== undefined,
    ...stateError === undefined ? {} : { stateError },
  }
}

/**
 * A template's row list: rows outside `allow` switched off (a `!!js` condition included),
 * kept rows merged with their `tweaks`, and the persona prefix replaced when the template
 * carries a prompt. `develop` returns the base rows unchanged.
 * @param {object[]} rows - the base preset's declared rows.
 * @param {object} template - one {@link TEMPLATES} entry.
 * @param {string} [prompt] - the localized prompt to install.
 * @returns {object[]} a detached row list.
 */
function applyTemplate(rows, template, prompt) {
  const visit = list => list.map((row) => {
    if (row.group === true && Array.isArray(row.config)) return { ...row, config: visit(row.config) }
    if (template.allow === undefined) return row
    if (!template.allow.includes(row.id)) return { ...row, disabled: true }
    const tweak = template.tweaks?.[row.id]
    const next = tweak === undefined ? row : { ...row, config: { ...row.config, ...tweak } }
    return prompt !== undefined && PERSONA_MODULES.has(row.name) ? { ...next, config: { ...next.config, prefix: prompt } } : next
  })
  return visit(structuredClone(rows))
}

/** Copy of a row list with the row `rowId` replaced by `replace(row)`. */
function replaceRow(rows, rowId, replace) {
  let found = false
  const visit = list => list.map((row) => {
    if (found) return row
    if (row.group === true && Array.isArray(row.config)) return { ...row, config: visit(row.config) }
    if (row.id !== rowId) return row
    found = true
    return replace(row)
  })
  const result = visit(rows)
  if (!found) throw new ActionError('not-found', `No row ${rowId} in this preset`, { rowId })
  return result
}

/** Copy of a row list without the row `rowId`. */
function removeRow(rows, rowId) {
  return rows
    .filter(row => row.id !== rowId)
    .map(row => (row.group === true && Array.isArray(row.config) ? { ...row, config: removeRow(row.config, rowId) } : row))
}

/**
 * Switch one row on or off with a literal value.
 * @param {boolean} force - replace a platform condition (`!!js`) with the literal; without it such a row is refused.
 */
function withDisabled(rows, rowId, disabled, force) {
  return replaceRow(rows, rowId, (row) => {
    if (isExpr(row.disabled) && !force) {
      throw new ActionError('conditional-row', `Row ${rowId} is enabled by a condition (${row.disabled.__jsExpr}); pass force to replace it`, { rowId, condition: row.disabled.__jsExpr })
    }
    const next = { ...row }
    if (disabled) next.disabled = true
    else delete next.disabled
    return next
  })
}

async function recordState(m, change) {
  try {
    await m.store.update('state', change)
  } catch (error) {
    m.ctx.logger.warn(`could not record merge base: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Apply `change` to one preset's row list, in the container for custom presets or the profile override otherwise.
 * The rows are first merged onto the latest built-in rows, and the base of that merge is recorded.
 * @returns {Promise<{synced?: object}>} the merge summary when the merge changed the rows.
 */
async function editPlugins(m, id, change) {
  const { ctx } = m
  const state = await m.store.read('state')
  const record = state.presets[id]
  const declared = declarations(ctx)
  let synced
  if (customPresets(ctx).some(preset => preset.id === id)) {
    const latest = record?.origin === undefined || record.base === undefined ? undefined : declared.get(record.origin)?.builtIn
    await ctx.configEditor.edit(containerEntry(ctx), current => ({
      ...current,
      presets: current.presets.map((preset) => {
        if (preset.id !== id) return preset
        let rows = preset.plugins
        if (latest !== undefined) {
          const merged = rebase(rows, latest, record.base, mergeOptions(record.template))
          if (merged.changed) synced = merged.summary
          rows = merged.rows
        }
        return { ...preset, plugins: change(rows, undefined) }
      }),
    }))
    if (latest !== undefined && !same(latest, record.base)) await recordState(m, (next) => { next.presets[id] = { ...next.presets[id], base: latest } })
    return synced === undefined ? {} : { synced }
  }
  const declaration = declared.get(id)
  if (declaration === undefined) throw new ActionError('not-editable', `Preset ${id} is not declared in an editable row`, { id })
  let builtIn
  let rows
  await ctx.configEditor.edit(declaration.entry, (current, inherited) => {
    builtIn = Array.isArray(inherited.plugins) ? inherited.plugins : []
    let base = Array.isArray(current.plugins) ? current.plugins : builtIn
    if (!same(base, builtIn)) {
      const merged = rebase(base, builtIn, record?.base, mergeOptions())
      if (merged.changed) synced = merged.summary
      base = merged.rows
    }
    rows = change(base, builtIn)
    return { ...current, plugins: rows }
  })
  await recordState(m, (next) => {
    if (same(rows, builtIn)) delete next.presets[id]
    else next.presets[id] = { ...next.presets[id], base: builtIn }
  })
  return synced === undefined ? {} : { synced }
}

function toggle(m, id, rowId, enabled, force) {
  return editPlugins(m, id, rows => withDisabled(rows, rowId, !enabled, force))
}

/** Give a row back its platform condition, taken from a built-in or recorded base row with the same id and module. */
async function followPlatform(m, id, rowId) {
  const { state } = await readState(m)
  const conditions = knownConditions(declarations(m.ctx), state)
  return editPlugins(m, id, rows => replaceRow(rows, rowId, (row) => {
    const condition = conditions.get(`${rowId}\0${row.name}`)
    if (condition === undefined) throw new ActionError('no-condition', `No platform condition is known for row ${rowId}`, { rowId })
    return { ...row, disabled: { __jsExpr: condition } }
  }))
}

async function resetRow(m, id, rowId) {
  let before
  let after
  const result = await editPlugins(m, id, (rows, inherited) => {
    const original = rowsById(inherited).get(rowId)
    if (original === undefined) throw new ActionError('not-restorable', `Row ${rowId} has no built-in definition`, { rowId })
    const current = rowsById(rows).get(rowId)
    if (PERSONA_MODULES.has(current?.name)) {
      before = promptFields(current)
      after = promptFields(original)
    }
    return replaceRow(rows, rowId, () => original)
  })
  if (before !== undefined) await recordHistory(m, id, before, after, 'restore')
  return result
}

async function reset(m, id) {
  const declaration = declarations(m.ctx).get(id)
  if (declaration?.overridden !== true) throw new ActionError('not-overridden', `Preset ${id} has no profile override`, { id })
  const before = promptFields(findPersona(declaration.plugins))
  await m.ctx.configEditor.edit(declaration.entry, (_current, inherited) => inherited)
  await recordState(m, (next) => { delete next.presets[id] })
  await recordHistory(m, id, before, promptFields(findPersona(declaration.builtIn)), 'restore')
}

async function sync(m, id) {
  const result = await editPlugins(m, id, rows => rows)
  if (result.synced === undefined) throw new ActionError('up-to-date', `Preset ${id} already includes the latest built-in rows`, { id })
  return result
}

/** Switch off every row the registry reports as unusable for this preset. */
async function repair(m, id) {
  const roster = await m.ctx.agentPresets.list()
  const failures = parseFailures(roster.find(row => row.id === id)?.broken, presetRows(m.ctx, id).plugins)
  if (failures.size === 0) throw new ActionError('nothing-to-repair', `Preset ${id} has no unusable rows`, { id })
  await editPlugins(m, id, rows => [...failures.keys()].reduce((next, rowId) => withDisabled(next, rowId, true, true), rows))
  return { repaired: [...failures.keys()] }
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Point copied live persona rows at the preset that now owns them. */
function retarget(rows, id) {
  const visit = list => list.map((row) => {
    if (row.group === true && Array.isArray(row.config)) return { ...row, config: visit(row.config) }
    return row.name === LIVE_MODULE ? { ...row, config: { ...row.config, preset: id } } : row
  })
  return visit(rows)
}

/**
 * Create a custom preset from a starter template, or as a copy of an existing preset.
 * The new preset records the built-in preset it follows, so later DSH updates can be merged into it.
 * @param {object} m - manager context and state store.
 * @param {{id: string, name?: string, description?: string, template?: string, from?: string, locale?: string}} request -
 *   `template` names a {@link TEMPLATES} entry; otherwise `from` names the preset to copy (default `standard`).
 */
async function create(m, { id, name, description, template, from, locale }) {
  const { ctx } = m
  if (typeof id !== 'string' || !PRESET_ID.test(id)) throw new ActionError('invalid-id', 'Use 1-40 lowercase letters, digits, or hyphens for the id')
  const roster = await ctx.agentPresets.list()
  const custom = customPresets(ctx)
  if (roster.some(row => row.id === id) || custom.some(preset => preset.id === id)) throw new ActionError('exists', `Preset ${id} already exists`, { id })
  const declared = declarations(ctx)
  const { state } = await readState(m)
  let plugins
  let origin
  if (template !== undefined) {
    const starter = TEMPLATES[template]
    if (starter === undefined) throw new ActionError('not-found', `Unknown template ${String(template)}`, { id: template })
    const base = declared.get(starter.base)
    if (base === undefined) throw new ActionError('not-found', `Template base ${starter.base} is not available`, { id: starter.base })
    const prompt = starter.prompt === undefined ? undefined : starter.prompt[locale === 'zh' ? 'zh' : 'en']
    plugins = applyTemplate(base.builtIn, starter, prompt)
    origin = { origin: starter.base, template, base: base.builtIn }
  } else {
    const source = String(from ?? 'standard')
    const own = custom.find(preset => preset.id === source)
    const copied = own?.plugins ?? declared.get(source)?.plugins
    if (copied === undefined) throw new ActionError('not-found', `Template preset ${source} is not available`, { id: source })
    plugins = structuredClone(copied)
    const sourceRecord = state.presets[source]
    origin = own !== undefined
      ? sourceRecord?.origin === undefined ? undefined : { origin: sourceRecord.origin, ...sourceRecord.template === undefined ? {} : { template: sourceRecord.template }, base: sourceRecord.base }
      : { origin: source, base: declared.get(source).builtIn }
  }
  const preset = {
    id,
    ...text(name) === undefined ? {} : { name: text(name) },
    ...text(description) === undefined ? {} : { description: text(description) },
    order: CUSTOM_ORDER_BASE + custom.length,
    plugins: retarget(plugins, id),
  }
  await ctx.configEditor.edit(containerEntry(ctx), current => ({ ...current, presets: [...(current.presets ?? []), preset] }))
  if (origin !== undefined && origin.base !== undefined) await recordState(m, (next) => { next.presets[id] = origin })
}

async function update(m, { id, name, description }) {
  if (!customPresets(m.ctx).some(preset => preset.id === id)) throw new ActionError('not-custom', `Preset ${String(id)} is not a custom preset`, { id })
  await m.ctx.configEditor.edit(containerEntry(m.ctx), current => ({
    ...current,
    presets: current.presets.map((preset) => {
      if (preset.id !== id) return preset
      const next = { ...preset }
      delete next.name
      delete next.description
      return { ...next, ...text(name) === undefined ? {} : { name: text(name) }, ...text(description) === undefined ? {} : { description: text(description) } }
    }),
  }))
}

async function remove(m, id) {
  const { ctx } = m
  if (!customPresets(ctx).some(preset => preset.id === id)) throw new ActionError('not-custom', `Preset ${id} is not a custom preset`, { id })
  if (ctx.agentPresets.defaultId === id) throw new ActionError('is-default', `Preset ${id} is the default for new sessions; choose another default first`, { id })
  await ctx.configEditor.edit(containerEntry(ctx), current => ({ ...current, presets: current.presets.filter(preset => preset.id !== id) }))
  await recordState(m, (next) => { delete next.presets[id] })
  try {
    await m.store.update('history', (next) => { delete next.presets[id] })
  } catch (error) {
    ctx.logger.warn(`could not drop prompt history of ${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** How long a usage count may read session logs before it reports a partial count. */
const USAGE_SCAN_MS = 8000
const USAGE_SCAN_WORKERS = 6

/** The preset a saved session runs: its last blank-session selection, else the one it was created with. */
async function sessionPreset(query, record) {
  let preset = record.header?.agentPreset
  try {
    const snapshot = await query.readSession(record.header.id)
    for (const event of snapshot.events) {
      if (event.type === 'agent-preset/selected' && typeof event.data?.agentPreset === 'string') preset = event.data.agentPreset
    }
  } catch {
    // An unreadable log keeps the preset its header names; the count stays a lower bound for that session.
  }
  return preset
}

/**
 * Sessions that use a preset: those open now, and saved top-level sessions whose log composes it.
 * @returns {Promise<{open: number, saved?: number, partial?: true}>} `saved` is absent when the session
 *   query service is not composed; `partial` marks a count cut short by the scan time limit.
 */
async function usage(m, id) {
  const open = liveUsage(m.ctx).get(id) ?? 0
  const query = m.ctx.get('sessionQuery')
  if (query === undefined) return { open }
  let records
  try {
    records = (await query.listSessions()).filter(record => record.header?.origin !== 'subagent')
  } catch (error) {
    m.ctx.logger.warn(`session list unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return { open }
  }
  const deadline = Date.now() + USAGE_SCAN_MS
  const queue = [...records]
  let saved = 0
  let scanned = 0
  const worker = async () => {
    while (queue.length > 0 && Date.now() < deadline) {
      const record = queue.shift()
      if (await sessionPreset(query, record) === id) saved++
      scanned++
    }
  }
  await Promise.all(Array.from({ length: USAGE_SCAN_WORKERS }, worker))
  return { open, saved, ...scanned < records.length ? { partial: true } : {} }
}

async function setDefault(m, id) {
  const settings = m.ctx.get('settings')
  if (settings === undefined) throw new ActionError('unavailable', 'The settings service is not composed')
  const preset = (await m.ctx.agentPresets.list()).find(row => row.id === id)
  if (preset === undefined) throw new ActionError('not-found', `Unknown preset ${id}`, { id })
  if (preset.broken !== undefined) throw new ActionError('broken', `Preset ${id} cannot compose a session`, { id })
  await settings.update(REGISTRY_SETTINGS, { selectedDefault: id })
}

/** The first persona row (official or live), which owns the prompt; nested group rows included. */
function findPersona(rows) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.group === true) {
      const nested = findPersona(row.config)
      if (nested !== undefined) return nested
    } else if (PERSONA_MODULES.has(row.name)) return row
  }
  return undefined
}

/** A persona row's prompt settings, with the persona schema's defaults filled in. */
function promptFields(row) {
  const config = row?.config ?? {}
  return {
    prefix: typeof config.prefix === 'string' ? config.prefix : '',
    suffix: typeof config.suffix === 'string' ? config.suffix : '',
    complete: config.complete === true,
    includeRuntimeContext: config.includeRuntimeContext !== false,
  }
}

/**
 * The first reference the prompt registry would refuse to render, mirroring
 * `dsh-system-prompt` interpolation: a render failure fails every model step.
 * @param text - persona prefix or suffix template.
 * @param variables - names registered for the preset's scope, or undefined when unknown.
 * @returns the refusal, or undefined when the template renders.
 */
function templateProblem(text, variables) {
  let last = 0
  for (let open = text.indexOf('{{'); open >= 0; open = text.indexOf('{{', last)) {
    const group = VARIABLE_GROUP.exec(text.slice(open))
    if (group === null) {
      if (text.indexOf('}}', open + 2) >= 0) return { code: 'prompt-malformed', reference: text.slice(open, open + 16) }
      last = open + 2
      continue
    }
    const name = group[1]
    if (!VARIABLE_NAME.test(name)) return { code: 'prompt-malformed', reference: group[0] }
    if (variables !== undefined && !variables.includes(name)) return { code: 'prompt-unknown-variable', reference: group[0], variables }
    last = open + group[0].length
  }
  return undefined
}

/** Render assembled sections like `renderPrompt`, keeping references with no value in this preview visible. */
function renderPreview(assembly) {
  return assembly.sections
    .map(section => section.interpolate === false
      ? section.text
      : section.text.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (match, name) => assembly.variables[name] ?? match))
    .filter(text => text.length > 0)
    .join('\n\n')
}

/** Assemble the preset's current revision without an Agent: its sections, variables, and complete-prompt state. */
async function assemblePreset(ctx, id) {
  const prompts = ctx.get('systemPrompt')
  if (prompts === undefined) return { error: 'The system prompt service is not composed' }
  let lease
  try {
    lease = await ctx.agentPresets.acquireScope(id)
    const assembly = await prompts.assemble({ scope: lease.key })
    return { variables: Object.keys(assembly.variables).sort(), preview: renderPreview(assembly) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    await lease?.[Symbol.asyncDispose]()
  }
}

/** Locate a preset's row list and, for a declared preset, its built-in rows. */
function presetRows(ctx, id) {
  const own = customPresets(ctx).find(preset => preset.id === id)
  if (own !== undefined) return { plugins: own.plugins, custom: true }
  const declaration = declarations(ctx).get(id)
  if (declaration === undefined) throw new ActionError('not-editable', `Preset ${id} is not declared in an editable row`, { id })
  return { plugins: declaration.plugins, inherited: declaration.inherited, overridden: declaration.overridden }
}

async function readPrompt(m, id) {
  const { plugins, inherited, overridden } = presetRows(m.ctx, id)
  const persona = findPersona(plugins)
  const original = persona?.id === undefined ? undefined : inherited?.get(persona.id)
  const assembled = await assemblePreset(m.ctx, id)
  const tool = rowsById(plugins).get(TOOL_ROW_ID)
  return {
    id,
    ...persona === undefined ? {} : {
      rowId: persona.id ?? null,
      ...promptFields(persona),
      off: persona.disabled === true,
      live: persona.name === LIVE_MODULE,
    },
    promptTool: tool !== undefined && tool.disabled === undefined,
    ...original === undefined ? {} : {
      builtIn: promptFields(original),
      builtInPrefix: promptFields(original).prefix,
      changed: overridden === true && !same(promptFields(original), promptFields(persona)),
    },
    ...assembled,
  }
}

/** Append one prompt change to the preset's history, recording an unseen earlier version first. */
async function recordHistory(m, id, before, after, source) {
  const texts = fields => ({ prefix: fields.prefix, suffix: fields.suffix })
  if (before === undefined || after === undefined || same(texts(before), texts(after))) return
  try {
    await m.store.update('history', (next) => {
      const entries = next.presets[id] ??= []
      const last = entries.at(-1)
      const now = Date.now()
      if (last === undefined || !same(texts(last), texts(before))) entries.push({ at: now - 1, source: last === undefined ? 'initial' : 'external', ...texts(before) })
      entries.push({ at: now, source, ...texts(after) })
      if (entries.length > HISTORY_LIMIT) entries.splice(0, entries.length - HISTORY_LIMIT)
    })
  } catch (error) {
    m.ctx.logger.warn(`could not record prompt history of ${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** The preset's recorded prompt versions, newest first, beside its current prompt. */
async function history(m, id) {
  const { plugins } = presetRows(m.ctx, id)
  const current = promptFields(findPersona(plugins))
  const entries = (await m.store.read('history')).presets[id] ?? []
  return { id, current: { prefix: current.prefix, suffix: current.suffix }, entries: [...entries].reverse() }
}

/**
 * Save a preset's persona prompt settings after checking that its texts render.
 * @param {object} m - manager context and state store.
 * @param {string} id - preset id.
 * @param {{prefix: unknown, suffix?: unknown, complete?: unknown, includeRuntimeContext?: unknown}} fields - the new settings;
 *   omitted optional fields keep their stored value.
 * @param {unknown} base - the settings the editor started from (a string is a prefix); a stored value that has
 *   changed since refuses the save with `prompt-conflict`, so a stale editor cannot overwrite it.
 * @param {string} source - who saved it, for the history: `page` or `chat`.
 * @returns {Promise<{synced?: object}>} the built-in merge summary when the save also merged a built-in update.
 */
async function setPrompt(m, id, fields, base, source) {
  const next = { prefix: fields.prefix }
  if (typeof next.prefix !== 'string') throw new ActionError('bad-request', 'The prompt must be text')
  if (fields.suffix !== undefined) {
    if (typeof fields.suffix !== 'string') throw new ActionError('bad-request', 'The suffix must be text')
    next.suffix = fields.suffix
  }
  if (fields.complete !== undefined) next.complete = fields.complete === true
  if (fields.includeRuntimeContext !== undefined) next.includeRuntimeContext = fields.includeRuntimeContext !== false
  for (const value of [next.prefix, next.suffix]) {
    if (typeof value === 'string' && value.length > PROMPT_MAX_CHARS) throw new ActionError('prompt-too-long', `The prompt exceeds ${PROMPT_MAX_CHARS} characters`, { max: PROMPT_MAX_CHARS })
  }
  const { variables } = await assemblePreset(m.ctx, id)
  for (const value of [next.prefix, next.suffix]) {
    const problem = typeof value === 'string' ? templateProblem(value, variables) : undefined
    if (problem !== undefined) {
      throw new ActionError(problem.code, `The prompt cannot render: ${problem.reference}${problem.variables === undefined ? '' : ` (registered variables: ${problem.variables.join(', ')})`}`, problem)
    }
  }
  const expected = typeof base === 'string' ? { prefix: base } : base !== null && typeof base === 'object' ? base : undefined
  let before
  let after
  const result = await editPlugins(m, id, (rows, inherited) => {
    const persona = findPersona(rows)
    const stored = promptFields(persona)
    if (expected !== undefined) {
      const stale = Object.keys(next).filter(key => expected[key] !== undefined && !same(stored[key], expected[key]) && !same(stored[key], next[key]))
      if (stale.length > 0) throw new ActionError('prompt-conflict', 'The prompt was changed elsewhere after you started editing; reload it or overwrite it', { current: stored.prefix, stored, fields: stale })
    }
    before = stored
    after = { ...stored, ...next }
    if (persona === undefined) return [{ id: 'persona', name: PERSONA_MODULE, config: withPromptFields({}, next, undefined) }, ...rows]
    if (persona.id === undefined) throw new ActionError('not-found', 'The persona row has no id, so it cannot be edited here')
    const original = rowsById(inherited).get(persona.id)
    return replaceRow(rows, persona.id, row => ({ ...row, config: withPromptFields(row.config ?? {}, next, original?.config) }))
  })
  await recordHistory(m, id, before, after, source)
  return result
}

/** Persona schema defaults for the optional prompt settings. */
const PROMPT_DEFAULTS = { suffix: '', complete: false, includeRuntimeContext: true }

/**
 * Merge prompt settings into a persona config. A setting equal to its schema default is written only
 * when the built-in row spells it out, so an untouched default keeps following the built-in row.
 */
function withPromptFields(config, fields, builtIn) {
  const out = { ...config }
  for (const [key, value] of Object.entries(fields)) {
    if (Object.hasOwn(PROMPT_DEFAULTS, key) && same(value, PROMPT_DEFAULTS[key]) && !Object.hasOwn(builtIn ?? {}, key)) delete out[key]
    else out[key] = value
  }
  return out
}

/** Swap the preset's persona row between the official module and the live one. */
function setLive(m, id, live) {
  return editPlugins(m, id, (rows) => {
    const persona = findPersona(rows)
    if (persona?.id === undefined) throw new ActionError('not-found', 'This mode has no persona row with an id', { id })
    return replaceRow(rows, persona.id, (row) => {
      const { preset: _preset, ...config } = row.config ?? {}
      const prompt = { ...config, prefix: typeof config.prefix === 'string' ? config.prefix : '' }
      return live ? { ...row, name: LIVE_MODULE, config: { ...prompt, preset: id } } : { ...row, name: PERSONA_MODULE, config: prompt }
    })
  })
}

/** Add or remove the `mode_prompt` tool row. */
function setPromptTool(m, id, enabled) {
  return editPlugins(m, id, (rows) => {
    const present = rowsById(rows).has(TOOL_ROW_ID)
    if (!enabled) return present ? removeRow(rows, TOOL_ROW_ID) : rows
    return present ? withDisabled(rows, TOOL_ROW_ID, false, true) : [...rows, { id: TOOL_ROW_ID, name: TOOL_MODULE }]
  })
}
