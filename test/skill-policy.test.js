import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../skill-policy.js'

function mount(service, preset = 'standard') {
  let factory
  const warnings = []
  const invalidations = []
  apply({
    effect: register => register(),
    skills: { registerProvider: create => { factory = create; return () => {} } },
    get: name => (name === 'dshModes' ? service : undefined),
    logger: { warn: message => warnings.push(message) },
  }, { preset })
  const abort = new AbortController()
  const provider = factory({ signal: abort.signal, invalidate: () => invalidations.push(true) })
  return { provider, warnings, invalidations, abort }
}

const version = { meta: { description: 'PDF v1', whenToUse: 'For PDFs', invocation: { modelInvocable: true, userInvocable: false }, content: 'Body v1' }, files: '/v/pdf/v1/files', file: '/v/pdf/v1/files/SKILL.md' }

test('lists an entry nobody may invoke for each hidden skill and the saved version for each pinned one, at the lowest rank', async () => {
  const listeners = []
  const { provider, invalidations } = mount({
    skillPolicy: async () => ({ off: new Set(['web']), pins: new Map([['pdf', 'v1']]) }),
    skillVersion: async (skill, id) => (skill === 'pdf' && id === 'v1' ? version : undefined),
    watchSkills: (listener) => { listeners.push(listener); return () => {} },
  })
  assert.equal(provider.name, 'dsh-modes')
  const candidates = await provider.list({})
  assert.deepEqual(candidates.map(candidate => [candidate.name, candidate.invocation, candidate.rank, candidate.provider]), [
    ['web', { modelInvocable: false, userInvocable: false }, -1000, 'dsh-modes'],
    ['pdf', { modelInvocable: true, userInvocable: false }, -1000, 'dsh-modes'],
  ])
  assert.deepEqual(candidates[1].resourceBase, { kind: 'directory', path: '/v/pdf/v1/files' })
  assert.equal(candidates[1].whenToUse, 'For PDFs')
  const loaded = await provider.get(candidates[1], {})
  assert.equal(loaded.content, 'Body v1')
  assert.equal(loaded.description, 'PDF v1')
  assert.equal(await provider.get(candidates[0], {}), undefined)
  assert.equal(listeners.length, 1)
  listeners[0]()
  assert.equal(invalidations.length, 1)
})

test('skips a pinned version that is gone, and stops listening when the registration ends', async () => {
  let stopped = false
  const { provider, abort } = mount({
    skillPolicy: async () => ({ off: new Set(), pins: new Map([['pdf', 'v9']]) }),
    skillVersion: async () => undefined,
    watchSkills: () => () => { stopped = true },
  })
  assert.deepEqual(await provider.list({}), [])
  abort.abort()
  assert.equal(stopped, true)
})

test('applies nothing and warns once when the manager is missing or its settings cannot be read', async () => {
  assert.deepEqual(await mount(undefined).provider.list({}), [])
  const { provider, warnings } = mount({ skillPolicy: async () => { throw new Error('damaged') }, skillVersion: async () => undefined, watchSkills: () => () => {} })
  assert.deepEqual(await provider.list({}), [])
  assert.deepEqual(await provider.list({}), [])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /standard.*damaged/)
})
