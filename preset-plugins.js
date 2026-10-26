/** Installed-only catalog and literal row edits. No installer or package execution during discovery. */
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { allRowsById, stable } from './rebase.js'

export class PluginEditError extends Error {
  constructor(code, message) { super(message); this.code = code }
}
const fail = (code, message) => { throw new PluginEditError(code, message) }
export const revision = rows => createHash('sha256').update(stable(rows)).digest('hex')
const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id) && !['constructor', 'prototype', '__proto__'].includes(id)
export function assertLiteral(value, previous) {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '__jsExpr' && previous && stable(previous) === stable(value)) continue
      if (['__proto__', 'constructor', 'prototype', '__jsExpr'].includes(key)) fail('invalid-config', 'Configuration must be literal JSON, without new expressions or prototype keys')
      assertLiteral(child, previous?.[key])
    }
  }
}
function siblings(rows, id) {
  if (rows.some(row => row.id === id)) return rows
  for (const row of rows) if (row.group === true && Array.isArray(row.config)) {
    const found = siblings(row.config, id); if (found) return found
  }
}
/** Detached, sibling-local operations; ids and module ownership cannot be renamed through config. */
export function planPluginEdit(current, input, catalog) {
  if (input.base !== revision(current)) fail('plugin-conflict', 'Preset changed. Refresh before saving.')
  const rows = structuredClone(current), byId = allRowsById(rows)
  if (input.op === 'add') {
    if (!safeId(input.rowId) || byId.has(input.rowId)) fail('invalid-row', 'Row id must be unique and valid')
    if (!catalog.some(item => item.module === input.module && item.addable !== false)) fail('not-installed', 'Select an installed, Preset-compatible module')
    const parent = input.parentId === undefined ? rows : byId.get(input.parentId)
    const target = Array.isArray(parent) ? parent : parent?.group === true ? parent.config : undefined
    if (!Array.isArray(target)) fail('invalid-row', 'Target group does not exist')
    assertLiteral(input.config ?? {})
    target.push({ id: input.rowId, name: input.module, config: structuredClone(input.config ?? {}), ...(input.enabled === false ? { disabled: true } : {}) })
  } else {
    const list = siblings(rows, input.rowId)
    if (!list) fail('invalid-row', 'Unknown row')
    const at = list.findIndex(row => row.id === input.rowId), row = list[at]
    if (input.op === 'remove') list.splice(at, 1)
    else if (input.op === 'configure') { assertLiteral(input.config, row.config); row.config = structuredClone(input.config) }
    else if (input.op === 'toggle') { if (typeof input.enabled !== 'boolean') fail('bad-request', 'enabled must be boolean'); row.disabled = !input.enabled }
    else if (input.op === 'move') {
      if (![1, -1].includes(input.direction) || at + input.direction < 0 || at + input.direction >= list.length) fail('invalid-row', 'Move stays within this group')
      list.splice(at, 1); list.splice(at + input.direction, 0, row)
    } else fail('bad-request', 'Unknown plugin operation')
  }
  return rows
}
function entryModules(manifest) {
  const exp = manifest.exports
  const keys = exp && typeof exp === 'object' && Object.keys(exp).some(k => k.startsWith('.')) ? Object.keys(exp) : ['.']
  return keys.filter(key => !key.includes('*') && !/(?:client|locale|icon|package\.json|types|schema|registry|session)(?:\/|$|\.)/.test(key))
    .map(key => key === '.' ? manifest.name : manifest.name + key.slice(1))
}
export async function installedCatalog(ctx, declaredRows = []) {
  const packages = ctx.get('pluginPackages'), resolution = packages?.resolution
  if (!resolution?.entries) fail('unsupported-host', 'Installed package resolution API is unavailable')
  const base = pathToFileURL(join(dirname(ctx.configEditor.documentPath), 'package.json')).href
  const result = new Map(), diagnostics = []
  const presetModules = new Set(declaredRows.flatMap(rows => [...allRowsById(rows).values()].map(row => row.name)))
  const hostModules = new Set(ctx.configEditor.entries().filter(e => !e.options.group).map(e => e.options.name))
  const installed = new Set([...resolution.entries.map(item => item.name), ...resolution.localPackageNames ?? []])
  for (const name of installed) {
    // Resolve through the Host so shadowed installation/profile packages cannot become two identities.
    const pkg = packages.packageOf(name, base)
    if (!pkg) continue
    let manifest
    try { manifest = JSON.parse(await readFile(pkg.manifestPath, 'utf8')) }
    catch { diagnostics.push({ package: name, error: 'Unreadable package manifest' }); continue }
    if (!manifest.dsh && !resolution.localPackageNames?.includes(name) && !/^(?:@deepseek-ai\/)?(?:dsh-|cordis-plugin-)/.test(manifest.name ?? '')) continue
    for (const module of entryModules(manifest)) {
      if (result.has(module)) continue
      const hostOnly = hostModules.has(module) && !presetModules.has(module)
      result.set(module, { module, package: manifest.name, version: manifest.version, description: typeof manifest.description === 'string' ? manifest.description : '',
        referenced: presetModules.has(module), addable: !hostOnly,
        scope: hostOnly ? 'host' : 'requires-validation', bundle: !!manifest.dsh?.bundle })
    }
  }
  // Subpath rows that lack an exports map stay discoverable, but additions still resolve natively.
  for (const module of presetModules) if (typeof module === 'string' && !result.has(module)) result.set(module, { module, referenced: true, addable: true, scope: 'requires-validation' })
  return { modules: [...result.values()].sort((a, b) => a.module.localeCompare(b.module)), diagnostics }
}
/** Inspection imports installed trusted code but does not apply it. Native Loader unwraps CJS/default exports. */
export async function inspectModule(ctx, module, catalog) {
  if (!catalog.some(row => row.module === module)) fail('not-installed', 'Module is not in the installed catalog')
  const base = pathToFileURL(join(dirname(ctx.configEditor.documentPath), 'package.json')).href
  const exports = await ctx.loader.internal.import(module, base, {})
  const plugin = ctx.loader.unwrapExports(exports)
  if (typeof plugin !== 'function' && typeof plugin?.apply !== 'function') fail('not-plugin', 'Export is not a Cordis plugin')
  const inject = plugin.inject ?? []
  const required = Array.isArray(inject) ? inject : Object.entries(inject).filter(([, v]) => v !== false && v?.required !== false).map(([k]) => k)
  let schema, limitations = []
  if (plugin.Config) {
    const { createConfigProjector } = await ctx.loader.internal.import('@deepseek-ai/dsh-app-boot', base, {})
    const project = await createConfigProjector(), projected = project(plugin.Config, 'plugin')
    schema = { ...projected.schema, $defs: projected.definitions }
    limitations = projected.limitations
  }
  return { module, required, schema, limitations, hasSchema: !!plugin.Config }
}
/** Native Preset revision performs dependency AND scope-leak audit; always unregister the probe. */
export async function validateComposition(ctx, rows) {
  const id = `pm-check-${randomUUID()}`
  const release = await ctx.agentPresets.register({ id, plugins: rows })
  try {
    const lease = await ctx.agentPresets.acquireScope(id)
    try { return { validated: true } } finally { await lease[Symbol.asyncDispose]() }
  } catch (error) { fail('composition-invalid', error instanceof Error ? error.message : String(error)) }
  finally { await release() }
}

