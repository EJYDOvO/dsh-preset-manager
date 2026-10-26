import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readVersionMeta, restoreVersion, skillLocation, SkillFileError, VERSION_MAX_FILES, writeText, writeVersion } from '../skill-files.js'

async function bundle() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-skill-'))
  const skill = join(root, 'skills', 'pdf')
  await mkdir(join(skill, 'scripts'), { recursive: true })
  await writeFile(join(skill, 'SKILL.md'), '---\nname: pdf\ndescription: v1\n---\nBody v1\n')
  await writeFile(join(skill, 'scripts', 'run.sh'), 'echo v1\n')
  return { root, skill, file: join(skill, 'SKILL.md') }
}

test('tells a bundle directory from a flat file', () => {
  assert.deepEqual(skillLocation('/a/skills/pdf/SKILL.md'), { layout: 'directory', root: '/a/skills/pdf', file: '/a/skills/pdf/SKILL.md' })
  assert.deepEqual(skillLocation('/a/skills/pdf.md'), { layout: 'file', root: '/a/skills/pdf.md', file: '/a/skills/pdf.md' })
})

test('saves a bundle with its resources and restores it over later changes, keeping files the version lacks', async () => {
  const { root, skill, file } = await bundle()
  const dir = join(root, 'versions', 'pdf', 'v1')
  await writeVersion({ path: file, dir, meta: { name: 'pdf', description: 'v1', content: 'Body v1\n' } })
  assert.equal((await readVersionMeta(dir)).layout, 'directory')
  assert.equal(await readFile(join(dir, 'files', 'scripts', 'run.sh'), 'utf8'), 'echo v1\n')
  await writeFile(file, '---\nname: pdf\ndescription: v2\n---\nBody v2\n')
  await writeFile(join(skill, 'scripts', 'run.sh'), 'echo v2\n')
  await writeFile(join(skill, 'extra.txt'), 'added later\n')
  await restoreVersion({ dir, path: file })
  assert.match(await readFile(file, 'utf8'), /Body v1/)
  assert.equal(await readFile(join(skill, 'scripts', 'run.sh'), 'utf8'), 'echo v1\n')
  assert.equal(await readFile(join(skill, 'extra.txt'), 'utf8'), 'added later\n')
  assert.deepEqual((await readdir(join(root, 'versions', 'pdf'))).sort(), ['v1'])
})

test('saves and restores a flat skill file as SKILL.md inside the version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-skill-'))
  const file = join(root, 'notes.md')
  await writeFile(file, '---\nname: notes\ndescription: flat\n---\nFlat v1\n')
  const dir = join(root, 'versions', 'notes', 'v1')
  await writeVersion({ path: file, dir, meta: { name: 'notes', description: 'flat', content: 'Flat v1\n' } })
  assert.equal((await readVersionMeta(dir)).layout, 'file')
  await writeFile(file, 'changed\n')
  await restoreVersion({ dir, path: file })
  assert.match(await readFile(file, 'utf8'), /Flat v1/)
})

test('writes through a linked skill directory to its target instead of replacing the link', async () => {
  const { root, skill } = await bundle()
  const linked = join(root, 'linked')
  // A directory junction needs no extra rights on Windows; elsewhere the type is ignored.
  await symlink(skill, linked, 'junction')
  await writeText(join(linked, 'SKILL.md'), 'through the link\n')
  assert.equal(await readFile(join(skill, 'SKILL.md'), 'utf8'), 'through the link\n')
  const dir = join(root, 'versions', 'pdf', 'v1')
  await writeVersion({ path: join(linked, 'SKILL.md'), dir, meta: { name: 'pdf', description: 'x', content: '' } })
  assert.equal(await readFile(join(dir, 'files', 'SKILL.md'), 'utf8'), 'through the link\n')
})

test('refuses a skill with too many files and leaves no partial version', async () => {
  const { root, skill, file } = await bundle()
  await mkdir(join(skill, 'many'))
  await Promise.all(Array.from({ length: VERSION_MAX_FILES + 1 }, (_, index) => writeFile(join(skill, 'many', `f${index}`), '')))
  const dir = join(root, 'versions', 'pdf', 'v1')
  await assert.rejects(writeVersion({ path: file, dir, meta: { name: 'pdf', description: 'x', content: '' } }), (error) => error instanceof SkillFileError && error.code === 'skill-too-large')
  await assert.rejects(readdir(join(root, 'versions', 'pdf')).then(entries => { if (entries.length > 0) throw new Error(`left ${entries}`) ; throw new Error('empty') }), /empty/)
})
