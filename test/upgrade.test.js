import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { apply } from '../index.js'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const TARBALL = 'https://registry.npmjs.org/dsh-modes/-/dsh-modes-0.99.0.tgz'
const latest = (version = '0.99.0', tarball = TARBALL) => ({ name: 'dsh-modes', version, dist: { tarball } })

/** Serve `document` as the registry's `latest` answer and count the requests. */
function registry(document = latest()) {
  const requests = []
  globalThis.fetch = async (url) => {
    requests.push(url)
    return { ok: true, status: 200, json: async () => document }
  }
  return requests
}

/** A manager whose `installBundle` settles when the test says so. */
function manager(overrides = {}) {
  const calls = { install: [], cancel: [] }
  let settle
  let fail
  const value = {
    registries: async () => ({ registry: 'https://registry.npmjs.org/', fallbackRegistries: [], resolved: null }),
    installBundle: (spec, options) => {
      calls.install.push({ spec, options })
      return new Promise((resolve, reject) => { settle = resolve; fail = reject })
    },
    cancelInstall: async (requestId) => { calls.cancel.push(requestId); return { status: 'cancelled' } },
    ...overrides,
  }
  return { value, calls, resolve: result => settle(result), reject: error => fail(error) }
}

/** Mount the host plugin on a fake context whose profile depends on this package as `dependency`. */
async function mount({ dependency = '0.6.0', pluginManager } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-modes-test-'))
  await writeFile(join(dir, 'package.json'), JSON.stringify({ dependencies: dependency === undefined ? {} : { 'dsh-modes': dependency } }))
  const routes = []
  const listeners = new Map()
  const warnings = []
  apply({
    configEditor: { documentPath: join(dir, 'cordis.patch.yml'), configuration: () => [] },
    provide() {},
    get: name => (name === 'pluginManager' ? pluginManager : undefined),
    inject: (_names, callback) => callback({ effect: effect => effect(), connection: { fetch: { register: route => routes.push(route) } } }),
    on: (event, listener) => { listeners.set(event, listener); return () => listeners.delete(event) },
    logger: { warn: message => warnings.push(message) },
  })
  const call = async (body) => {
    const response = await routes[0].fetch({ json: async () => body })
    return response.json()
  }
  return { call, dir, listeners, warnings }
}

const settled = () => new Promise(resolve => setImmediate(resolve))

test('reports a newer release for a registry install, checks once, and checks again on request', async () => {
  const requests = registry()
  const { call } = await mount({ pluginManager: manager().value })
  const first = await call({ action: 'updateStatus' })
  assert.equal(first.ok, true)
  assert.equal(first.value.latest, '0.99.0')
  assert.equal(first.value.newer, true)
  assert.equal(first.value.canUpgrade, true)
  assert.equal(first.value.source, 'registry')
  assert.equal(first.value.host, 'registry.npmjs.org')
  assert.equal(first.value.commands.rollback, `dsh plugin --profile ${first.value.profile} add dsh-modes@${first.value.version}`)
  await call({ action: 'updateStatus' })
  assert.equal(requests.length, 1)
  await call({ action: 'updateStatus', refresh: true })
  assert.equal(requests.length, 2)
})

test('offers a command, not an upgrade button, for GitHub installs, and does not check development installs', async () => {
  const requests = registry()
  const git = await mount({ dependency: 'github:xiaohai-78/dsh-modes', pluginManager: manager().value })
  const gitStatus = (await git.call({ action: 'updateStatus' })).value
  assert.equal(gitStatus.source, 'git')
  assert.equal(gitStatus.newer, true)
  assert.equal(gitStatus.canUpgrade, false)
  const before = requests.length
  const link = await mount({ dependency: 'link:/work/dsh-modes', pluginManager: manager().value })
  const linkStatus = (await link.call({ action: 'updateStatus', refresh: true })).value
  assert.equal(linkStatus.source, 'link')
  assert.equal(linkStatus.latest, undefined)
  assert.equal(requests.length, before)
})

test('does not check on its own once the switch is off, but still checks when asked, and remembers the switch', async () => {
  const requests = registry()
  const { call, dir } = await mount({ pluginManager: manager().value })
  const off = await call({ action: 'setUpdateCheck', enabled: false })
  assert.equal(off.value.checkUpdates, false)
  assert.equal(off.value.latest, undefined)
  assert.equal(requests.length, 0)
  assert.equal((await call({ action: 'updateStatus' })).value.latest, undefined)
  assert.equal(requests.length, 0)
  assert.equal((await call({ action: 'updateStatus', refresh: true })).value.latest, '0.99.0')
  assert.equal(requests.length, 1)
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.dsh-modes', 'settings.json'), 'utf8')), { version: 1, checkUpdates: false })
})

test('reports a failed check without offering an upgrade, and refuses a tarball that is not this package\'s file', async () => {
  globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED') }
  const down = await mount({ pluginManager: manager().value })
  const status = (await down.call({ action: 'updateStatus' })).value
  assert.match(status.error, /ECONNREFUSED/)
  assert.equal(status.canUpgrade, false)
  registry(latest('0.99.0', 'https://evil.example/dsh-modes/-/dsh-modes-0.99.0.tgz'))
  const wrong = await mount({ pluginManager: manager().value })
  const refused = (await wrong.call({ action: 'updateStatus' })).value
  assert.match(refused.error, /does not point at this package/)
  assert.equal(refused.canUpgrade, false)
})

