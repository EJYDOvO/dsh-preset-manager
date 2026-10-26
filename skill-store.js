/**
 * Pure rules for per-mode skill control: which skills a mode hides, which it serves from a saved version, and the
 * versions kept for each skill.
 *
 * The stored file (`.dsh-preset-manager/skills.json`) holds `presets` (mode id → `{ off, pins }`), `global.off` (skills hidden in
 * every mode), and `skills` (name → `{ info, versions }`). `info` remembers the description, file path, and source a
 * skill had when it was last seen unhidden, because a hidden skill no longer shows its own entry in a mode's catalog.
 */

/** The skill name grammar of the DSH skill registry. */
export const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Version ids: `v1`, `v2`, … per skill. */
export const VERSION_ID = /^v[1-9][0-9]{0,5}$/
/** Longest note on a version, in characters. */
export const NOTE_MAX_CHARS = 200

/**
 * The skills one mode hides and the versions it serves, with the global switch applied.
 * @param {object} content - the parsed skills file.
 * @param {string} preset - mode id.
 * @returns {{ off: Set<string>, pins: Map<string, string> }} hidden names, and skill name → version id; a hidden skill is
 *   never also served from a version.
 */
export function policyFor(content, preset) {
  const off = new Set([...content.global?.off ?? [], ...content.presets?.[preset]?.off ?? []])
  const pins = new Map(Object.entries(content.presets?.[preset]?.pins ?? {}).filter(([name]) => !off.has(name)))
  return { off, pins }
}

/**
 * Whether a mode needs the policy row: anything hidden everywhere, or anything set for this mode.
 * @param {object} content - the parsed skills file.
 * @param {string} preset - mode id.
 * @returns {boolean} true when the row must be mounted.
 */
export function needsRow(content, preset) {
  const own = content.presets?.[preset]
  return (content.global?.off ?? []).length > 0 || (own?.off ?? []).length > 0 || Object.keys(own?.pins ?? {}).length > 0 || Object.keys(own?.assigned ?? {}).length > 0
}

/**
 * The modes that serve one version of a skill.
 * @returns {string[]} mode ids, sorted.
 */
export function pinnedBy(content, skill, version) {
  return Object.entries(content.presets ?? {}).filter(([, record]) => record?.pins?.[skill] === version).map(([id]) => id).sort()
}

/**
 * The next version id for a skill. A deleted version's id is never given out again, so a note or a memory of `v3`
 * always means the same content.
 * @param {{ id: string }[] | undefined} versions - the skill's stored versions.
 * @param {number} [last] - the highest number ever given out for this skill.
 * @returns {string} `v<n>`, one above both.
 */
export function nextVersionId(versions, last = 0) {
  const highest = Math.max(0, Number.isInteger(last) ? last : 0, ...(versions ?? []).map(version => Number(VERSION_ID.test(version.id) ? version.id.slice(1) : 0)))
  return `v${highest + 1}`
}

/** Drop empty records so the file stays small and a mode without settings needs no row. */
function tidy(content, preset) {
  const record = content.presets[preset]
  if (record === undefined) return
  if (record.off?.length === 0) delete record.off
  if (record.pins !== undefined && Object.keys(record.pins).length === 0) delete record.pins
  if (Object.keys(record).length === 0) delete content.presets[preset]
}

/**
 * Decide a batch of per-mode changes.
 * @param {object} input - the batch and what it is judged against.
 * @param {unknown} input.changes - `{ preset, skill, enabled?, pin? }` items: `enabled` shows or hides the skill in that mode;
 *   `pin` serves a stored version (`null` returns to the current file).
 * @param {Map<string, { editable: boolean }>} input.modes - the modes that exist.
 * @param {object} input.content - the parsed skills file; left unchanged.
 * @returns {{ results: object[], next: object, presets: Set<string> }} one result per item (`saved`, `unchanged`,
 *   `unknown-preset`, `not-editable`, `invalid`, `unknown-version`), the changed content, and the modes it touched.
 */
export function planSkillChanges({ changes, modes, content }) {
  const next = structuredClone(content)
  next.presets ??= {}
  const touched = new Set()
  const results = []
  for (const change of Array.isArray(changes) ? changes : []) {
    const preset = String(change?.preset)
    const skill = String(change?.skill)
    const done = (status, extra) => results.push({ preset, skill, status, ...extra })
    const mode = modes.get(preset)
    if (mode === undefined) { done('unknown-preset'); continue }
    if (!mode.editable) { done('not-editable'); continue }
    if (!SKILL_NAME.test(skill)) { done('invalid', { code: 'skill-name-invalid' }); continue }
    if (change.enabled !== undefined && typeof change.enabled !== 'boolean') { done('invalid', { code: 'bad-request' }); continue }
    if (change.pin !== undefined && change.pin !== null && (typeof change.pin !== 'string' || !(next.skills?.[skill]?.versions ?? []).some(version => version.id === change.pin))) {
      done('unknown-version')
      continue
    }
    const before = JSON.stringify(next.presets[preset] ?? {})
    const record = next.presets[preset] ??= {}
    if (typeof change.enabled === 'boolean') {
      const off = new Set(record.off ?? [])
      if (change.enabled) off.delete(skill)
      else off.add(skill)
      record.off = [...off].sort()
    }
    if (change.pin !== undefined) {
      record.pins ??= {}
      if (change.pin === null) delete record.pins[skill]
      else record.pins[skill] = change.pin
    }
    tidy(next, preset)
    if (JSON.stringify(next.presets[preset] ?? {}) === before) done('unchanged')
    else {
      touched.add(preset)
      done('saved')
    }
  }
  return { results, next, presets: touched }
}

