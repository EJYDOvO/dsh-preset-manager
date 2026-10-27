// Fresh Profile, synthetic bundle/Skills only. No credentials, user Sessions, QQ or Memory are read.
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto'), { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), install = process.env.DSH_INSTALL_ROOT;
if (!install || !path.isAbsolute(install)) throw Error('Set DSH_INSTALL_ROOT to the installed DSH directory');
const home = path.join(root, '.local', 'host-' + randomUUID()), dir = path.join(home, 'profiles', 'manager'), runId = randomUUID();
const packageRoot = process.argv.includes('--packed') ? JSON.parse(fs.readFileSync(path.join(root, '.local', 'packed.json'))).dir : root;
fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
const fixture=path.join(home,'fixture-bundle');fs.cpSync(path.join(root,'test','fixture'),fixture,{recursive:true});
for (const [name, source] of [['dsh-preset-manager', packageRoot], ['dsh-pm-fixture', fixture]]) fs.symlinkSync(source, path.join(dir, 'node_modules', name), 'junction');
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'pm-isolated', private: true, dependencies: { 'dsh-preset-manager': 'link:' + packageRoot, 'dsh-pm-fixture': 'link:' + path.join(root, 'test', 'fixture') }, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-preset-manager', 'dsh-pm-fixture'] } } }));
const probe = pathToFileURL(path.join(root, 'test', 'native-host.js')).href;
fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), JSON.stringify([{ id: 'session-title-llm', disabled: true }, { id: 'llm-pi-ai', disabled: true }, { insert: [{ id: 'pm-probe', name: probe, config: { home, runId, preview: process.argv.includes('--preview') } }] }], null, 2));
fs.mkdirSync(path.join(home, 'tmp'));
fs.writeFileSync(path.join(root, '.local', 'host-run.json'), JSON.stringify({ home, runId, result: path.join(home, 'result.json') }));
console.log(JSON.stringify({ home, runId, credentialsCopied: false }));
