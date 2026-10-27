import { test } from 'node:test'
import assert from 'node:assert/strict'
import { schemaForm } from '../schema-form.js'
test('projects literal native wrappers and refs while retaining complex JSON fallback', () => {
  const schema = { anyOf: [{ type: 'object', required: ['count'], properties: {
    count: { anyOf: [{ type: ['integer','null'], minimum: 1 }, { $ref: '#/$defs/loaderExpression' }] },
    enabled: { $ref: '#/$defs/flag' }, mode: { enum: ['a','b'] }, nested: { type: 'object' },
    union: { anyOf: [{ type: 'string' }, { type: 'boolean' }] }
  } }, { $ref: '#/$defs/loaderExpression' }], $defs: { flag: { type: 'boolean', default: true } } }
  const result = schemaForm(schema)
  assert.deepEqual(result.fields.map(f => [f.key, f.type, f.required]), [['count','integer',true],['enabled','boolean',false],['mode','enum',false]])
  assert.equal(result.fields[0].minimum, 1); assert.equal(result.fields[1].default, true)
  assert.deepEqual(result.fallback, ['nested','union'])
  assert.equal(schemaForm(schema, ['Unsupported projection']), null)
})
test('unsupported, cyclic or non-object schemas always fall back to JSON', () => {
  for (const schema of [null, { type: 'string' }, { oneOf: [{type:'object'}] }, { $ref: '#/$defs/loop', $defs: { loop: { $ref:'#/$defs/loop' } } }]) assert.equal(schemaForm(schema), null)
})
