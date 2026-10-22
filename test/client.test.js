import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')

/** The entries of one dictionary literal in client.js; keys may be quoted or bare. */
function dictionary(name) {
  const start = source.indexOf(`const ${name} = {`)
  const end = source.indexOf('\n    }\n', start)
  return new Map([...source.slice(start, end).matchAll(/^\s{6}'?([A-Za-z0-9_.-]+)'?: '((?:[^'\\]|\\.)*)',$/gm)].map(match => [match[1], match[2]]))
}

const zh = dictionary('ZH')
const en = dictionary('EN')
/** The `{name}` placeholders of a text; `{{name}}` is prompt syntax shown as is. */
const placeholders = text => [...new Set([...text.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map(match => match[1]))].sort()

test('both languages have the same keys', () => {
  assert.ok(zh.size > 300)
  assert.deepEqual([...zh.keys()].filter(key => !en.has(key)), [])
  assert.deepEqual([...en.keys()].filter(key => !zh.has(key)), [])
})

test('both languages use the same {placeholders} for each key', () => {
  for (const [key, text] of zh) assert.deepEqual(placeholders(text), placeholders(en.get(key)), key)
})

test('every key the page names literally exists', () => {
  const used = new Set([...source.matchAll(/\bt\(\s*'([A-Za-z0-9_.-]+)'/g)].map(match => match[1]))
  assert.ok(used.size > 200)
  assert.deepEqual([...used].filter(key => !zh.has(key)), [])
})
