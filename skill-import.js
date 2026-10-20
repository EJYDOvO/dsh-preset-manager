/**
 * Skill folders outside DSH that the page can copy in, and the file work of creating and importing a skill.
 *
 * A skill is a folder holding `SKILL.md` with `name` and `description` frontmatter; Codex, Claude Code, and DSH share
 * that layout. DSH accepts only kebab-case names, so a skill whose name it would ignore is imported under a new name,
 * with the `name` line of its copy rewritten. Imports are copies: a later change to the source reaches DSH only when
 * the skill is imported again, which a fingerprint of the source taken at import time makes visible.
 */
import { createHash } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { renameWithRetry } from './fs-retry.js'
import { SkillFileError, VERSION_MAX_BYTES, VERSION_MAX_FILES } from './skill-files.js'
import { parseSkillFile, SKILL_NAME } from './skill-store.js'

/** Longest description a new skill may have, in characters. */
export const DESCRIPTION_MAX_CHARS = 1024
/** Entries never copied or fingerprinted: version control data and Finder metadata. */
const SKIPPED = new Set(['.git', '.DS_Store'])
/** How deep the Claude Code plugin folder is searched for `skills/` directories. */
const PLUGIN_SEARCH_DEPTH = 6

/**
 * The two folders the page writes skills into, as the filesystem skill provider finds them by default.
 * @param {Record<string, string | undefined>} env - the process environment.
 * @param {string} home - the user's home directory.
 * @returns {{ dsh: string, agents: string }} `<DSH home>/skills`, read by DSH only, and `<agents home>/skills`, which
 *   other agent tools read too.
 */
export function skillRoots(env = process.env, home = homedir()) {
  return {
    dsh: join(env.DSH_HOME || join(home, '.dsh'), 'skills'),
    agents: join(env.DSH_AGENTS_HOME || join(home, '.agents'), 'skills'),
  }
}

/**
 * The folders other agent tools keep skills in. `codex-system` holds the skills Codex ships, which use Codex's own tools.
 * @param {Record<string, string | undefined>} env - the process environment.
 * @param {string} home - the user's home directory.
 * @returns {{ source: string, dir: string }[]} each source and its folder; `claude-plugin` is searched for nested
 *   `skills/` folders, the others are read one level deep.
 */
export function importRoots(env = process.env, home = homedir()) {
  const codex = env.CODEX_HOME || join(home, '.codex')
  const claude = env.CLAUDE_CONFIG_DIR || join(home, '.claude')
  return [
    { source: 'codex', dir: join(codex, 'skills') },
    { source: 'claude', dir: join(claude, 'skills') },
    { source: 'claude-plugin', dir: join(claude, 'plugins') },
    { source: 'codex-system', dir: join(codex, 'skills', '.system') },
  ]
}

/**
 * A path the user typed, made absolute: surrounding quotes are dropped, and a leading `~` is the home directory.
 * @param {string} path - the typed path.
 * @param {string} home - the user's home directory.
 * @returns {string} the absolute path.
 */
export function expandHome(path, home = homedir()) {
  // Windows Explorer's "Copy as path" wraps the path in double quotes.
  const text = path.trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  if (text === '~') return home
  if (text.startsWith('~/') || text.startsWith('~\\')) return join(home, text.slice(2))
  return resolve(text)
}

/**
 * A path for display, with the home directory written as `~`.
 * @param {string} path - an absolute path.
 * @param {string} home - the user's home directory.
 * @returns {string} the shortened path.
 */
export function displayPath(path, home = homedir()) {
  return path === home ? '~' : path.startsWith(`${home}${sep}`) ? `~${sep}${path.slice(home.length + 1)}` : path
}

/**
 * A kebab-case name made from any text, for a skill whose own name DSH would ignore.
 * @param {string} text - the skill's name or folder name.
 * @returns {string} lowercase letters and digits joined by single hyphens; `skill` when nothing is left.
 */
export function suggestName(text) {
  const name = String(text).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '')
  return name === '' ? 'skill' : name
}

/**
 * The text of a new skill's `SKILL.md`.
 * @param {{ name: string, description: string }} input - a valid name and a one-line description.
 * @returns {string} frontmatter with both fields and a heading to write under.
 */
