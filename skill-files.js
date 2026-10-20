/**
 * File operations for saved skill versions: copy a skill into a version directory, read it back, and copy a version
 * over the skill's current files. A skill is a bundle directory (`<name>/SKILL.md` plus resources) or a single flat
 * file (`<name>.md`); a flat file is stored as `SKILL.md` inside the version.
 *
 * Paths are resolved through symbolic links first, so a skill directory that is a link is copied from, and written
 * to, its target rather than replaced by a plain directory.
 */
import { cp, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { renameWithRetry } from './fs-retry.js'

/**
 * How links inside a skill are copied: kept as links, except on Windows, where creating a link needs Developer Mode or
 * administrator rights, so the files they point at are copied instead.
 */
const LINKS = process.platform === 'win32' ? { dereference: true } : { verbatimSymlinks: true }

/** Largest skill a version may copy. */
export const VERSION_MAX_BYTES = 25 * 1024 * 1024
export const VERSION_MAX_FILES = 1000

/** A refusal the page can word; `details` carries its parameters. */
export class SkillFileError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

/**
 * Where a skill's files are.
 * @param {string} path - the skill's instruction file, as the registry reports it.
 * @returns {{ layout: 'directory' | 'file', root: string, file: string }} the bundle directory or the flat file.
 */
export function skillLocation(path) {
  return basename(path) === 'SKILL.md'
    ? { layout: 'directory', root: dirname(path), file: path }
    : { layout: 'file', root: path, file: path }
}

/** Count the files and bytes below a directory, without following links, and refuse one past the limits. */
async function measure(root) {
  let files = 0
  let bytes = 0
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await visit(path)
      else {
        files += 1
        if (entry.isFile()) bytes += (await lstat(path)).size
      }
      if (files > VERSION_MAX_FILES || bytes > VERSION_MAX_BYTES) {
        throw new SkillFileError('skill-too-large', `The skill has more than ${VERSION_MAX_FILES} files or ${VERSION_MAX_BYTES} bytes`, { files: VERSION_MAX_FILES, megabytes: VERSION_MAX_BYTES / 1024 / 1024 })
      }
    }
  }
  await visit(root)
}

/**
 * Save a skill as a version: `<dir>/files/` holds its files and `<dir>/meta.json` the fields the registry needs to serve it.
 * The version is written beside its final place and renamed into it, so a failed copy leaves no partial version.
 * @param {{ path: string, dir: string, meta: object }} input - the skill's instruction file, the version directory, and its metadata.
 */
export async function writeVersion({ path, dir, meta }) {
  const location = skillLocation(await realpath(path))
  const staging = `${dir}.partial-${process.pid}-${Date.now()}`
  await mkdir(dirname(dir), { recursive: true })
  try {
    if (location.layout === 'directory') {
      await measure(location.root)
      await cp(location.root, join(staging, 'files'), { recursive: true, ...LINKS })
    } else {
      await mkdir(join(staging, 'files'), { recursive: true })
      await cp(location.file, join(staging, 'files', 'SKILL.md'))
    }
    await writeFile(join(staging, 'meta.json'), `${JSON.stringify({ ...meta, layout: location.layout }, null, 2)}\n`)
    await renameWithRetry(staging, dir)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

/**
 * Read a version's metadata.
 * @returns {Promise<object>} the parsed `meta.json`.
 */
export async function readVersionMeta(dir) {
  return JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'))
}

/**
 * Copy a version over the skill's current files. Files the version does not contain are left in place.
 * @param {{ dir: string, path: string }} input - the version directory and the skill's current instruction file.
 */
export async function restoreVersion({ dir, path }) {
  const location = skillLocation(await realpath(path))
  const meta = await readVersionMeta(dir)
  if (meta.layout === 'directory' && location.layout === 'directory') {
    await cp(join(dir, 'files'), location.root, { recursive: true, force: true, ...LINKS })
  } else {
    await writeText(location.file, await readFile(join(dir, 'files', 'SKILL.md'), 'utf8'))
  }
}

/**
 * Replace a file's text through a temporary file in the same directory, writing to a link's target.
 * @param {string} path - the file to replace.
 * @param {string} text - its new content.
 */
export async function writeText(path, text) {
  const target = await realpath(path)
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, text)
  await renameWithRetry(temporary, target)
}
