import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renameWithRetry } from '../fs-retry.js'

const busy = code => Object.assign(new Error(code), { code })

/** A rename that fails with `codes` in turn, then succeeds. */
function flaky(...codes) {
  const calls = []
  return { calls, renameImpl: async (from, to) => { calls.push([from, to]); if (calls.length <= codes.length) throw busy(codes[calls.length - 1]) } }
}

test('retries on Windows while the file is busy, then renames', async () => {
  const rename = flaky('EPERM', 'EBUSY', 'EACCES')
  await renameWithRetry('a', 'b', { platform: 'win32', delayMs: 1, renameImpl: rename.renameImpl })
  assert.equal(rename.calls.length, 4)
})

test('gives up on Windows after the last attempt with the last error', async () => {
  const rename = flaky('EPERM', 'EPERM', 'EPERM')
  await assert.rejects(renameWithRetry('a', 'b', { platform: 'win32', attempts: 3, delayMs: 1, renameImpl: rename.renameImpl }), { code: 'EPERM' })
  assert.equal(rename.calls.length, 3)
})

test('does not retry elsewhere, nor on Windows for errors that are not about a busy file', async () => {
  const unix = flaky('EPERM')
  await assert.rejects(renameWithRetry('a', 'b', { platform: 'darwin', delayMs: 1, renameImpl: unix.renameImpl }), { code: 'EPERM' })
  assert.equal(unix.calls.length, 1)
  const missing = flaky('ENOENT')
  await assert.rejects(renameWithRetry('a', 'b', { platform: 'win32', delayMs: 1, renameImpl: missing.renameImpl }), { code: 'ENOENT' })
  assert.equal(missing.calls.length, 1)
})
