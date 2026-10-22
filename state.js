/**
 * Profile-local state kept beside the profile patch, under `<profile>/.dsh-modes/`:
 *
 * - `state.json` — per preset, the built-in rows its plugin list was last merged
 *   with (`base`); for a custom preset also the built-in preset it follows
 *   (`origin`) and the starter template it was created from (`template`).
 * - `history.json` — per preset, the most recent prompt versions, oldest first.
 * - `tool-descriptions.json` — per preset, the tool description overrides (`tools`: name → `{ text, base }`) and
 *   the most recent changes to them (`history`, oldest first); read on every model step by the row in tool-descriptions.js.
 * - `settings.json` — the plugin's own switches: `checkUpdates` (default true) allows the automatic version check;
 *   `upgraded` (`{ from, to, at }`) is the upgrade last started from the page, which the new version reports once.
 * - `skills.json` — per-mode skill settings, skills hidden in every mode, and the saved versions of each skill; the
 *   versions' files live in `skill-versions/<skill>/<version>/`. See skill-store.js.
 *
 * Writes replace the file atomically (temporary file, then rename) and run one
 * at a time within this process. A file that exists but cannot be parsed is
 * reported and never overwritten, so a damaged file is not silently replaced.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { renameWithRetry } from './fs-retry.js'

/** Prompt versions kept per preset. */
export const HISTORY_LIMIT = 30

const FILES = {
  state: { name: 'state.json', empty: () => ({ version: 1, presets: {} }) },
  history: { name: 'history.json', empty: () => ({ version: 1, presets: {} }) },
  tools: { name: 'tool-descriptions.json', empty: () => ({ version: 1, presets: {} }) },
  settings: { name: 'settings.json', empty: () => ({ version: 1, checkUpdates: true }), plain: true },
  skills: { name: 'skills.json', empty: () => ({ version: 1, presets: {}, global: { off: [] }, skills: {} }) },
}

/** A state file that exists but is not a JSON object with a `presets` map. */
export class StateFileError extends Error {
  constructor(path, cause) {
    super(`${path} is damaged (${cause instanceof Error ? cause.message : String(cause)}); fix or delete it`)
    this.path = path
  }
}

export class StateStore {
  /**
   * @param {string} dir - directory holding the state files; created on the first write.
   */
  constructor(dir) {
    this.dir = dir
    this.queue = Promise.resolve()
  }

  /**
   * Read one state file.
   * @param {'state' | 'history' | 'tools' | 'settings' | 'skills'} kind - which file.
   * @returns {Promise<{version: number, presets: Record<string, any>}>} its content, or the empty form when absent.
   * @throws {StateFileError} when the file exists but is not valid.
   */
  async read(kind) {
    const { name, empty } = FILES[kind]
    const path = join(this.dir, name)
    let text
    try {
      text = await readFile(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return empty()
      throw new StateFileError(path, error)
    }
    let value
    try {
      value = JSON.parse(text)
    } catch (error) {
      throw new StateFileError(path, error)
    }
    if (FILES[kind].plain === true) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new StateFileError(path, 'expected an object')
    } else if (value === null || typeof value !== 'object' || value.presets === null || typeof value.presets !== 'object') {
      throw new StateFileError(path, 'expected an object with a "presets" map')
    }
    return value
  }

  /**
   * Read, change, and atomically replace one state file, after every earlier update.
   * @param {'state' | 'history' | 'tools' | 'settings' | 'skills'} kind - which file.
   * @param {(current: {version: number, presets: Record<string, any>}) => void} change - mutates the parsed content in place.
   * @returns {Promise<void>} settles once the new content is on disk.
   */
  update(kind, change) {
    const run = this.queue.then(async () => {
      const current = await this.read(kind)
      change(current)
      await mkdir(this.dir, { recursive: true })
      const path = join(this.dir, FILES[kind].name)
      const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporary, `${JSON.stringify(current, null, 2)}\n`)
      await renameWithRetry(temporary, path)
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}