/** Bounded filesystem skill discovery including flat Markdown and unassigned installed bundle skills. */
export async function discoverSkills(roots) {
  const skills = new Map(), diagnostics = []
  const { parseSkillFile } = await import('./skill-store.js')
  for (const root of new Set(roots)) {
    let entries
    try { entries = await readdir(root, { withFileTypes: true }) }
    catch (error) { if (error.code !== 'ENOENT') diagnostics.push({ root, error: 'Skill directory unreadable' }); continue }
    const files = [join(root, 'SKILL.md'), ...entries.filter(e => !e.name.startsWith('.')).flatMap(e => e.isDirectory() ? [join(root, e.name, 'SKILL.md')] : e.isFile() && /\.md$/i.test(e.name) && e.name !== 'SKILL.md' ? [join(root, e.name)] : [])]
    for (const path of files) {
      let text
      try { text = await readFile(path, 'utf8') } catch { continue }
      if (text.length > 200000) { diagnostics.push({ root, error: 'Oversize skill skipped' }); continue }
      const { fields } = parseSkillFile(text)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.name ?? '') || !fields.description) continue
      if (!skills.has(fields.name)) skills.set(fields.name, { name: fields.name, description: fields.description, path, source: 'installed' })
      else if (skills.get(fields.name).path !== path) {
        const skill = skills.get(fields.name); skill.conflicts = [...skill.conflicts ?? [], path]
      }
    }
  }
  return { skills: [...skills.values()], diagnostics }
}