export function newSkillText({ name, description }) {
  return `---\nname: ${name}\ndescription: ${quote(description)}\n---\n\n# ${name}\n\n`
}

/** A YAML double-quoted scalar that both YAML parsers and the page's frontmatter reader read back unchanged. */
function quote(text) {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * A `SKILL.md` with its frontmatter `name` replaced, keeping the file's line endings.
 * @param {string} text - the whole file.
 * @param {string} name - the new name.
 * @returns {string} the file with the first top-level `name:` line of its frontmatter rewritten.
 */
export function withName(text, name) {
  const match = /^(﻿?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(text)
  if (match === null) return text
  const [, open, fields, close] = match
  const replaced = /^name:.*$/m.test(fields) ? fields.replace(/^name:.*$/m, `name: ${name}`) : `name: ${name}${fields.includes('\r\n') ? '\r\n' : '\n'}${fields}`
  return `${open}${replaced}${close}${text.slice(match[0].length)}`
}

/** Whether `child` is `root` or inside it. */
function inside(root, child) {
  const path = relative(root, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

/**
 * The files of a skill folder, in path order: regular files and directories, and links to files inside the folder,
 * which count as the files they point at. Other links are listed in `skipped`.
 * @param {string} root - the skill folder.
 * @returns {Promise<{ files: { path: string, rel: string, size: number, mtime: number }[], skipped: string[] }>} the
 *   files with their path relative to `root`, and the relative paths of links left out.
 */
export async function skillFiles(root) {
  const base = await realpath(root)
  const files = []
  const skipped = []
  let bytes = 0
  const visit = async (dir) => {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      if (SKIPPED.has(entry.name)) continue
      const path = join(dir, entry.name)
      const rel = relative(base, path).split(sep).join('/')
      let info = await lstat(path)
      let source = path
      if (info.isSymbolicLink()) {
        const target = await realpath(path).catch(() => undefined)
        const targetInfo = target === undefined ? undefined : await stat(target).catch(() => undefined)
        if (target === undefined || targetInfo === undefined || !targetInfo.isFile() || !inside(base, target)) {
          skipped.push(rel)
          continue
        }
        info = targetInfo
        source = target
      }
      if (info.isDirectory()) await visit(path)
      else if (info.isFile()) {
        files.push({ path: source, rel, size: info.size, mtime: info.mtimeMs })
        bytes += info.size
        if (files.length > VERSION_MAX_FILES || bytes > VERSION_MAX_BYTES) {
          throw new SkillFileError('skill-too-large', `The skill has more than ${VERSION_MAX_FILES} files or ${VERSION_MAX_BYTES} bytes`, { files: VERSION_MAX_FILES, megabytes: VERSION_MAX_BYTES / 1024 / 1024 })
        }
      } else skipped.push(rel)
    }
  }
  await visit(base)
  return { files, skipped }
}

/**
 * Two fingerprints of a skill folder: `quick` from file paths, sizes, and modification times, and `content` from paths
 * and contents. A matching `quick` means unchanged without reading the files; otherwise `content` decides.
 * @param {string} root - the skill folder.
 * @param {{ quickOnly?: boolean }} options - skip the content hash.
 * @returns {Promise<{ quick: string, content?: string }>} hex SHA-256 digests.
 */
export async function fingerprint(root, { quickOnly = false } = {}) {
  const { files } = await skillFiles(root)
  const quick = createHash('sha256')
  for (const file of files) quick.update(`${file.rel}\0${file.size}\0${Math.trunc(file.mtime)}\n`)
  if (quickOnly) return { quick: quick.digest('hex') }
  const content = createHash('sha256')
  for (const file of files) {
    content.update(`${file.rel}\0`)
    content.update(await readFile(file.path))
    content.update('\n')
  }
  return { quick: quick.digest('hex'), content: content.digest('hex') }
}

/**
 * Whether a skill folder still matches what was imported from it.
 * @param {string} root - the source folder.
 * @param {{ quick?: string, content?: string }} recorded - the fingerprints taken at import time.
 * @returns {Promise<'same' | 'changed' | 'missing'>} `missing` when the folder or its `SKILL.md` is gone.
 */
export async function sourceState(root, recorded) {
  if (!(await stat(join(root, 'SKILL.md')).then(info => info.isFile(), () => false))) return 'missing'
  const quick = await fingerprint(root, { quickOnly: true })
  if (quick.quick === recorded.quick) return 'same'
  const full = await fingerprint(root)
  return full.content === recorded.content ? 'same' : 'changed'
}

/**
 * One skill folder as an import candidate: its frontmatter, and why DSH could not use it as it is.
 * @param {string} dir - a folder holding `SKILL.md`.
 * @returns {Promise<{ path: string, folder: string, name?: string, description?: string, problem?: string,
 *   suggested?: string }>} `problem` is `no-frontmatter` when `name` or `description` is missing and `name-invalid` when
 *   the name is not kebab-case; `suggested` is a usable name for the latter.
 */
export async function readCandidate(dir) {
  const folder = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir
  const { fields } = parseSkillFile(await readFile(join(dir, 'SKILL.md'), 'utf8'))
  const name = typeof fields.name === 'string' ? fields.name.trim() : ''
  const description = typeof fields.description === 'string' ? fields.description.trim() : ''
  if (name === '' || description === '') return { path: dir, folder, ...name === '' ? {} : { name }, ...description === '' ? {} : { description }, problem: 'no-frontmatter' }
  if (!SKILL_NAME.test(name)) return { path: dir, folder, name, description, problem: 'name-invalid', suggested: suggestName(name) }
  return { path: dir, folder, name, description }
}

/**
 * Whether a folder holds a `SKILL.md` file.
 * @param {string} dir - the folder.
 * @returns {Promise<boolean>} false when either is missing.
 */
export async function hasSkillFile(dir) {
  return stat(join(dir, 'SKILL.md')).then(info => info.isFile(), () => false)
}

/**
 * The skill folders directly below a folder; names starting with a dot are left out.
 * @param {string} dir - the folder to read.
 * @returns {Promise<string[]>} absolute folder paths in name order; empty when the folder does not exist.
 */
export async function listSkillDirs(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    // A missing source folder has no skills to offer.
    return []
  }
  const found = []
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if ((entry.isDirectory() || entry.isSymbolicLink()) && await hasSkillFile(path)) found.push(path)
  }
  return found
}

/**
 * Skill folders inside Claude Code plugins: every `skills/<name>/SKILL.md` below the plugin folder. A plugin cached in
 * several versions lists each skill once, from the most recently changed copy.
 * @param {string} root - the Claude Code `plugins` folder.
 * @returns {Promise<string[]>} absolute skill folder paths.
 */
export async function findPluginSkills(root) {
  const byKey = new Map()
  const visit = async (dir, depth) => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      // An unreadable or missing folder holds nothing to list.
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const path = join(dir, entry.name)
      if (entry.name === 'skills') {
        for (const skill of await listSkillDirs(path)) {
          const owner = relative(root, dirname(path)).split(sep)
          // `cache/<market>/<plugin>/<version>/skills/<name>` and `marketplaces/<market>/plugins/<plugin>/skills/<name>`.
          const key = `${owner.slice(0, owner.length > 3 ? 3 : owner.length).join('/')}/${skill.split(sep).pop()}`
          const changed = (await stat(join(skill, 'SKILL.md'))).mtimeMs
          if (!byKey.has(key) || byKey.get(key).changed < changed) byKey.set(key, { path: skill, changed })
        }
      } else if (depth < PLUGIN_SEARCH_DEPTH) await visit(path, depth + 1)
    }
  }
  await visit(root, 0)
  return [...byKey.values()].map(entry => entry.path).sort()
}

