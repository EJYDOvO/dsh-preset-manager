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
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { allRowsById, rebase, same, stable } from './rebase.js'
import { HISTORY_LIMIT, StateStore } from './state.js'
import { applyWrites, catalogEntries, overridesOf, planEdits, planRestore } from './tool-edit.js'
import { CHECK_ERROR_TTL_MS, CHECK_TTL_MS, PACKAGE_NAME, commands, fetchLatest, isNewer, registryBases, sourceKind } from './update.js'

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
const DESCRIPTIONS_MODULE = 'dsh-modes/tool-descriptions'
const DESCRIPTIONS_ROW_ID = 'dsh-modes-tool-descriptions'
/** The version this plugin runs, read once from its own package.json. */
const PACKAGE_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
  } catch {
    // The package.json beside this file is unreadable; the page then reports an unknown version and offers no upgrade.
    return 'unknown'
  }
})()
/** How many lines of the installer's output a failed upgrade keeps. */
const UPGRADE_LOG_LINES = 12
/** How long one mode's tool scan is reused; the Refresh button and a changed row list bypass it. */
const SCAN_TTL_MS = 5 * 60 * 1000
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
  const m = { ctx, store: new StateStore(join(dirname(ctx.configEditor.documentPath), STATE_DIR)), toolsFile: undefined, scans: new Map(), seen: new Map(), check: undefined, upgrade: undefined }
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
    /** The saved tool description overrides of a preset: tool name → text. */
    toolDescriptions: async id => new Map([...overridesOf(await readTools(m)).get(id) ?? []].map(([tool, override]) => [tool, override.text])),
    /** Remember the tool descriptions a preset's request carried, so the page can list tools a registry scan cannot see. */
    observeTools: (id, tools) => observeTools(m, id, tools),
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
  applyRows: (m, body) => applyRows(m, String(body.id), body.changes),
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
  tools: async (m, body) => ({ presets: (await toolCatalog(m, body.refresh === true)).catalog }),
  setToolDescriptions: (m, body) => setToolDescriptions(m, body),
  restoreToolDescriptions: (m, body) => restoreToolDescriptions(m, body),
  updateStatus: (m, body) => updateStatus(m, body.refresh === true),
  upgradeStatus: m => publicUpgrade(m.upgrade),
  setUpdateCheck: async (m, body) => {
    await m.store.update('settings', (current) => { current.checkUpdates = body.enabled === true })
    return updateStatus(m, false)
  },
  upgrade: (m, body) => startUpgrade(m, body),
  cancelUpgrade: m => cancelUpgrade(m),
}
/** Actions that answer with their own value instead of the refreshed list. */
const READS = new Set(['list', 'read', 'prompt', 'history', 'usage', 'tools', 'updateStatus', 'upgradeStatus', 'setUpdateCheck', 'upgrade', 'cancelUpgrade'])

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
    const shipped = base ?? (id === null ? undefined : context.origin?.get(id))
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
      ...shipped === undefined ? {} : { shipped: isExpr(shipped.disabled) ? 'conditional' : shipped.disabled ? 'off' : 'on' },
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
  let toolEdits = new Map()
  let toolsError
  try {
    toolEdits = overridesOf(await readTools(m))
  } catch (error) {
    toolsError = error instanceof Error ? error.message : String(error)
  }
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
      ...own !== undefined && Array.isArray(state.presets[row.id]?.base) ? { origin: rowsById(state.presets[row.id].base) } : {},
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
      ...toolEdits.has(row.id) ? { toolEdits: toolEdits.get(row.id).size } : {},
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
    ...toolsError === undefined ? {} : { toolsError },
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

/** Copy of a row list with every group that contains `rowId` and is switched off by a literal switched back on. */
function enableGroupsOf(rows, rowId) {
  return rows.map((row) => {
    if (row.group !== true || !Array.isArray(row.config) || !rowsById(row.config).has(rowId)) return row
    const next = { ...row, config: enableGroupsOf(row.config, rowId) }
    if (next.disabled === true) delete next.disabled
    return next
  })
}

