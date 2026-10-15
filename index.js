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
const PRESET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const CUSTOM_ORDER_BASE = 100

export const name = 'preset-manager'
export const inject = ['agentPresets', 'configEditor']

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

async function handle(ctx, request) {
  let body
  try {
    body = await request.json()
  } catch {
    return reply({ ok: false, error: 'Request body must be JSON' })
  }
  try {
    switch (body?.action) {
      case 'list': return reply({ ok: true, value: await list(ctx) })
      case 'read': return reply({ ok: true, value: await ctx.agentPresets.readDocument(String(body.id)) })
      case 'toggle': await toggle(ctx, String(body.id), String(body.rowId), body.enabled === true); break
      case 'reset': await reset(ctx, String(body.id)); break
      case 'create': await create(ctx, body); break
      case 'remove': await remove(ctx, String(body.id)); break
      default: return reply({ ok: false, error: `Unknown action: ${String(body?.action)}` })
    }
    return reply({ ok: true, value: await list(ctx) })
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

function isExpr(value) {
  return value !== null && typeof value === 'object' && typeof value.__jsExpr === 'string'
}

/** Shipped or bundle-declared preset rows, keyed by preset id, with their profile override state. */
function declarations(ctx) {
  const found = new Map()
  for (const { entry, override } of ctx.configEditor.configuration()) {
    if (entry.options.name !== PRESET_MODULE) continue
    const config = entry.options.config ?? {}
    found.set(config.id, { entry, plugins: config.plugins ?? [], overridden: Object.keys(override).length > 0 })
  }
  return found
}

function containerEntry(ctx) {
  const entry = ctx.configEditor.entries().find(candidate => candidate.options.id === CONTAINER_ID)
  if (entry === undefined) throw new Error(`The ${CONTAINER_ID} row is not loaded`)
  return entry
}

function customPresets(ctx) {
  const presets = containerEntry(ctx).options.config?.presets
  return Array.isArray(presets) ? presets : []
}

/** Declared rows with their declared and live enablement; nested group rows are flattened. */
function flatten(rows, live, outer = false, out = []) {
  for (const row of rows) {
    const own = isExpr(row.disabled) ? 'conditional' : Boolean(row.disabled)
    const disabled = outer === true || own === true ? true
      : outer === 'conditional' || own === 'conditional' ? 'conditional' : false
    if (row.group === true) {
      flatten(Array.isArray(row.config) ? row.config : [], live, disabled, out)
      continue
    }
    const mounted = live?.find(candidate => candidate.entryId === row.id || candidate.entryId?.endsWith(`:${String(row.id)}`))
    out.push({
      id: typeof row.id === 'string' ? row.id : null,
      module: row.name,
      declared: disabled === true ? false : disabled === 'conditional' ? 'conditional' : true,
      inheritedOff: outer === true,
      ...isExpr(row.disabled) ? { condition: row.disabled.__jsExpr } : {},
      ...mounted === undefined ? {} : { enabled: mounted.enabled },
    })
  }
  return out
}

async function list(ctx) {
  const presets = ctx.agentPresets
  const roster = await presets.list()
  const inventory = new Map((await presets.compositionInventory()).map(item => [item.id, item]))
  const declared = declarations(ctx)
  const custom = new Map(customPresets(ctx).map(preset => [preset.id, preset]))
  const rows = roster.map((row) => {
    const declaration = declared.get(row.id)
    const own = custom.get(row.id)
    const plugins = own?.plugins ?? declaration?.plugins
    return {
      ...row,
      isDefault: row.id === presets.defaultId,
      source: own !== undefined ? 'custom' : declaration === undefined ? 'external' : declaration.overridden ? 'overridden' : 'builtin',
      rows: plugins === undefined ? [] : flatten(plugins, inventory.get(row.id)?.rows),
    }
  })
  const registered = new Set(roster.map(row => row.id))
  for (const [id] of custom) {
    if (!registered.has(id)) rows.push({ id, source: 'custom', isDefault: false, rows: [], broken: 'Not registered: the id is taken or the definition is invalid (see the Host log)' })
  }
  return { presets: rows }
}

/** Copy of a row list with one row's `disabled` replaced; refuses `!!js` conditions. */
function withDisabled(rows, rowId, disabled) {
  let found = false
  const visit = list => list.map((row) => {
    if (found) return row
    if (row.group === true && Array.isArray(row.config)) return { ...row, config: visit(row.config) }
    if (row.id !== rowId) return row
    found = true
    if (isExpr(row.disabled)) throw new Error(`Row ${rowId} is enabled by a condition (${row.disabled.__jsExpr}); edit it in YAML instead`)
    const next = { ...row }
    if (disabled) next.disabled = true
    else delete next.disabled
    return next
  })
  const result = visit(rows)
  if (!found) throw new Error(`No row ${rowId} in this preset`)
  return result
}

async function toggle(ctx, id, rowId, enabled) {
  if (customPresets(ctx).some(preset => preset.id === id)) {
    await ctx.configEditor.edit(containerEntry(ctx), current => ({
      ...current,
      presets: current.presets.map(preset => preset.id === id ? { ...preset, plugins: withDisabled(preset.plugins, rowId, !enabled) } : preset),
    }))
    return
  }
  const declaration = declarations(ctx).get(id)
  if (declaration === undefined) throw new Error(`Preset ${id} is not declared in an editable row`)
  await ctx.configEditor.edit(declaration.entry, current => ({ ...current, plugins: withDisabled(current.plugins, rowId, !enabled) }))
}

async function reset(ctx, id) {
  const declaration = declarations(ctx).get(id)
  if (declaration?.overridden !== true) throw new Error(`Preset ${id} has no profile override`)
  await ctx.configEditor.edit(declaration.entry, (_current, inherited) => inherited)
}

async function create(ctx, { id, name, description, from }) {
  if (typeof id !== 'string' || !PRESET_ID.test(id)) throw new Error('Use 1-40 lowercase letters, digits, or hyphens for the id')
  const roster = await ctx.agentPresets.list()
  const custom = customPresets(ctx)
  if (roster.some(row => row.id === id) || custom.some(preset => preset.id === id)) throw new Error(`Preset ${id} already exists`)
  const template = String(from ?? 'standard')
  const plugins = custom.find(preset => preset.id === template)?.plugins ?? declarations(ctx).get(template)?.plugins
  if (plugins === undefined) throw new Error(`Template preset ${template} is not available`)
  const preset = {
    id,
    ...typeof name === 'string' && name.trim() !== '' ? { name: name.trim() } : {},
    ...typeof description === 'string' && description.trim() !== '' ? { description: description.trim() } : {},
    order: CUSTOM_ORDER_BASE + custom.length,
    plugins: structuredClone(plugins),
  }
  await ctx.configEditor.edit(containerEntry(ctx), current => ({ ...current, presets: [...(current.presets ?? []), preset] }))
}

async function remove(ctx, id) {
  if (!customPresets(ctx).some(preset => preset.id === id)) throw new Error(`Preset ${id} is not a custom preset`)
  if (ctx.agentPresets.defaultId === id) throw new Error(`Preset ${id} is the default for new sessions; choose another default first`)
  await ctx.configEditor.edit(containerEntry(ctx), current => ({ ...current, presets: current.presets.filter(preset => preset.id !== id) }))
}
