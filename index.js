/**
 * Host half: one authenticated POST route that lists presets and edits them.
 *
 * Shipped presets are ordinary `@deepseek-ai/dsh-agent-preset` rows; an edit
 * writes the profile's `cordis.patch.yml` override for that row through
 * `configEditor.edit()`, which validates, persists, and reloads it. User-created
 * presets live in the `preset-manager-custom` container row (container.js).
 * Running sessions keep the revision they started with; new sessions see edits.
 */

const ROUTE = '/api/preset-manager'
const PRESET_MODULE = '@deepseek-ai/dsh-agent-preset'
const CONTAINER_ID = 'preset-manager-custom'
const REGISTRY_SETTINGS = 'agent-preset-registry'
const PRESET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const CUSTOM_ORDER_BASE = 100

export const name = 'preset-manager'
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
    }), 'preset-manager: route')
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
}

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
    return reply({ ok: true, value: body.action === 'list' || body.action === 'read' ? value : await list(ctx) })
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
      ...base === undefined ? {} : { restorable: true },
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
      ...declaration?.overridden === true ? { inherited: declaration.inherited } : {},
    })
    return {
      ...row,
      isDefault: row.id === presets.defaultId,
      source: own !== undefined ? 'custom' : declaration === undefined ? 'external' : declaration.overridden ? 'overridden' : 'builtin',
      usage: usage.get(row.id) ?? 0,
      rows: flat,
    }
  })
  const registered = new Set(roster.map(row => row.id))
  for (const [id, preset] of custom) {
    if (!registered.has(id)) {
      rows.push({ id, name: preset.name, source: 'custom', isDefault: false, usage: 0, rows: [], broken: 'Not registered: the id is taken or the definition is invalid (see the Host log)' })
    }
  }
  return { presets: rows, defaultId: presets.defaultId, canSetDefault: ctx.get('settings') !== undefined }
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

async function create(ctx, { id, name, description, from }) {
  if (typeof id !== 'string' || !PRESET_ID.test(id)) throw new ActionError('invalid-id', 'Use 1-40 lowercase letters, digits, or hyphens for the id')
  const roster = await ctx.agentPresets.list()
  const custom = customPresets(ctx)
  if (roster.some(row => row.id === id) || custom.some(preset => preset.id === id)) throw new ActionError('exists', `Preset ${id} already exists`, { id })
  const template = String(from ?? 'standard')
  const plugins = custom.find(preset => preset.id === template)?.plugins ?? declarations(ctx).get(template)?.plugins
  if (plugins === undefined) throw new ActionError('not-found', `Template preset ${template} is not available`, { id: template })
  const preset = {
    id,
    ...text(name) === undefined ? {} : { name: text(name) },
    ...text(description) === undefined ? {} : { description: text(description) },
    order: CUSTOM_ORDER_BASE + custom.length,
    plugins: structuredClone(plugins),
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