/**
 * Hide a skill in every mode, or stop hiding it everywhere; per-mode settings are kept.
 * @returns {object} the changed content.
 */
export function withGlobal(content, skill, enabled) {
  const next = structuredClone(content)
  const off = new Set(next.global?.off ?? [])
  if (enabled) off.delete(skill)
  else off.add(skill)
  next.global = { ...next.global, off: [...off].sort() }
  return next
}

/**
 * Remove a version unless a mode serves it.
 * @returns {{ ok: true, next: object } | { ok: false, pinnedBy: string[] }} the changed content, or the modes that pin it.
 */
export function withoutVersion(content, skill, version) {
  const modes = pinnedBy(content, skill, version)
  if (modes.length > 0) return { ok: false, pinnedBy: modes }
  const next = structuredClone(content)
  const record = next.skills?.[skill]
  if (record?.versions !== undefined) {
    // Remember the highest number given out, deleted ones included, so the next version does not reuse it.
    const numbers = [...record.versions.map(entry => entry.id), version].filter(id => VERSION_ID.test(id)).map(id => Number(id.slice(1)))
    record.lastVersion = Math.max(record.lastVersion ?? 0, ...numbers)
    record.versions = record.versions.filter(entry => entry.id !== version)
  }
  return { ok: true, next }
}

/** Remove one surrounding pair of matching quotes from a YAML scalar. */
function unquote(value) {
  const text = value.trim()
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\'')))) {
    return text.startsWith('"') ? text.slice(1, -1).replace(/\\(["\\nt])/g, (_, escaped) => ({ n: '\n', t: '\t' })[escaped] ?? escaped) : text.slice(1, -1).replace(/''/g, '\'')
  }
  return text
}

/**
 * Read a skill file's frontmatter scalars and body. Supports the forms SKILL.md files use: `key: value`, quoted values,
 * and `|` or `>` block scalars; anything else is left out.
 * @param {string} text - the whole SKILL.md (or flat `<name>.md`) file.
 * @returns {{ fields: Record<string, string>, body: string }} top-level string fields and the text after the frontmatter;
 *   without frontmatter, no fields and the whole text.
 */
export function parseSkillFile(text) {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (match === null) return { fields: {}, body: text }
  const fields = {}
  const lines = match[1].split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = /^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/.exec(lines[index])
    if (line === null) continue
    const [, key, raw = ''] = line
    const block = /^([|>])([+-]?)\s*$/.exec(raw.trim())
    if (block === null) {
      if (raw.trim() !== '') fields[key] = unquote(raw)
      continue
    }
    const collected = []
    while (index + 1 < lines.length && (lines[index + 1].trim() === '' || /^[ \t]/.test(lines[index + 1]))) collected.push(lines[++index])
    const indent = Math.min(...collected.filter(entry => entry.trim() !== '').map(entry => /^[ \t]*/.exec(entry)[0].length))
    const rows = collected.map(entry => entry.slice(Number.isFinite(indent) ? indent : 0))
    const joined = block[1] === '|' ? rows.join('\n') : rows.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ')
    fields[key] = block[2] === '+' ? joined : joined.replace(/\s+$/, '')
  }
  return { fields, body: text.slice(match[0].length) }
}

/**
 * Text with LF line endings, for comparing a file with what a browser text area returns.
 * @param {string} text - any text.
 * @returns {string} the text with CRLF and CR turned into LF.
 */
export function plainLines(text) {
  return text.replace(/\r\n?/g, '\n')
}

/**
 * Text written with the line endings a file already uses, so an edit made in a browser does not turn a CRLF file into LF.
 * @param {string} text - the new content.
 * @param {string} current - the file's content now.
 * @returns {string} `text` with CRLF endings when `current` uses them, LF endings otherwise.
 */
export function withLineEndingsOf(text, current) {
  const plain = plainLines(text)
  return current.includes('\r\n') ? plain.replace(/\n/g, '\r\n') : plain
}

/**
 * Whether the page may change a skill's files: a local file that no package owns. Skills inside `node_modules` belong to
 * DSH or a plugin, and a reinstall would replace any change.
 * @param {{ path?: string, source?: string } | undefined} info - the skill's details.
 * @returns {boolean} false for packaged skills, the manager's own entries, and skills without a file.
 */
export function isEditableSkill(info) {
  return typeof info?.path === 'string' && info.source !== 'bundled' && info.source !== 'dsh-preset-manager' && !/[\\/]node_modules[\\/]/.test(info.path)
}
