/**
 * Three-way merge of a preset's plugin rows onto a newer built-in row list.
 *
 * Inputs are the user's rows, the latest built-in rows, and the built-in rows the
 * user's list was last merged with (`base`). Rows are matched by id. A row the
 * user left as it was in `base` takes the latest built-in version; a row the user
 * changed keeps each field the user changed and takes every other field from the
 * latest version (one level deep inside `config`). When both sides changed the
 * same field, the user's value wins and the field is reported as a conflict.
 * New built-in rows are added in built-in order; rows the built-in list dropped
 * are dropped too unless user-modified (reported as a conflict) or accepted by
 * `keep`. User-added rows survive at every nesting level. Without a `base`, the
 * latest rows serve as the base, so every difference counts as the user's.
 */

/** JSON with sorted keys, so a YAML round trip that reorders keys is not a change. */
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function same(left, right) {
  return stable(left) === stable(right)
}

function isGroup(row) {
  return row !== null && typeof row === 'object' && row.group === true && Array.isArray(row.config)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.__jsExpr !== 'string'
}

/** Every row with an id, group rows and their nested rows included, keyed by id. */
export function allRowsById(rows, found = new Map()) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row?.id === 'string') found.set(row.id, row)
    if (isGroup(row)) allRowsById(row.config, found)
  }
  return found
}

function pick(base, user, latest, conflicts, label) {
  if (same(user, base)) return latest
  if (same(latest, base) || same(latest, user)) return user
  conflicts.push(label)
  return user
}

function keysOf(...records) {
  return [...new Set(records.flatMap(record => Object.keys(record)))]
}

/** Merge one row field by field; `config` objects merge one level deep. */
function mergeFields(base, user, latest, conflicts, id) {
  const out = {}
  for (const key of keysOf(latest, user, base)) {
    let value
    if (key === 'config' && isRecord(base.config) && isRecord(user.config) && isRecord(latest.config)) {
      value = {}
      for (const name of keysOf(latest.config, user.config, base.config)) {
        const merged = pick(base.config[name], user.config[name], latest.config[name], conflicts, `${id}.config.${name}`)
        if (merged !== undefined) value[name] = merged
      }
    } else {
      value = pick(base[key], user[key], latest[key], conflicts, `${id}.${key}`)
    }
    if (value !== undefined) out[key] = structuredClone(value)
  }
  return out
}

/**
 * Merge `userRows` onto `latestRows`.
 * @param {object[]} userRows - the preset's current rows.
 * @param {object[]} latestRows - the latest built-in rows.
 * @param {object[] | undefined} baseRows - the built-in rows `userRows` were last merged with.
 * @param {{newRow?: (row: object) => object, keep?: (row: object) => boolean, preserveLayout?: boolean}} [options] -
 *   `newRow` adjusts a row the built-in list added since `base`; `keep` retains a row the built-in list does not have.
 * @returns {{rows: object[], changed: boolean, summary: {added: string[], removed: string[], updated: string[], conflicts: string[]}}}
 *   the merged rows, whether they differ from `userRows`, and the row ids each kind of change touched.
 */
export function rebase(userRows, latestRows, baseRows, options = {}) {
  const newRow = options.newRow ?? (row => row), keep = options.keep ?? (() => false)
  const summary = { added: [], removed: [], updated: [], conflicts: [] }
  const keyed = list => new Map((list ?? []).filter(row => typeof row?.id === 'string').map(row => [row.id, row]))
  const merge = (mine, latest, original) => {
    const user = keyed(mine), base = original === undefined ? undefined : keyed(original), latestIds = keyed(latest)
    const output = []
    for (const row of latest ?? []) {
      const id = typeof row?.id === 'string' ? row.id : undefined
      if (id === undefined) { output.push(structuredClone(row)); continue }
      const own = user.get(id), before = base === undefined ? (own === undefined ? undefined : row) : base.get(id)
      if (own === undefined) {
        if (before !== undefined && options.preserveLayout) continue
        if (before === undefined) summary.added.push(id)
        output.push(before === undefined ? newRow(structuredClone(row)) : structuredClone(row)); continue
      }
      if (before !== undefined && !same(before, row)) summary.updated.push(id)
      if (isGroup(row) && isGroup(own)) {
        const { config: _next, ...nextFields } = row, { config: _own, ...ownFields } = own
        const { config: _old, ...oldFields } = before ?? row
        output.push({ ...mergeFields(oldFields, ownFields, nextFields, summary.conflicts, id), config: merge(own.config, row.config, isGroup(before) ? before.config : undefined) })
      } else output.push(mergeFields(before ?? row, own, row, summary.conflicts, id))
    }
    // This pass belongs to EACH sibling list; a root-only pass loses additions inside Groups.
    let previous
    for (const row of mine ?? []) {
      const id = typeof row?.id === 'string' ? row.id : undefined
      if (id !== undefined && !latestIds.has(id)) {
        const added = base !== undefined && !base.has(id), modified = base?.has(id) && !same(base.get(id), row)
        if (keep(row) || added || modified) {
          const at = previous === undefined ? -1 : output.findIndex(candidate => candidate.id === previous)
          output.splice(at + 1, 0, structuredClone(row))
          if (modified) summary.conflicts.push(id + ':removed-upstream')
        } else { summary.removed.push(id); continue }
      }
      if (id !== undefined) previous = id
    }
    if (!options.preserveLayout || base === undefined) return output
    const remaining = keyed(output), ordered = []
    for (const row of mine ?? []) if (remaining.has(row.id)) { ordered.push(remaining.get(row.id)); remaining.delete(row.id) }
    for (const row of output) if (typeof row.id !== 'string' || remaining.has(row.id)) { ordered.push(row); remaining.delete(row.id) }
    return ordered
  }
  const rows = merge(userRows, latestRows, baseRows)
  return { rows, changed: !same(rows, userRows), summary }
}
