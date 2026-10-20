import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isEditableSkill, needsRow, nextVersionId, parseSkillFile, pinnedBy, plainLines, planSkillChanges, policyFor, withGlobal, withLineEndingsOf, withoutVersion } from '../skill-store.js'

const empty = () => ({ version: 1, presets: {}, global: { off: [] }, skills: {} })
const modes = new Map([['standard', { editable: true }], ['research', { editable: true }], ['other', { editable: false }]])
const withVersions = () => ({ ...empty(), skills: { pdf: { versions: [{ id: 'v1' }, { id: 'v2' }] } } })

test('merges the hidden-everywhere list into a mode\'s own list, and a hidden skill is never also pinned', () => {
  const content = { ...empty(), global: { off: ['web'] }, presets: { standard: { off: ['pdf'], pins: { pdf: 'v1', docx: 'v2' } } } }
  const policy = policyFor(content, 'standard')
  assert.deepEqual([...policy.off].sort(), ['pdf', 'web'])
  assert.deepEqual([...policy.pins], [['docx', 'v2']])
  assert.deepEqual([...policyFor(content, 'research').off], ['web'])
})

test('a mode needs the row when anything is hidden everywhere or set for it', () => {
  assert.equal(needsRow(empty(), 'standard'), false)
  assert.equal(needsRow({ ...empty(), global: { off: ['web'] } }, 'standard'), true)
  assert.equal(needsRow({ ...empty(), presets: { standard: { pins: { pdf: 'v1' } } } }, 'standard'), true)
  assert.equal(needsRow({ ...empty(), presets: { standard: { pins: { pdf: 'v1' } } } }, 'research'), false)
})

test('hides, shows, and pins skills in several modes in one batch, leaving the input unchanged', () => {
  const content = withVersions()
  const plan = planSkillChanges({
    changes: [
      { preset: 'standard', skill: 'pdf', enabled: false },
      { preset: 'research', skill: 'pdf', pin: 'v2' },
      { preset: 'research', skill: 'pdf', pin: 'v2' },
    ],
    modes,
    content,
  })
  assert.deepEqual(plan.results.map(result => result.status), ['saved', 'saved', 'unchanged'])
  assert.deepEqual(plan.next.presets, { standard: { off: ['pdf'] }, research: { pins: { pdf: 'v2' } } })
  assert.deepEqual([...plan.presets].sort(), ['research', 'standard'])
  assert.deepEqual(content.presets, {})
})

test('showing a skill again and unpinning it leave no empty record behind', () => {
  const content = { ...withVersions(), presets: { standard: { off: ['pdf'], pins: { pdf: 'v1' } } } }
  const plan = planSkillChanges({ changes: [{ preset: 'standard', skill: 'pdf', enabled: true, pin: null }], modes, content })
  assert.equal(plan.results[0].status, 'saved')
  assert.equal(plan.next.presets.standard, undefined)
})

test('refuses unknown modes, other plugins\' modes, bad names and switches, and versions that do not exist', () => {
  const plan = planSkillChanges({
    changes: [
      { preset: 'ghost', skill: 'pdf', enabled: false },
      { preset: 'other', skill: 'pdf', enabled: false },
      { preset: 'standard', skill: 'Bad Name', enabled: false },
      { preset: 'standard', skill: 'pdf', enabled: 'no' },
      { preset: 'standard', skill: 'pdf', pin: 'v9' },
      { preset: 'standard', skill: 'docx', pin: 'v1' },
    ],
    modes,
    content: withVersions(),
  })
  assert.deepEqual(plan.results.map(result => result.status), ['unknown-preset', 'not-editable', 'invalid', 'invalid', 'unknown-version', 'unknown-version'])
  assert.equal(plan.presets.size, 0)
})

test('hides a skill everywhere and back, keeping per-mode settings', () => {
  const content = { ...empty(), presets: { standard: { pins: { pdf: 'v1' } } } }
  const hidden = withGlobal(content, 'pdf', false)
  assert.deepEqual(hidden.global.off, ['pdf'])
  assert.deepEqual(hidden.presets.standard, { pins: { pdf: 'v1' } })
  assert.deepEqual(withGlobal(hidden, 'pdf', true).global.off, [])
})

