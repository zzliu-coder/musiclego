/** Current 2.2.1 verification entry. All commands execute; older receipts remain history. */
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const dir='docs/completion-2.2.1/evidence';mkdirSync(dir+'/soak',{recursive:true});
const jobs=[['build','npm',['run','build']],['core','npm',['test']],['browser','python3',['tests/verify-completion-browser.py']],['regressions','python3',['tests/verify-workspace-regressions.py','--out',dir+'/regressions']],['transactions','python3',['tests/verify-completion-transactions.py']],['audio','python3',['tests/verify-studio-audio.py']],['visual','python3',['tests/verify-completion-visual.py']],['soak','python3',['tests/verify-repair-soak.py','--seconds','600']]];
for(const [name,cmd,args] of jobs){const r=spawnSync(cmd,args,{encoding:'utf8',env:{...process.env,AUDIO_EVIDENCE_DIR:dir+'/audio',REPAIR_EVIDENCE_DIR:dir+'/soak'},maxBuffer:32*1024*1024});writeFileSync(dir+'/'+name+'-latest.log',(r.stdout||'')+(r.stderr||''));console.log(name,r.status===0?'PASS':'FAIL');if(r.status!==0){console.error(r.stderr||r.stdout);process.exit(1);}if(name==='core')writeFileSync(dir+'/core-results.json',JSON.stringify({version:JSON.parse(readFileSync('package.json')).version,htmlSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),status:'PASS',passed:Number(r.stdout.match(/# pass (\d+)/)?.[1]),failed:Number(r.stdout.match(/# fail (\d+)/)?.[1]),skipped:Number(r.stdout.match(/# skipped (\d+)/)?.[1]),command:'npm test',exitCode:r.status},null,2));}
const gate=spawnSync('node',['scripts/verify-completion-gate.mjs'],{stdio:'inherit'});process.exitCode=gate.status||0;