test('installs the confirmed release through the manager from the registry tarball and reports each phase', async () => {
  registry()
  const stub = manager()
  const { call, listeners } = await mount({ pluginManager: stub.value })
  const started = await call({ action: 'upgrade', version: '0.99.0' })
  assert.equal(started.ok, true)
  assert.equal(started.value.state, 'installing')
  assert.equal(stub.calls.install.length, 1)
  assert.equal(stub.calls.install[0].spec, TARBALL)
  const requestId = stub.calls.install[0].options.requestId
  assert.match(requestId, /^dsh-modes-upgrade-/)
  assert.equal('requestId' in started.value, false)
  listeners.get('plugin-manager/install-state')({ requestId: 'someone-else', phase: 'cancelling' })
  listeners.get('plugin-manager/install-state')({ requestId, phase: 'applying' })
  assert.equal((await call({ action: 'upgradeStatus' })).value.phase, 'applying')
  stub.resolve({ application: 'restart-required', restartReason: 'host-module', changed: true, stage: 'install', target: TARBALL })
  await settled()
  const done = (await call({ action: 'upgradeStatus' })).value
  assert.equal(done.state, 'done')
  assert.equal(done.restartRequired, true)
  assert.equal(done.reason, 'host-module')
  assert.equal(done.to, '0.99.0')
  assert.equal(listeners.has('plugin-manager/install-state'), false)
})

test('an install the manager applied on the spot needs no restart', async () => {
  registry()
  const stub = manager()
  const { call } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  stub.resolve({ application: 'applied', changed: true, stage: 'install', target: TARBALL })
  await settled()
  const done = (await call({ action: 'upgradeStatus' })).value
  assert.equal(done.state, 'done')
  assert.equal(done.restartRequired, false)
})

test('reports a failed install with the installer\'s own words, cleaned of colors and cut to the last lines', async () => {
  registry()
  const stub = manager()
  const { call } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  const output = [...Array.from({ length: 30 }, (_, index) => `line ${index}`), '\u001B[31mERR_PNPM_FETCH_404 not found\u001B[0m'].join('\n')
  stub.resolve({ application: 'failed', changed: false, stage: 'install', target: TARBALL, error: { code: 'incompatible-version', diagnostic: 'needs a newer dsh' }, packageResult: { exitCode: 1, output, truncated: false, logPath: '/x', kind: 'network' } })
  await settled()
  const failed = (await call({ action: 'upgradeStatus' })).value
  assert.equal(failed.state, 'failed')
  assert.equal(failed.failure.code, 'incompatible-version')
  assert.equal(failed.failure.message, 'needs a newer dsh')
  assert.equal(failed.failure.kind, 'network')
  assert.equal(failed.failure.output.split('\n').length, 12)
  assert.match(failed.failure.output, /ERR_PNPM_FETCH_404 not found$/)
  assert.doesNotMatch(failed.failure.output, /\u001B/)
})

test('reports a cancelled install and a manager that throws, and allows another try afterwards', async () => {
  registry()
  const stub = manager()
  const { call } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  const cancel = await call({ action: 'cancelUpgrade' })
  assert.deepEqual(cancel.value, { status: 'cancelled' })
  assert.equal(stub.calls.cancel.length, 1)
  assert.equal(stub.calls.cancel[0], stub.calls.install[0].options.requestId)
  stub.resolve({ application: 'cancelled', changed: false, stage: 'install', target: TARBALL })
  await settled()
  assert.equal((await call({ action: 'upgradeStatus' })).value.state, 'cancelled')
  await call({ action: 'upgrade', version: '0.99.0' })
  stub.reject(new Error('manager crashed'))
  await settled()
  const crashed = (await call({ action: 'upgradeStatus' })).value
  assert.equal(crashed.state, 'failed')
  assert.equal(crashed.failure.message, 'manager crashed')
})

const VERSION = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version
const readSettings = async dir => JSON.parse(await readFile(join(dir, '.dsh-modes', 'settings.json'), 'utf8'))

/** Wait until the settings file satisfies `check`; the note is removed after the install settles. */
async function settingsWhere(dir, check) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const value = await readSettings(dir)
    if (check(value)) return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.fail('the settings file never reached the expected state')
}

