// Native integration fixture only. Called after phase 0 Host exits; no live Profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const project=path.resolve(__dirname,'..'),run=JSON.parse(fs.readFileSync(project+'/.local/host-run.json'));
const home=path.resolve(run.home);assert(home.startsWith(path.join(project,'.local','host-')));
const old=path.join(home,'profiles/manager'),next=path.join(home,'profiles/manager-next'),backup=path.join(home,'profiles/manager-before');
const digest=dir=>{const entries={};function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);assert(!e.isSymbolicLink());if(e.isDirectory())walk(f);else entries[path.relative(dir,f)]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}}walk(dir);return entries;};
assert(fs.existsSync(path.join(home,'restart.json')));fs.mkdirSync(path.join(next,'node_modules'),{recursive:true});
for(const file of ['package.json','cordis.patch.yml'])fs.copyFileSync(path.join(old,file),path.join(next,file));
for(const name of ['dsh-preset-manager','dsh-pm-fixture'])fs.symlinkSync(fs.realpathSync(path.join(old,'node_modules',name)),path.join(next,'node_modules',name),'junction');
const before=digest(path.join(old,'.dsh-preset-manager'));fs.cpSync(path.join(old,'.dsh-preset-manager'),path.join(next,'.dsh-preset-manager'),{recursive:true});assert.deepEqual(digest(path.join(next,'.dsh-preset-manager')),before);
// Simulate an upstream Bundle update without altering the repository fixture.
const patch=path.join(home,'fixture-bundle/cordis.patch.yml');fs.appendFileSync(patch,'\n        # Other Presets follow the upstream source unchanged.\n');
// The existing fixture has two top-level Presets. Add a new standalone row to the first one's plugins.
let text=fs.readFileSync(patch,'utf8');text=text.replace('  - id: pm-worker-preset','        - id: upstream-new\n          name: "@deepseek-ai/dsh-persona"\n          disabled: true\n          config: { prefix: "Upstream v2 additive row" }\n  - id: pm-worker-preset');fs.writeFileSync(patch,text);
fs.renameSync(old,backup);try{fs.renameSync(next,old);}catch(error){fs.renameSync(backup,old);throw error;}
fs.writeFileSync(path.join(home,'profile-switch.json'),JSON.stringify({copied:Object.keys(before).length,unchanged:JSON.stringify(digest(path.join(old,'.dsh-preset-manager')))===JSON.stringify(before)}));