/**
 * Write a skill's files into `dir`: every other file first and `SKILL.md` last, so the filesystem provider, which lists a
 * folder once it holds `SKILL.md`, never reads a half-written skill. With `name`, the frontmatter `name` is rewritten.
 * @returns {Promise<Set<string>>} the written paths relative to `dir`, with `/` separators.
 */
async function writeFiles(files, dir, name) {
  const ordered = [...files.filter(file => file.rel !== 'SKILL.md'), ...files.filter(file => file.rel === 'SKILL.md')]
  for (const file of ordered) {
    const target = join(dir, ...file.rel.split('/'))
    await mkdir(dirname(target), { recursive: true })
    const data = await readFile(file.path)
    await writeFile(target, file.rel === 'SKILL.md' && name !== undefined ? withName(data.toString('utf8'), name) : data)
  }
  return new Set(ordered.map(file => file.rel))
}

/**
 * Copy a skill folder to `to`, which must not exist. With `name`, the copy's frontmatter `name` is rewritten.
 *
 * DSH watches every folder in a skill root, and on Windows a watched folder cannot be renamed, so there the copy is
 * written straight into `to`, `SKILL.md` last, and removed again if writing fails. Elsewhere it is written beside `to`
 * and renamed into place, so a failed copy never appears in the root.
 * @param {{ from: string, to: string, name?: string, platform?: string }} input - source folder, new folder, an optional
 *   new name, and the platform whose way of writing to use.
 * @returns {Promise<{ skipped: string[] }>} links left out of the copy, relative to the folder.
 */
