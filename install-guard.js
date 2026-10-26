/**
 * Keeps a built-in mode loading after dsh-preset-manager is uninstalled.
 *
 * The manager adds rows of its own modules (`dsh-preset-manager/...`) to the profile override of a built-in mode. Uninstalling
 * the package leaves that override behind, and a row whose module cannot be imported makes DSH reject the whole mode.
 * Each such row is therefore saved with a `disabled` condition that is true once `dsh-preset-manager` no longer resolves from
 * the row's resolution base. A live persona replaces the mode's persona row, so it is followed by an official persona
 * row with the same prompt whose condition is the complement: exactly one of the two runs, and the mode keeps its
 * prompt either way. When the check cannot tell (any failure other than a missing package), the manager's rows stay
 * on, as they did before these conditions existed.
 */

export const PERSONA_MODULE = '@deepseek-ai/dsh-persona'
export const LIVE_MODULE = 'dsh-preset-manager/live-persona'
/** The official persona row that stands in for a live persona once dsh-preset-manager is gone. */
export const FALLBACK_ROW_ID = 'dsh-preset-manager-persona-fallback'

/** Every condition this module writes starts with this comment, which is how a saved condition is recognized. */
const MARK = '/* dsh-preset-manager: '
const INSTALLED = "(() => { try { process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('dsh-preset-manager/package.json'); return true } catch (error) { return error?.code !== 'MODULE_NOT_FOUND' } })()"
/** `disabled` of a row the manager added: true once dsh-preset-manager is uninstalled. */
export const WHEN_GONE = `${MARK}off once dsh-preset-manager is uninstalled */ !${INSTALLED}`
/** `disabled` of the stand-in persona row: true while dsh-preset-manager is installed. */
export const WHEN_INSTALLED = `${MARK}on only once dsh-preset-manager is uninstalled */ ${INSTALLED}`

function isExpr(value) {
  return value !== null && typeof value === 'object' && typeof value.__jsExpr === 'string'
}

/** Whether a `disabled` value is a condition this module wrote. */
export function isGuard(value) {
  return isExpr(value) && value.__jsExpr.startsWith(MARK)
}

export function isOwnModule(name) {
  return typeof name === 'string' && name.startsWith('dsh-preset-manager/')
}

function withoutSwitch(row) {
  const { disabled: _disabled, ...rest } = row
  return rest
}

/**
 * The rows of a built-in mode as the manager saves them. Each enabled row of a manager module gets {@link WHEN_GONE};
 * a row switched off with `disabled: true`, or carrying a condition of its own, keeps it. Every enabled live persona
 * is followed by a fresh {@link FALLBACK_ROW_ID} row with its prompt settings, so the stand-in always matches. Any
 * other row loses a condition this module wrote, as when a live persona becomes the official one again.
 * @param {object[]} rows - the mode's row list; group rows are visited.
 * @returns {object[]} a new list; the input is not changed.
 */
export function guardRows(rows) {
  const out = []
  for (const row of rows) {
    if (row?.id === FALLBACK_ROW_ID) continue
    if (row?.group === true && Array.isArray(row.config)) {
      out.push({ ...row, config: guardRows(row.config) })
      continue
    }
    if (!isOwnModule(row?.name)) {
      out.push(isGuard(row?.disabled) ? withoutSwitch(row) : row)
      continue
    }
    if (row.disabled === true || (isExpr(row.disabled) && !isGuard(row.disabled))) {
      out.push(row)
      continue
    }
    out.push({ ...row, disabled: { __jsExpr: WHEN_GONE } })
    if (row.name === LIVE_MODULE) {
      const { preset: _preset, ...config } = row.config ?? {}
      out.push({ id: FALLBACK_ROW_ID, name: PERSONA_MODULE, config, disabled: { __jsExpr: WHEN_INSTALLED } })
    }
  }
  return out
}

/**
 * The rows without anything {@link guardRows} added: for a custom mode, which lives in the manager's own container
 * row and goes away with the package, so it needs no conditions.
 * @param {object[]} rows - the mode's row list; group rows are visited.
 * @returns {object[]} a new list; the input is not changed.
 */
export function unguardRows(rows) {
  const out = []
  for (const row of rows) {
    if (row?.id === FALLBACK_ROW_ID) continue
    if (row?.group === true && Array.isArray(row.config)) out.push({ ...row, config: unguardRows(row.config) })
    else out.push(isGuard(row?.disabled) ? withoutSwitch(row) : row)
  }
  return out
}