/**
 * Change several rows of one preset in a single save, for capability switches.
 * @param {object} m - manager context and state store.
 * @param {string} id - preset id.
 * @param {unknown} changes - `{rowId, enabled?, platform?, config?}` items: `enabled` sets a literal switch (replacing a
 *   platform condition), `platform: true` restores the row's known platform condition, and `config` sets keys, where
 *   `null` returns a key to its built-in value (or removes it). Switching a row on also switches on a group that
 *   contains it.
 * @returns {Promise<{synced?: object}>} the built-in merge summary when the save also merged a built-in update.
 */
async function applyRows(m, id, changes) {
  if (!Array.isArray(changes) || changes.length === 0) throw new ActionError('bad-request', 'changes must be a non-empty list')
  const { state } = await readState(m)
  const conditions = knownConditions(declarations(m.ctx), state)
  return editPlugins(m, id, (rows, inherited) => {
    const builtIn = rowsById(inherited)
    let next = rows
    for (const change of changes) {
      const rowId = String(change?.rowId)
      next = replaceRow(next, rowId, (row) => {
        const out = { ...row }
        if (change.platform === true) {
          const condition = conditions.get(`${rowId}\0${row.name}`)
          if (condition === undefined) throw new ActionError('no-condition', `No platform condition is known for row ${rowId}`, { rowId })
          out.disabled = { __jsExpr: condition }
        } else if (typeof change.enabled === 'boolean') {
          if (change.enabled) delete out.disabled
          else out.disabled = true
        }
        if (change.config !== null && typeof change.config === 'object') {
          const config = { ...out.config ?? {} }
          const original = builtIn.get(rowId)?.config ?? {}
          for (const [key, value] of Object.entries(change.config)) {
            if (value !== null) config[key] = value
            else if (Object.hasOwn(original, key)) config[key] = original[key]
            else delete config[key]
          }
          if (Object.keys(config).length === 0 && builtIn.get(rowId)?.config === undefined) delete out.config
          else out.config = config
        }
        return out
      })
      if (change.enabled === true || change.platform === true) next = enableGroupsOf(next, rowId)
    }
    return next
  })
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
  await dropTools(m, id)
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

/** Point copied live persona and tool description rows at the preset that now owns them. */
function retarget(rows, id) {
  const visit = list => list.map((row) => {
    if (row.group === true && Array.isArray(row.config)) return { ...row, config: visit(row.config) }
    return row.name === LIVE_MODULE || row.name === DESCRIPTIONS_MODULE ? { ...row, config: { ...row.config, preset: id } } : row
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
  if (template === undefined) await copyTools(m, String(from ?? 'standard'), id)
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
  await dropTools(m, id)
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

/** The tool description overrides file; read once, and again after each write this manager makes. */
async function readTools(m) {
  m.toolsFile ??= await m.store.read('tools')
  return m.toolsFile
}

/** Change the overrides file; the next read sees the written content. */
async function updateTools(m, change) {
  try {
    await m.store.update('tools', change)
  } finally {
    m.toolsFile = undefined
  }
}

/** Remember the descriptions one preset's request carried, for tools a registry scan does not list. */
function observeTools(m, id, tools) {
  const seen = m.seen.get(id) ?? new Map()
  for (const tool of tools) {
    if (tool.name !== 'run_code' && typeof tool.description === 'string') seen.set(tool.name, tool.description)
  }
  m.seen.set(id, seen)
}

/**
 * The tools one preset registers and whether it presents them as code (`run_code`), read from a scope the registry
 * mounts for the preset and releases again; no session is needed. A scan is reused while the preset's rows are unchanged.
 * @param {object} m - manager context and caches.
 * @param {string} id - preset id.
 * @param {string} fingerprint - a stable text of the preset's rows; a different one forces a new scan.
 * @param {boolean} refresh - scan again whatever the cache holds.
 * @returns {Promise<{ ptc: boolean, tools: Map<string, string> }>} tool name → built-in description.
 */
async function scanPreset(m, id, fingerprint, refresh) {
  const cached = m.scans.get(id)
  if (!refresh && cached !== undefined && cached.fingerprint === fingerprint && Date.now() - cached.at < SCAN_TTL_MS) return cached.value
  const tools = m.ctx.get('tools')
  if (tools === undefined) throw new ActionError('unavailable', 'The tool registry is not available')
  const lease = await m.ctx.agentPresets.acquireScope(id)
  let schemas
  try {
    schemas = tools.schemas(lease.key)
  } finally {
    await lease[Symbol.asyncDispose]()
  }
  const value = {
    ptc: schemas.some(schema => schema.name === 'run_code'),
    tools: new Map(schemas.filter(schema => schema.name !== 'run_code').map(schema => [schema.name, schema.description])),
  }
  m.scans.set(id, { fingerprint, at: Date.now(), value })
  return value
}

/**
 * Every preset's tools with their overrides, for the page, and the same facts as the planner needs them.
 * @param {object} m - manager context and caches.
 * @param {boolean} refresh - scan every preset again.
 * @returns {Promise<{ catalog: object[], planning: Map<string, object> }>} `catalog` is what the page shows.
 */
async function toolCatalog(m, refresh = false) {
  const { ctx } = m
  const roster = await ctx.agentPresets.list()
  const declared = declarations(ctx)
  const custom = new Map(customPresets(ctx).map(preset => [preset.id, preset]))
  const content = await readTools(m)
  const stored = overridesOf(content)
  const catalog = []
  const planning = new Map()
  for (const row of roster) {
    const plugins = custom.get(row.id)?.plugins ?? declared.get(row.id)?.plugins
    const editable = plugins !== undefined
    let scan
    try {
      scan = await scanPreset(m, row.id, stable(plugins ?? null), refresh)
    } catch (error) {
      catalog.push({ id: row.id, editable, ptc: false, tools: [], error: error instanceof Error ? error.message : String(error) })
      continue
    }
    const tools = catalogEntries({ scanned: scan.tools, seen: m.seen.get(row.id), overrides: stored.get(row.id), history: content.presets[row.id]?.history })
    planning.set(row.id, { editable, ptc: scan.ptc, tools: new Map(tools.map(tool => [tool.name, tool.original])) })
    catalog.push({ id: row.id, editable, ptc: scan.ptc, tools })
  }
  return { catalog, planning }
}

/** Mount the description row in a preset that has overrides, and take it out of one that has none. */
async function syncDescriptionsRow(m, id) {
  const wanted = overridesOf(await readTools(m)).has(id)
  const present = rowsById(savedRows(m.ctx, id) ?? []).has(DESCRIPTIONS_ROW_ID)
  if (wanted === present) return
  await editPlugins(m, id, rows => (wanted
    ? [...rows, { id: DESCRIPTIONS_ROW_ID, name: DESCRIPTIONS_MODULE, config: { preset: id } }]
    : removeRow(rows, DESCRIPTIONS_ROW_ID)))
}

/**
 * Store planned overrides one preset at a time, then bring the preset's row in line; a preset whose row cannot be
 * changed gets its stored overrides back.
 * @returns {Promise<Map<string, string>>} the presets that failed, with the reason.
 */
async function commitTools(m, writes, source) {
  const failed = new Map()
  for (const [id, changes] of writes) {
    const previous = structuredClone((await readTools(m)).presets[id])
    try {
      await updateTools(m, content => applyWrites(content, new Map([[id, changes]]), source, Date.now()))
      await syncDescriptionsRow(m, id)
    } catch (error) {
      failed.set(id, error instanceof Error ? error.message : String(error))
      try {
        await updateTools(m, (content) => {
          if (previous === undefined) delete content.presets[id]
          else content.presets[id] = previous
        })
      } catch (rollback) {
        m.ctx.logger.warn(`could not roll back the tool descriptions of ${id}: ${rollback instanceof Error ? rollback.message : String(rollback)}`)
      }
    }
  }
  return failed
}

/** Report a stored change that did not complete as an error for every item of its preset. */
function withFailures(results, failed) {
  return results.map(result => (failed.has(result.preset) && (result.status === 'saved' || result.status === 'restored')
    ? { ...result, status: 'error', error: failed.get(result.preset) }
    : result))
}

/**
 * Save tool descriptions for several modes and tools in one call.
 * @param {object} m - manager context and caches.
 * @param {{ edits?: unknown }} body - `{ preset, tool, text, expected? }` items, see {@link planEdits}.
 * @returns {Promise<{ results: object[], tools: object[] }>} one result per item, and the refreshed catalog.
 */
async function setToolDescriptions(m, body) {
  if (!Array.isArray(body.edits) || body.edits.length === 0) throw new ActionError('bad-request', 'edits must be a non-empty list')
  const { planning } = await toolCatalog(m)
  const plan = planEdits({ edits: body.edits, presets: planning, overrides: overridesOf(await readTools(m)) })
  const failed = await commitTools(m, plan.writes, 'page')
  return { results: withFailures(plan.results, failed), tools: (await toolCatalog(m)).catalog }
}

/**
 * Remove tool description overrides.
 * @param {object} m - manager context and caches.
 * @param {{ items?: unknown, presets?: unknown, all?: unknown }} body - what to restore, see {@link planRestore}.
 * @returns {Promise<{ results: object[], tools: object[] }>} one result per override, and the refreshed catalog.
 */
async function restoreToolDescriptions(m, body) {
  if (!Array.isArray(body.items) && !Array.isArray(body.presets) && body.all !== true) throw new ActionError('bad-request', 'Name items, presets, or all')
  const plan = planRestore({ selector: body, overrides: overridesOf(await readTools(m)) })
  const failed = await commitTools(m, plan.writes, 'restore')
  return { results: withFailures(plan.results, failed), tools: (await toolCatalog(m)).catalog }
}

/** Forget a preset's tool description overrides and history. */
async function dropTools(m, id) {
  try {
    await updateTools(m, (content) => { delete content.presets[id] })
  } catch (error) {
    m.ctx.logger.warn(`could not drop tool descriptions of ${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Give a new preset the overrides of the preset it was copied from, without the history. */
async function copyTools(m, from, id) {
  try {
    await updateTools(m, (content) => {
      const source = content.presets[from]
      if (source?.tools !== undefined && Object.keys(source.tools).length > 0) content.presets[id] = { tools: structuredClone(source.tools) }
    })
  } catch (error) {
    m.ctx.logger.warn(`could not copy tool descriptions of ${from}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** The plugin's own switches; a damaged file reads as the defaults, and the next write reports it. */
async function readSettings(m) {
  try {
    return await m.store.read('settings')
  } catch (error) {
    m.ctx.logger.warn(error instanceof Error ? error.message : String(error))
    return { checkUpdates: true }
  }
}

/** How the profile depends on this package, from the dependency spec its package.json records. */
async function installSource(m) {
  try {
    const manifest = JSON.parse(await readFile(join(dirname(m.ctx.configEditor.documentPath), 'package.json'), 'utf8'))
    return sourceKind(manifest.dependencies?.[PACKAGE_NAME])
  } catch (error) {
    m.ctx.logger.warn(`could not read how ${PACKAGE_NAME} is installed: ${error instanceof Error ? error.message : String(error)}`)
    return 'unknown'
  }
}

/** Ask the registries DSH is configured with for the latest release, and remember the answer. */
async function checkLatest(m, manager) {
  let registries
  try {
    registries = await manager?.registries()
  } catch (error) {
    m.ctx.logger.warn(`could not read the configured registries: ${error instanceof Error ? error.message : String(error)}`)
  }
  const found = await fetchLatest(registryBases(registries), globalThis.fetch)
  m.check = found.ok
    ? { at: Date.now(), latest: { version: found.version, tarball: found.tarball, registry: found.registry } }
    : { at: Date.now(), error: found.error }
  return m.check
}

/**
 * What the page shows about this plugin's version: the installed one, the latest release when a check has run, and
 * what can be done about it. A check runs when the switch allows it and the last answer is older than its lifetime,
 * or when `refresh` asks for one; a development install (`link:`) is never checked.
 * @param {object} m - manager context and caches.
 * @param {boolean} refresh - check now, whatever the switch and the cache say.
 */
async function updateStatus(m, refresh) {
  const manager = m.ctx.get('pluginManager')
  const settings = await readSettings(m)
  const source = await installSource(m)
  const profile = basename(dirname(m.ctx.configEditor.documentPath))
  let check = m.check
  const lifetime = check?.error === undefined ? CHECK_TTL_MS : CHECK_ERROR_TTL_MS
  const stale = check === undefined || Date.now() - check.at > lifetime
  if (source !== 'link' && (refresh || (settings.checkUpdates !== false && stale))) check = await checkLatest(m, manager)
  const newer = check?.latest !== undefined && isNewer(check.latest.version, PACKAGE_VERSION)
  return {
    version: PACKAGE_VERSION,
    profile,
    source,
    checkUpdates: settings.checkUpdates !== false,
    ...check === undefined ? {} : { checkedAt: check.at },
    ...check?.error === undefined ? {} : { error: check.error },
    ...check?.latest === undefined ? {} : { latest: check.latest.version, newer, host: new URL(check.latest.registry).host },
    canUpgrade: newer && manager !== undefined && (source === 'registry' || source === 'tarball'),
    commands: commands(profile, PACKAGE_VERSION),
    upgrade: publicUpgrade(m.upgrade),
  }
}

/** The part of an upgrade the page may see. */
function publicUpgrade(upgrade) {
  if (upgrade === undefined) return { state: 'idle' }
  const { requestId: _requestId, ...visible } = upgrade
  return visible
}

/** The failure an installation reports, reduced to what the page words. */
function upgradeFailure(result) {
  const output = typeof result.packageResult?.output === 'string'
    ? result.packageResult.output.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').trim().split('\n').slice(-UPGRADE_LOG_LINES).join('\n')
    : undefined
  return {
    ...result.error?.code === undefined ? {} : { code: result.error.code },
    ...result.error?.diagnostic === undefined ? {} : { message: result.error.diagnostic },
    ...result.packageResult?.kind === undefined ? {} : { kind: result.packageResult.kind },
    ...output === undefined || output === '' ? {} : { output },
  }
}

/**
 * Install the latest release with the plugin manager, from the registry's tarball address, without waiting for it:
 * the page polls `upgradeStatus`. The manager restores the profile's manifest and lockfile when the install fails or
 * is cancelled, and a successful install usually loads at the next start.
 * @param {object} m - manager context and caches.
 * @param {{ version?: unknown }} body - the version the user confirmed; a newer release since then is refused.
 */
async function startUpgrade(m, body) {
  const manager = m.ctx.get('pluginManager')
  if (manager === undefined) throw new ActionError('unavailable', 'The plugin manager is not available')
  if (m.upgrade?.state === 'installing') throw new ActionError('upgrade-running', 'An upgrade is already running')
  const source = await installSource(m)
  if (source !== 'registry' && source !== 'tarball') throw new ActionError('not-upgradable', 'This install cannot be upgraded from the page', { source })
  const check = await checkLatest(m, manager)
  if (check.latest === undefined) throw new ActionError('check-failed', `Could not read the latest version: ${check.error}`, { error: check.error })
  if (!isNewer(check.latest.version, PACKAGE_VERSION)) throw new ActionError('up-to-date', 'This is already the latest version')
  if (body.version !== check.latest.version) throw new ActionError('update-changed', `The latest version is now ${check.latest.version}`, { latest: check.latest.version })
  const requestId = `${PACKAGE_NAME}-upgrade-${Date.now()}`
  const upgrade = { state: 'installing', from: PACKAGE_VERSION, to: check.latest.version, phase: 'installing', startedAt: Date.now(), requestId }
  m.upgrade = upgrade
  const stop = m.ctx.on('plugin-manager/install-state', (progress) => {
    if (progress.requestId === requestId) upgrade.phase = progress.phase
  })
  manager.installBundle(check.latest.tarball, { requestId }).then((result) => {
    const applied = result.application === 'applied' || result.application === 'restart-required' || result.application === 'overridden'
    Object.assign(upgrade, {
      state: applied ? 'done' : result.application === 'cancelled' ? 'cancelled' : 'failed',
      endedAt: Date.now(),
      ...applied ? { restartRequired: result.application !== 'applied', ...result.restartReason === undefined ? {} : { reason: result.restartReason } } : {},
      ...applied || result.application === 'cancelled' ? {} : { failure: upgradeFailure(result) },
    })
  }, (error) => {
    Object.assign(upgrade, { state: 'failed', endedAt: Date.now(), failure: { message: error instanceof Error ? error.message : String(error) } })
  }).finally(stop)
  return publicUpgrade(upgrade)
}

/** Stop the running installation; the manager restores the profile files before it answers `cancelled`. */
async function cancelUpgrade(m) {
  const manager = m.ctx.get('pluginManager')
  if (manager === undefined || m.upgrade?.state !== 'installing') throw new ActionError('not-running', 'No upgrade is running')
  const outcome = await manager.cancelInstall(m.upgrade.requestId)
  return { status: outcome.status }
}
