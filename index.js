/**
 * Host half: one authenticated POST route that lists presets and edits them.
 *
 * Shipped presets are ordinary `@deepseek-ai/dsh-agent-preset` rows; an edit
 * writes the profile's `cordis.patch.yml` override for that row through
 * `configEditor.edit()`, which validates, persists, and reloads it. User-created
 * presets live in the `dsh-modes-custom` container row (container.js).
 * Running sessions keep the revision they started with; new sessions see edits.
 */

const ROUTE = '/api/dsh-modes'
const PRESET_MODULE = '@deepseek-ai/dsh-agent-preset'
const CONTAINER_ID = 'dsh-modes-custom'
const REGISTRY_SETTINGS = 'agent-preset-registry'
const PRESET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const CUSTOM_ORDER_BASE = 100
const PERSONA_MODULE = '@deepseek-ai/dsh-persona'
const PROMPT_MAX_CHARS = 20000
const PROMPT_EXCERPT_CHARS = 160
/** The prompt registry's reference syntax (`dsh-system-prompt` GROUP_AT / VARIABLE_NAME). */
const VARIABLE_GROUP = /^\{\{([^{}]*)\}\}/
const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/

/** Rows every non-develop template keeps on: the prompt, time, compaction, and asking the user. */
const TEMPLATE_COMMON = ['persona', 'time-context', 'compaction-basic', 'command-compact', 'tool-result-pruner', 'tool-ask-user']

/**
 * Starter templates for a new mode, built on the shipped `standard` rows.
 * `allow` names the plugin rows kept as shipped; every other row is switched off at
 * creation, so a template never turns on a tool it does not name. `tweaks` merges into
 * a kept row's config. `prompt` replaces the persona prefix; `develop` keeps standard's.
 * Prompts reference only `{{model}}`, which the agent loop registers in every deployment.
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
  ctx.inject(['connection'], (c) => {
    c.effect(() => c.connection.fetch.register({
      path: ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handle(ctx, request),
    }), 'dsh-modes: route')
  })
}

function reply(body) {
  return Response.json(body, { headers: { 'cache-control': 'no-store' } })
}

const ACTIONS = {
  list: ctx => list(ctx),
  read: (ctx, body) => ctx.agentPresets.readDocument(String(body.id)),
  toggle: (ctx, body) => toggle(ctx, String(body.id), String(body.rowId), body.enabled === true),
  resetRow: (ctx, body) => resetRow(ctx, String(body.id), String(body.rowId)),
  reset: (ctx, body) => reset(ctx, String(body.id)),
  create: (ctx, body) => create(ctx, body),
  update: (ctx, body) => update(ctx, body),
  remove: (ctx, body) => remove(ctx, String(body.id)),
  setDefault: (ctx, body) => setDefault(ctx, String(body.id)),
  prompt: (ctx, body) => readPrompt(ctx, String(body.id)),
  setPrompt: (ctx, body) => setPrompt(ctx, String(body.id), body.prefix, body.base),
}
/** Actions that answer with their own value instead of the refreshed list. */
const READS = new Set(['list', 'read', 'prompt'])

async function handle(ctx, request) {
  let body
  try {
    body = await request.json()
  } catch {
    return reply({ ok: false, code: 'bad-request', error: 'Request body must be JSON' })
  }
  const action = ACTIONS[body?.action]
  if (action === undefined) return reply({ ok: false, code: 'bad-request', error: `Unknown action: ${String(body?.action)}` })
  try {
    const value = await action(ctx, body)
    return reply({ ok: true, value: READS.has(body.action) ? value : await list(ctx) })
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

/** JSON with sorted keys, so a YAML round trip that reorders keys is not a change. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Every non-group row with an id, keyed by id; nested group rows included. */
function rowsById(rows, found = new Map()) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.group === true) rowsById(row.config, found)
    else if (typeof row.id === 'string') found.set(row.id, row)
  }
  return found
}