test('leaves a note before installing, which the new version reports until it is dismissed', async () => {
  registry()
  const stub = manager()
  const { call, dir } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  const note = (await readSettings(dir)).upgraded
  assert.equal(note.from, VERSION)
  assert.equal(note.to, '0.99.0')
  assert.equal(typeof note.at, 'number')
  assert.equal((await call({ action: 'updateStatus' })).value.upgraded, undefined)
  stub.resolve({ application: 'restart-required', changed: true, stage: 'install', target: TARBALL })
  await settled()
  assert.equal((await readSettings(dir)).upgraded.to, '0.99.0')
  // The new version starts and reads the note the old one left.
  await writeFile(join(dir, '.dsh-modes', 'settings.json'), JSON.stringify({ version: 1, checkUpdates: true, upgraded: { from: '0.5.0', to: VERSION, at: 1 } }))
  const status = (await call({ action: 'updateStatus' })).value
  assert.deepEqual(status.upgraded, { from: '0.5.0', to: VERSION })
  const dismissed = await call({ action: 'dismissUpgraded' })
  assert.equal(dismissed.ok, true)
  assert.equal(dismissed.value.upgraded, undefined)
  assert.deepEqual(await readSettings(dir), { version: 1, checkUpdates: true })
})

test('forgets the note when the install fails or is cancelled', async () => {
  registry()
  const stub = manager()
  const { call, dir } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  stub.resolve({ application: 'failed', changed: false, stage: 'install', target: TARBALL, error: { code: 'install-failed', diagnostic: 'boom' } })
  await settingsWhere(dir, value => value.upgraded === undefined)
  await call({ action: 'upgrade', version: '0.99.0' })
  stub.resolve({ application: 'cancelled', changed: false, stage: 'install', target: TARBALL })
  await settingsWhere(dir, value => value.upgraded === undefined)
})

test('reports a release the profile already holds as installed and waiting for a restart', async () => {
  registry()
  const stub = manager()
  const { call, dir } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  stub.resolve({ application: 'failed', changed: false, stage: 'install', target: TARBALL, error: { code: 'already-installed', diagnostic: 'already installed' } })
  await settled()
  const done = (await call({ action: 'upgradeStatus' })).value
  assert.equal(done.state, 'done')
  assert.equal(done.restartRequired, true)
  assert.equal(done.reason, 'already-installed')
  assert.equal(done.failure, undefined)
  assert.equal((await readSettings(dir)).upgraded.to, '0.99.0')
})

test('an upgrade note that cannot be written is logged and does not stop the upgrade', async () => {
  registry()
  const stub = manager()
  const { call, dir, warnings } = await mount({ pluginManager: stub.value })
  // A file where the state folder should be: the note cannot be written.
  await writeFile(join(dir, '.dsh-modes'), 'not a folder')
  const started = await call({ action: 'upgrade', version: '0.99.0' })
  assert.equal(started.ok, true)
  assert.equal(started.value.state, 'installing')
  assert.equal(stub.calls.install.length, 1)
  assert.ok(warnings.some(text => /upgrade note/.test(text)), JSON.stringify(warnings))
  stub.resolve({ application: 'restart-required', changed: true, stage: 'install', target: TARBALL })
  await settled()
  assert.equal((await call({ action: 'upgradeStatus' })).value.state, 'done')
})

test('a plugin manager that throws at once is reported as a failed upgrade, and another try is allowed', async () => {
  registry()
  let attempts = 0
  const stub = manager({ installBundle: () => { attempts += 1; throw new Error('installer unavailable') } })
  const { call } = await mount({ pluginManager: stub.value })
  await call({ action: 'upgrade', version: '0.99.0' })
  await settled()
  const failed = (await call({ action: 'upgradeStatus' })).value
  assert.equal(failed.state, 'failed')
  assert.equal(failed.failure.message, 'installer unavailable')
  assert.equal((await call({ action: 'upgrade', version: '0.99.0' })).ok, true)
  assert.equal(attempts, 2)
})

test('refuses an upgrade that is not allowed: a second one, a stale confirmation, an install that is not from a registry, or no manager', async () => {
  registry()
  const stub = manager()
  const { call } = await mount({ pluginManager: stub.value })
  assert.equal((await call({ action: 'cancelUpgrade' })).code, 'not-running')
  await call({ action: 'upgrade', version: '0.99.0' })
  assert.equal((await call({ action: 'upgrade', version: '0.99.0' })).code, 'upgrade-running')
  stub.resolve({ application: 'failed', changed: false, stage: 'install', target: TARBALL })
  await settled()
  const stale = await call({ action: 'upgrade', version: '0.98.0' })
  assert.equal(stale.code, 'update-changed')
  assert.equal(stale.details.latest, '0.99.0')
  assert.equal(stub.calls.install.length, 1)
  const git = await mount({ dependency: 'github:xiaohai-78/dsh-modes', pluginManager: manager().value })
  assert.equal((await git.call({ action: 'upgrade', version: '0.99.0' })).code, 'not-upgradable')
  const bare = await mount({ pluginManager: undefined })
  assert.equal((await bare.call({ action: 'upgrade', version: '0.99.0' })).code, 'unavailable')
  registry(latest('0.6.1', 'https://registry.npmjs.org/dsh-modes/-/dsh-modes-0.6.1.tgz'))
  const current = await mount({ dependency: '0.6.1', pluginManager: manager().value })
  assert.equal((await current.call({ action: 'upgrade', version: '0.6.1' })).code, 'up-to-date')
  globalThis.fetch = async () => { throw new Error('offline') }
  const offline = await mount({ pluginManager: manager().value })
  assert.equal((await offline.call({ action: 'upgrade', version: '0.99.0' })).code, 'check-failed')
})
