import assert from 'node:assert/strict'
import { watch } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { SkillFileError, VERSION_MAX_FILES } from '../skill-files.js'
import { copySkill, displayPath, expandHome, findPluginSkills, fingerprint, importRoots, listSkillDirs, newSkillText, readCandidate, replaceSkill, skillFiles, skillRoots, sourceState, suggestName, withName } from '../skill-import.js'
import { parseSkillFile } from '../skill-store.js'

const noLinks = { skip: process.platform === 'win32' && 'file links need Developer Mode on Windows' }

async function skill(root, folder, frontmatter = `name: ${folder}\ndescription: Does ${folder}`) {
  const dir = join(root, folder)
  await mkdir(join(dir, 'scripts'), { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\nBody of ${folder}\n`)
  await writeFile(join(dir, 'scripts', 'run.sh'), 'echo hi\n')
  return dir
}

test('finds the skill folders from the environment, falling back to the home directory', () => {
  assert.deepEqual(skillRoots({}, '/home/u'), { dsh: join('/home/u', '.dsh', 'skills'), agents: join('/home/u', '.agents', 'skills') })
  assert.deepEqual(skillRoots({ DSH_HOME: '/d', DSH_AGENTS_HOME: '/a' }, '/home/u'), { dsh: join('/d', 'skills'), agents: join('/a', 'skills') })
  assert.deepEqual(importRoots({ CODEX_HOME: '/c' }, '/home/u').map(root => [root.source, root.dir]), [
    ['codex', join('/c', 'skills')],
    ['claude', join('/home/u', '.claude', 'skills')],
    ['claude-plugin', join('/home/u', '.claude', 'plugins')],
    ['codex-system', join('/c', 'skills', '.system')],
  ])
})

test('expands and shortens the home directory', () => {
  assert.equal(expandHome('~/x/y', '/home/u'), join('/home/u', 'x', 'y'))
  assert.equal(expandHome('~', '/home/u'), '/home/u')
  // A home directory is written with the platform's separators, so the fixture is too.
  const home = join('/home', 'u')
  assert.equal(displayPath(join(home, 'x'), home), `~${sep}x`)
  assert.equal(displayPath(home, home), '~')
  assert.equal(displayPath(join('/other', 'x'), home), join('/other', 'x'))
})

test('drops the quotes that a copied Windows path carries', () => {
  assert.equal(expandHome('"/a/b c"', '/home/u'), resolve('/a/b c'))
  assert.equal(expandHome(" '~/x' ", '/home/u'), join('/home/u', 'x'))
  assert.equal(expandHome('"/a', '/home/u'), resolve('"/a'))
})

test('suggests a kebab-case name for names DSH would ignore', () => {
  assert.equal(suggestName('My Skill_v2'), 'my-skill-v2')
  assert.equal(suggestName('--A--B--'), 'a-b')
  assert.equal(suggestName('周报'), 'skill')
})

test('writes a new skill whose quoted description reads back unchanged', () => {
  const description = 'Say "hi": a\\b, then stop'
  const { fields, body } = parseSkillFile(newSkillText({ name: 'greet', description }))
  assert.equal(fields.name, 'greet')
  assert.equal(fields.description, description)
  assert.match(body, /^\n# greet/)
})

test('rewrites the frontmatter name and keeps the line endings', () => {
  assert.equal(withName('---\nname: Old\ndescription: d\n---\nbody', 'new'), '---\nname: new\ndescription: d\n---\nbody')
  assert.equal(withName('---\r\nname: Old\r\ndescription: d\r\n---\r\nbody', 'new'), '---\r\nname: new\r\ndescription: d\r\n---\r\nbody')
  assert.equal(withName('---\ndescription: d\n---\n', 'new'), '---\nname: new\ndescription: d\n---\n')
  assert.equal(withName('no frontmatter', 'new'), 'no frontmatter')
})

test('reads a candidate and says why DSH could not use it as it is', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  assert.deepEqual(await readCandidate(await skill(root, 'ok')), { path: join(root, 'ok'), folder: 'ok', name: 'ok', description: 'Does ok' })
  const bad = await readCandidate(await skill(root, 'bad', 'name: My Tool\ndescription: d'))
  assert.equal(bad.problem, 'name-invalid')
  assert.equal(bad.suggested, 'my-tool')
  assert.equal((await readCandidate(await skill(root, 'empty', 'name: empty'))).problem, 'no-frontmatter')
})

test('lists skill folders one level deep, leaving out dot folders and folders without SKILL.md', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  await skill(root, 'b')
  await skill(root, 'a')
  await skill(root, '.system')
  await mkdir(join(root, 'notes'))
  assert.deepEqual(await listSkillDirs(root), [join(root, 'a'), join(root, 'b')])
  assert.deepEqual(await listSkillDirs(join(root, 'missing')), [])
})

test('finds plugin skills and keeps the most recently changed copy of a cached plugin', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-plugins-'))
  const old = await skill(join(root, 'cache', 'market', 'tools', '1.0.0', 'skills'), 'lint')
  const fresh = await skill(join(root, 'cache', 'market', 'tools', '1.1.0', 'skills'), 'lint')
  await utimes(join(old, 'SKILL.md'), new Date(2020, 0, 1), new Date(2020, 0, 1))
  const listed = await skill(join(root, 'marketplaces', 'market', 'plugins', 'docs', 'skills'), 'write')
  assert.deepEqual(await findPluginSkills(root), [fresh, listed].sort())
  assert.deepEqual(await findPluginSkills(join(root, 'missing')), [])
})

test('lists the files of a skill without version control data, links that leave it, or linked folders', noLinks, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const dir = await skill(root, 'links')
  await writeFile(join(root, 'secret.txt'), 'outside\n')
  await mkdir(join(dir, '.git'))
  await writeFile(join(dir, '.git', 'HEAD'), 'ref\n')
  await writeFile(join(dir, '.DS_Store'), 'x')
  await symlink(join(dir, 'scripts', 'run.sh'), join(dir, 'inside.sh'))
  await symlink(join(root, 'secret.txt'), join(dir, 'outside.txt'))
  await symlink(join(dir, 'scripts'), join(dir, 'more'))
  const { files, skipped } = await skillFiles(dir)
  assert.deepEqual(files.map(file => file.rel), ['SKILL.md', 'inside.sh', 'scripts/run.sh'])
  assert.deepEqual(skipped.sort(), ['more', 'outside.txt'])
})

test('refuses a skill with more files than a version may hold', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const dir = await skill(root, 'big')
  await Promise.all(Array.from({ length: VERSION_MAX_FILES }, (_, index) => writeFile(join(dir, `f${index}.txt`), '')))
  await assert.rejects(skillFiles(dir), (error) => error instanceof SkillFileError && error.code === 'skill-too-large')
})

test('fingerprints tell a touched file from a changed one', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const dir = await skill(root, 'print')
  const first = await fingerprint(dir)
  await utimes(join(dir, 'scripts', 'run.sh'), new Date(2021, 0, 1), new Date(2021, 0, 1))
  const touched = await fingerprint(dir)
  assert.notEqual(touched.quick, first.quick)
  assert.equal(touched.content, first.content)
  assert.equal(await sourceState(dir, first), 'same')
  await writeFile(join(dir, 'scripts', 'run.sh'), 'echo changed\n')
  assert.equal(await sourceState(dir, first), 'changed')
  assert.equal(await sourceState(join(root, 'gone'), first), 'missing')
})

test('copies a skill under a new name and leaves no partial folder when the target exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const from = await skill(root, 'source', 'name: My Tool\ndescription: d')
  const to = join(root, 'dest', 'my-tool')
  assert.deepEqual(await copySkill({ from, to, name: 'my-tool' }), { skipped: [] })
  assert.match(await readFile(join(to, 'SKILL.md'), 'utf8'), /^---\nname: my-tool\n/)
  assert.equal(await readFile(join(to, 'scripts', 'run.sh'), 'utf8'), 'echo hi\n')
  await assert.rejects(copySkill({ from, to }))
  assert.deepEqual(await readdir(join(root, 'dest')), ['my-tool'])
})

test('replaces an imported copy in place, and refuses a linked folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const from = await skill(root, 'source')
  const to = join(root, 'dest', 'source')
  await copySkill({ from, to })
  await writeFile(join(from, 'SKILL.md'), '---\nname: source\ndescription: v2\n---\nBody v2\n')
  await replaceSkill({ from, to })
  assert.match(await readFile(join(to, 'SKILL.md'), 'utf8'), /Body v2/)
  assert.deepEqual(await readdir(join(root, 'dest')), ['source'])
  const linked = join(root, 'dest', 'linked')
  await symlink(from, linked, 'junction')
  await assert.rejects(replaceSkill({ from, to: linked }), (error) => error instanceof SkillFileError && error.code === 'skill-linked')
})

test('on Windows writes a copy straight into its folder and leaves an existing folder alone', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const from = await skill(root, 'source', 'name: My Tool\ndescription: d')
  const to = join(root, 'dest', 'my-tool')
  await copySkill({ from, to, name: 'my-tool', platform: 'win32' })
  assert.match(await readFile(join(to, 'SKILL.md'), 'utf8'), /^---\nname: my-tool\n/)
  assert.equal(await readFile(join(to, 'scripts', 'run.sh'), 'utf8'), 'echo hi\n')
  await assert.rejects(copySkill({ from, to, platform: 'win32' }), error => error.code === 'EEXIST')
  assert.deepEqual(await readdir(join(root, 'dest')), ['my-tool'])
  assert.match(await readFile(join(to, 'SKILL.md'), 'utf8'), /name: my-tool/)
})

test('on Windows replaces a skill in its own folder, removing what the source lacks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const from = await skill(root, 'source')
  const to = join(root, 'dest', 'source')
  await copySkill({ from, to })
  await mkdir(join(to, 'old', 'deep'), { recursive: true })
  await writeFile(join(to, 'old', 'deep', 'stale.txt'), 'stale\n')
  await writeFile(join(to, 'scripts', 'extra.sh'), 'extra\n')
  await mkdir(join(to, '.git'))
  await writeFile(join(to, '.git', 'HEAD'), 'ref\n')
  await writeFile(join(from, 'SKILL.md'), '---\nname: source\ndescription: v2\n---\nBody v2\n')
  const before = (await stat(to)).ino
  await replaceSkill({ from, to, platform: 'win32' })
  assert.equal((await stat(to)).ino, before)
  assert.match(await readFile(join(to, 'SKILL.md'), 'utf8'), /Body v2/)
  assert.deepEqual((await readdir(to)).sort(), ['.git', 'SKILL.md', 'scripts'])
  assert.deepEqual(await readdir(join(to, 'scripts')), ['run.sh'])
})

test('replaces a skill whose folder and root are being watched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-manager-import-'))
  const from = await skill(root, 'source')
  const skills = join(root, 'skills')
  const to = join(skills, 'source')
  await copySkill({ from, to })
  const watchers = [watch(skills, () => {}), watch(to, () => {})]
  try {
    await writeFile(join(from, 'SKILL.md'), '---\nname: source\ndescription: v3\n---\nBody v3\n')
    await replaceSkill({ from, to })
    assert.match(await readFile(join(to, 'SKILL.md'), 'utf8'), /Body v3/)
    await copySkill({ from, to: join(skills, 'second') })
    assert.deepEqual((await readdir(skills)).sort(), ['second', 'source'])
  } finally {
    for (const watcher of watchers) watcher.close()
  }
})
