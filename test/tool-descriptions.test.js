import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../tool-descriptions.js'

function mount(service, config = { preset: 'standard' }) {
  const warnings = []
  const registered = []
  apply({
    on: (event, listener, options) => registered.push({ event, listener, options }),
    get: name => (name === 'dshModes' ? service : undefined),
    logger: { warn: message => warnings.push(message) },
  }, config)
  assert.equal(registered.length, 1)
  return { warnings, registered: registered[0], run: output => registered[0].listener({}, {}, async () => output) }
}

const output = () => ({
  sections: [],
  tools: [
    { name: 'bash', description: 'Execute a command', parameters: { type: 'object' } },
    { name: 'read', description: 'Read a file', parameters: { type: 'object' } },
  ],
})

test('listens to the prompt assembly first in its chain, so its replacement is applied last', () => {
  const { registered } = mount({ toolDescriptions: async () => new Map(), observeTools() {} })
  assert.equal(registered.event, 'system-prompt/assemble')
  assert.deepEqual(registered.options, { prepend: true })
})

test('replaces only the description of overridden tools and leaves the assembly it was given untouched', async () => {
  const seen = []
  const { run } = mount({ toolDescriptions: async id => new Map(id === 'standard' ? [['bash', 'Run commands.']] : []), observeTools: (id, tools) => seen.push([id, tools.map(tool => tool.name)]) })
  const input = output()
  const result = await run(input)
  assert.equal(result.tools[0].description, 'Run commands.')
  assert.deepEqual(result.tools[0].parameters, { type: 'object' })
  assert.equal(result.tools[1], input.tools[1])
  assert.equal(input.tools[0].description, 'Execute a command')
  assert.deepEqual(seen, [['standard', ['bash', 'read']]])
})

test('returns the assembly unchanged when the mode has no overrides, the manager is absent, or the output has no tools', async () => {
  const input = output()
  assert.equal(await mount({ toolDescriptions: async () => new Map(), observeTools() {} }).run(input), input)
  assert.equal(await mount(undefined).run(input), input)
  const bare = { sections: [] }
  assert.equal(await mount({ toolDescriptions: async () => new Map([['bash', 'x']]), observeTools() {} }).run(bare), bare)
})

test('keeps sending the built-in descriptions and warns once when the saved descriptions cannot be read', async () => {
  const { run, warnings } = mount({ toolDescriptions: async () => { throw new Error('damaged file') }, observeTools() {} })
  const input = output()
  assert.equal(await run(input), input)
  assert.equal(await run(input), input)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /standard.*damaged file/)
})