test('numbers versions from the highest one and refuses to delete a version a mode serves', () => {
  assert.equal(nextVersionId(undefined), 'v1')
  assert.equal(nextVersionId([{ id: 'v1' }, { id: 'v7' }, { id: 'x' }]), 'v8')
  assert.equal(nextVersionId([{ id: 'v1' }], 3), 'v4', 'a deleted v3 is not given out again')
  assert.equal(nextVersionId([], 3), 'v4')
  const content = { ...withVersions(), presets: { standard: { pins: { pdf: 'v1' } }, research: { pins: { pdf: 'v1' } } } }
  assert.deepEqual(pinnedBy(content, 'pdf', 'v1'), ['research', 'standard'])
  assert.deepEqual(withoutVersion(content, 'pdf', 'v1'), { ok: false, pinnedBy: ['research', 'standard'] })
  const removed = withoutVersion(content, 'pdf', 'v2')
  assert.equal(removed.ok, true)
  assert.deepEqual(removed.next.skills.pdf.versions, [{ id: 'v1' }])
  assert.equal(removed.next.skills.pdf.lastVersion, 2)
  assert.equal(nextVersionId(removed.next.skills.pdf.versions, removed.next.skills.pdf.lastVersion), 'v3')
})

test('reads frontmatter scalars, quoted values, and block scalars, and returns the body after it', () => {
  const text = [
    '---',
    'name: pdf',
    'description: "Read and write PDF files: forms, tables"',
    'whenToUse: >-',
    '  When the user mentions',
    '  a PDF file.',
    'notes: |',
    '  line one',
    '  line two',
    'disable-model-invocation: yes',
    'metadata:',
    '  owner: me',
    '---',
    '# PDF',
    'Body text.',
  ].join('\n')
  const parsed = parseSkillFile(text)
  assert.equal(parsed.fields.name, 'pdf')
  assert.equal(parsed.fields.description, 'Read and write PDF files: forms, tables')
  assert.equal(parsed.fields.whenToUse, 'When the user mentions a PDF file.')
  assert.equal(parsed.fields.notes, 'line one\nline two')
  assert.equal(parsed.fields['disable-model-invocation'], 'yes')
  assert.equal(parsed.fields.owner, undefined)
  assert.equal(parsed.body, '# PDF\nBody text.')
  assert.deepEqual(parseSkillFile('No frontmatter here.'), { fields: {}, body: 'No frontmatter here.' })
})

test('reads a SKILL.md saved with Windows line endings', () => {
  const parsed = parseSkillFile('---\r\nname: pdf\r\ndescription: Read PDFs\r\n---\r\nBody line\r\n')
  assert.equal(parsed.fields.description, 'Read PDFs')
  assert.equal(parsed.body, 'Body line\r\n')
})

test('keeps a file\'s own line endings when a browser edit comes back with LF', () => {
  assert.equal(plainLines('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(withLineEndingsOf('a\nb\n', 'x\r\ny\r\n'), 'a\r\nb\r\n')
  assert.equal(withLineEndingsOf('a\r\nb', 'x\ny'), 'a\nb')
})

test('treats skills inside node_modules as read-only on any platform', () => {
  assert.equal(isEditableSkill({ path: '/Users/me/.dsh/skills/pdf/SKILL.md', source: 'user-dsh' }), true)
  assert.equal(isEditableSkill({ path: 'C:\\Users\\me\\.dsh\\skills\\pdf\\SKILL.md', source: 'user-dsh' }), true)
  assert.equal(isEditableSkill({ path: 'C:\\Program Files\\dsh\\node_modules\\@deepseek-ai\\dsh-agent-preset\\skills\\x\\SKILL.md', source: 'custom' }), false)
  assert.equal(isEditableSkill({ path: '/opt/dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/x/SKILL.md', source: 'custom' }), false)
  assert.equal(isEditableSkill({ path: '/x/SKILL.md', source: 'bundled' }), false)
  assert.equal(isEditableSkill({ source: 'user-dsh' }), false)
})