/** Shipped or bundle-declared preset rows, keyed by preset id, with their profile override state. */
function declarations(ctx) {
  const found = new Map()
  for (const { entry, inherited, override } of ctx.configEditor.configuration()) {
    if (entry.options.name !== PRESET_MODULE) continue
    const config = entry.options.config ?? {}
    found.set(config.id, {
      entry,
      plugins: config.plugins ?? [],
      inherited: rowsById(inherited.plugins),
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
    out.push({
      id,
      module: row.name,
      group,
      declared: disabled === true ? false : disabled === 'conditional' ? 'conditional' : true,
      inheritedOff: outer === true,
      ...isExpr(row.disabled) ? { condition: row.disabled.__jsExpr } : {},
      ...mounted === undefined ? {} : { enabled: mounted.enabled },
      ...context.inherited === undefined ? {} : { changed: base === undefined || stable(base) !== stable(row) },
      ...base === undefined ? {} : {
        restorable: true,
        builtIn: isExpr(base.disabled) ? { declared: 'conditional', condition: base.disabled.__jsExpr } : { declared: !base.disabled },
      },
      ...row.name === PERSONA_MODULE ? { essential: true } : {},
      ...row.config === undefined ? {} : { config: row.config },
      ...meta === undefined ? {} : { meta: { title: meta.title, description: meta.description, icon: meta.icon } },
    })
  }
  return out
}

async function list(ctx) {
  const presets = ctx.agentPresets
  const [roster, inventory, meta] = await Promise.all([presets.list(), presets.compositionInventory(), pluginMeta(ctx)])
  const live = new Map(inventory.map(item => [item.id, item.rows]))
  const declared = declarations(ctx)
  const custom = new Map(customPresets(ctx).map(preset => [preset.id, preset]))
  const usage = liveUsage(ctx)
  const rows = roster.map((row) => {
    const declaration = declared.get(row.id)
    const own = custom.get(row.id)
    const plugins = own?.plugins ?? declaration?.plugins
    const flat = plugins === undefined ? [] : flatten(plugins, {
      live: live.get(row.id),
      meta,
      ...declaration === undefined ? {} : { inherited: declaration.inherited },
    })
    const prefix = plugins === undefined ? undefined : findPersona(plugins)?.config?.prefix
    return {
      ...row,
      isDefault: row.id === presets.defaultId,
      source: own !== undefined ? 'custom' : declaration === undefined ? 'external' : declaration.overridden ? 'overridden' : 'builtin',
      usage: usage.get(row.id) ?? 0,
      ...typeof prefix === 'string' ? { promptExcerpt: prefix.slice(0, PROMPT_EXCERPT_CHARS) } : {},
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
  return { presets: rows, templates, defaultId: presets.defaultId, canSetDefault: ctx.get('settings') !== undefined }
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
    return prompt !== undefined && row.name === PERSONA_MODULE ? { ...next, config: { ...next.config, prefix: prompt } } : next
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

function withDisabled(rows, rowId, disabled) {
  return replaceRow(rows, rowId, (row) => {
    if (isExpr(row.disabled)) {
      throw new ActionError('conditional-row', `Row ${rowId} is enabled by a condition (${row.disabled.__jsExpr}); edit it in YAML instead`, { rowId, condition: row.disabled.__jsExpr })
    }
    const next = { ...row }
    if (disabled) next.disabled = true
    else delete next.disabled
    return next
  })
}

/** Apply `change` to one preset's row list, in the container for custom presets or the profile override otherwise. */
async function editPlugins(ctx, id, change) {
  if (customPresets(ctx).some(preset => preset.id === id)) {
    await ctx.configEditor.edit(containerEntry(ctx), current => ({
      ...current,
      presets: current.presets.map(preset => preset.id === id ? { ...preset, plugins: change(preset.plugins, undefined) } : preset),
    }))
    return
  }
  const declaration = declarations(ctx).get(id)
  if (declaration === undefined) throw new ActionError('not-editable', `Preset ${id} is not declared in an editable row`, { id })
  await ctx.configEditor.edit(declaration.entry, (current, inherited) => ({ ...current, plugins: change(current.plugins, inherited.plugins) }))
}

function toggle(ctx, id, rowId, enabled) {
  return editPlugins(ctx, id, rows => withDisabled(rows, rowId, !enabled))
}

function resetRow(ctx, id, rowId) {
  return editPlugins(ctx, id, (rows, inherited) => {
    const original = rowsById(inherited).get(rowId)
    if (original === undefined) throw new ActionError('not-restorable', `Row ${rowId} has no built-in definition`, { rowId })
    return replaceRow(rows, rowId, () => original)
  })
}

async function reset(ctx, id) {
  const declaration = declarations(ctx).get(id)
  if (declaration?.overridden !== true) throw new ActionError('not-overridden', `Preset ${id} has no profile override`, { id })
  await ctx.configEditor.edit(declaration.entry, (_current, inherited) => inherited)
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * Create a custom preset from a starter template, or as a copy of an existing preset.
 * @param {object} ctx - plugin context.
 * @param {{id: string, name?: string, description?: string, template?: string, from?: string, locale?: string}} request -
 *   `template` names a {@link TEMPLATES} entry; otherwise `from` names the preset to copy (default `standard`).
 */
async function create(ctx, { id, name, description, template, from, locale }) {
  if (typeof id !== 'string' || !PRESET_ID.test(id)) throw new ActionError('invalid-id', 'Use 1-40 lowercase letters, digits, or hyphens for the id')
  const roster = await ctx.agentPresets.list()
  const custom = customPresets(ctx)
  if (roster.some(row => row.id === id) || custom.some(preset => preset.id === id)) throw new ActionError('exists', `Preset ${id} already exists`, { id })
  let plugins
  if (template !== undefined) {
    const starter = TEMPLATES[template]
    if (starter === undefined) throw new ActionError('not-found', `Unknown template ${String(template)}`, { id: template })
    const base = declarations(ctx).get(starter.base)?.plugins
    if (base === undefined) throw new ActionError('not-found', `Template base ${starter.base} is not available`, { id: starter.base })
    const prompt = starter.prompt === undefined ? undefined : starter.prompt[locale === 'zh' ? 'zh' : 'en']
    plugins = applyTemplate(base, starter, prompt)
  } else {
    const source = String(from ?? 'standard')
    const copied = custom.find(preset => preset.id === source)?.plugins ?? declarations(ctx).get(source)?.plugins
    if (copied === undefined) throw new ActionError('not-found', `Template preset ${source} is not available`, { id: source })
    plugins = structuredClone(copied)
  }
  const preset = {
    id,
    ...text(name) === undefined ? {} : { name: text(name) },
    ...text(description) === undefined ? {} : { description: text(description) },
    order: CUSTOM_ORDER_BASE + custom.length,
    plugins,
  }
  await ctx.configEditor.edit(containerEntry(ctx), current => ({ ...current, presets: [...(current.presets ?? []), preset] }))
}

async function update(ctx, { id, name, description }) {
  if (!customPresets(ctx).some(preset => preset.id === id)) throw new ActionError('not-custom', `Preset ${String(id)} is not a custom preset`, { id })
  await ctx.configEditor.edit(containerEntry(ctx), current => ({
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

async function remove(ctx, id) {
  if (!customPresets(ctx).some(preset => preset.id === id)) throw new ActionError('not-custom', `Preset ${id} is not a custom preset`, { id })
  if (ctx.agentPresets.defaultId === id) throw new ActionError('is-default', `Preset ${id} is the default for new sessions; choose another default first`, { id })
  await ctx.configEditor.edit(containerEntry(ctx), current => ({ ...current, presets: current.presets.filter(preset => preset.id !== id) }))
}

async function setDefault(ctx, id) {
  const settings = ctx.get('settings')
  if (settings === undefined) throw new ActionError('unavailable', 'The settings service is not composed')
  const preset = (await ctx.agentPresets.list()).find(row => row.id === id)
  if (preset === undefined) throw new ActionError('not-found', `Unknown preset ${id}`, { id })
  if (preset.broken !== undefined) throw new ActionError('broken', `Preset ${id} cannot compose a session`, { id })
  await settings.update(REGISTRY_SETTINGS, { selectedDefault: id })
}

/** The first persona row, which owns the prompt prefix; nested group rows included. */
function findPersona(rows) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.group === true) {
      const nested = findPersona(row.config)
      if (nested !== undefined) return nested
    } else if (row.name === PERSONA_MODULE) return row
  }
  return undefined
}

/**
 * The first reference the prompt registry would refuse to render, mirroring
 * `dsh-system-prompt` interpolation: a render failure fails every model step.
 * @param text - persona prefix template.
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

async function readPrompt(ctx, id) {
  const { plugins, inherited, overridden } = presetRows(ctx, id)
  const persona = findPersona(plugins)
  const original = persona?.id === undefined ? undefined : inherited?.get(persona.id)
  const assembled = await assemblePreset(ctx, id)
  return {
    id,
    ...persona === undefined ? {} : {
      rowId: persona.id ?? null,
      prefix: persona.config?.prefix ?? '',
      complete: persona.config?.complete === true,
      includeRuntimeContext: persona.config?.includeRuntimeContext !== false,
      off: persona.disabled === true,
    },
    ...original === undefined ? {} : {
      builtInPrefix: original.config?.prefix ?? '',
      changed: overridden === true && stable(original) !== stable(persona),
    },
    ...assembled,
  }
}

/**
 * Save a preset's persona prefix after checking that it renders.
 * @param {object} ctx - plugin context.
 * @param {string} id - preset id.
 * @param {unknown} prefix - the new prompt text.
 * @param {unknown} base - the prompt the editor started from; a string refuses the save with
 *   `prompt-conflict` when the stored prompt has changed since, so a stale editor cannot overwrite it.
 */
async function setPrompt(ctx, id, prefix, base) {
  if (typeof prefix !== 'string') throw new ActionError('bad-request', 'The prompt must be text')
  if (prefix.length > PROMPT_MAX_CHARS) throw new ActionError('prompt-too-long', `The prompt exceeds ${PROMPT_MAX_CHARS} characters`, { max: PROMPT_MAX_CHARS })
  const { variables } = await assemblePreset(ctx, id)
  const problem = templateProblem(prefix, variables)
  if (problem !== undefined) {
    throw new ActionError(problem.code, `The prompt cannot render: ${problem.reference}${problem.variables === undefined ? '' : ` (registered variables: ${problem.variables.join(', ')})`}`, problem)
  }
  await editPlugins(ctx, id, (rows) => {
    const persona = findPersona(rows)
    const stored = persona?.config?.prefix ?? ''
    if (typeof base === 'string' && stored !== base && stored !== prefix) {
      throw new ActionError('prompt-conflict', 'The prompt was changed elsewhere after you started editing; reload it or overwrite it', { current: stored })
    }
    if (persona === undefined) return [{ id: 'persona', name: PERSONA_MODULE, config: { prefix } }, ...rows]
    if (persona.id === undefined) throw new ActionError('not-found', 'The persona row has no id, so it cannot be edited here')
    return replaceRow(rows, persona.id, row => ({ ...row, config: { ...row.config, prefix } }))
  })
}