export async function copySkill({ from, to, name, platform = process.platform }) {
  const { files, skipped } = await skillFiles(from)
  await mkdir(dirname(to), { recursive: true })
  if (platform === 'win32') {
    await mkdir(to)
    try {
      await writeFiles(files, to, name)
    } catch (error) {
      await rm(to, { recursive: true, force: true })
      throw error
    }
    return { skipped }
  }
  const staging = `${to}.partial-${process.pid}-${Date.now()}`
  try {
    await mkdir(staging, { recursive: true })
    await writeFiles(files, staging, name)
    await renameWithRetry(staging, to)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
  return { skipped }
}

/**
 * Remove what `dir` holds beyond `kept` (relative paths with `/`), and the folders that leave empty. `.git` and
 * `.DS_Store` stay, as a copy never writes them.
 */
async function removeOthers(dir, kept, base = dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue
    const path = join(dir, entry.name)
    const rel = relative(base, path).split(sep).join('/')
    if (entry.isDirectory()) {
      await removeOthers(path, kept, base)
      if ((await readdir(path)).length === 0 && ![...kept].some(file => file.startsWith(`${rel}/`))) await rm(path, { recursive: true, force: true })
    } else if (!kept.has(rel)) await rm(path, { force: true })
  }
}

/**
 * Replace an existing skill folder with a copy of another. A linked folder is refused: replacing it would change another
 * tool's files, which an import never does.
 *
 * On Windows, where the watched folder cannot be renamed, its files are overwritten in place (`SKILL.md` last) and files
 * the source lacks are removed; a failure part way leaves a mix, which the version saved before the import restores.
 * Elsewhere the new copy is completed first and swapped in, and the old folder is removed only after the swap.
 * @param {{ from: string, to: string, name?: string, platform?: string }} input - source folder, folder to replace, an
 *   optional new name, and the platform whose way of writing to use.
 * @returns {Promise<{ skipped: string[] }>} links left out of the copy.
 */
export async function replaceSkill({ from, to, name, platform = process.platform }) {
  if ((await lstat(to)).isSymbolicLink()) throw new SkillFileError('skill-linked', `The skill folder ${to} is a link`, {})
  const target = await realpath(to)
  if (platform === 'win32') {
    const { files, skipped } = await skillFiles(from)
    await removeOthers(target, await writeFiles(files, target, name))
    return { skipped }
  }
  const fresh = `${target}.import-${process.pid}-${Date.now()}`
  const old = `${target}.old-${process.pid}-${Date.now()}`
  const result = await copySkill({ from, to: fresh, name, platform })
  try {
    await renameWithRetry(target, old)
  } catch (error) {
    await rm(fresh, { recursive: true, force: true })
    throw error
  }
  try {
    await renameWithRetry(fresh, target)
  } catch (error) {
    await renameWithRetry(old, target)
    await rm(fresh, { recursive: true, force: true })
    throw error
  }
  await rm(old, { recursive: true, force: true })
  return result
}
