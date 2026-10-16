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
 * are dropped too, except rows `keep` accepts, which stay after their previous
 * neighbour. Without a `base` (a list saved before bases were recorded), the
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
 * @param {{newRow?: (row: object) => object, keep?: (row: object) => boolean}} [options] -
 *   `newRow` adjusts a row the built-in list added since `base`; `keep` retains a row the built-in list does not have.
 * @returns {{rows: object[], changed: boolean, summary: {added: string[], removed: string[], updated: string[], conflicts: string[]}}}
 *   the merged rows, whether they differ from `userRows`, and the row ids each kind of change touched.
 */
export function rebase(userRows, latestRows, baseRows, options = {}) {
  const newRow = options.newRow ?? (row => row)
  const keep = options.keep ?? (() => false)
  const user = allRowsById(userRows)
  const base = baseRows === undefined ? undefined : allRowsById(baseRows)
  const latestIds = allRowsById(latestRows)
  const summary = { added: [], removed: [], updated: [], conflicts: [] }

  const visit = list => list.map((latest) => {
    const id = typeof latest?.id === 'string' ? latest.id : undefined
    if (id === undefined) return structuredClone(latest)
    const mine = user.get(id)
    const original = base === undefined ? (mine === undefined ? undefined : latest) : base.get(id)
    if (mine === undefined) {
      if (original !== undefined) return structuredClone(latest)
      summary.added.push(id)
      return newRow(structuredClone(latest))
    }
    if (original !== undefined && !same(original, latest)) summary.updated.push(id)
    if (isGroup(latest)) {
      const { config: _latestRows, ...latestOwn } = latest
      const { config: _userRows, ...userOwn } = mine
      const { config: _baseRows, ...baseOwn } = original ?? latest
      return { ...mergeFields(baseOwn, userOwn, latestOwn, summary.conflicts, id), config: visit(latest.config) }
    }
    return mergeFields(original ?? latest, mine, latest, summary.conflicts, id)
  })
  const rows = visit(Array.isArray(latestRows) ? latestRows : [])

  let previous
  for (const row of Array.isArray(userRows) ? userRows : []) {
    const id = typeof row?.id === 'string' ? row.id : undefined
    if (id !== undefined && !latestIds.has(id)) {
      const userAdded = base !== undefined && !base.has(id)
      if (keep(row) || userAdded) {
        const at = previous === undefined ? -1 : rows.findIndex(candidate => candidate?.id === previous)
        rows.splice(at + 1, 0, structuredClone(row))
      } else {
        summary.removed.push(id)
        continue
      }
    }
    if (id !== undefined) previous = id
  }
  return { rows, changed: !same(rows, userRows), summary }
}
