/** Verify this recovery build. Earlier version suites remain historical evidence. */
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const out='docs/recovery-2.2/evidence';mkdirSync(out,{recursive:true});
for(const [name,cmd,args] of [
 ['build','npm',['run','build']],['core','npm',['test']],
 ['browser','python3',['tests/verify-recovery-browser.py']],
 ['regressions','python3',['tests/verify-workspace-regressions.py','--out',out+'/regressions']],
 ['audio-smoke','python3',['tests/verify-recovery-audio.py']]
]){const r=spawnSync(cmd,args,{encoding:'utf8',env:process.env,maxBuffer:16*1024*1024});writeFileSync(out+'/'+name+'.log',(r.stdout||'')+(r.stderr||''));console.log(name,r.status===0?'PASS':'FAIL');if(r.status!==0){console.error(r.stderr||r.stdout);process.exit(1);}}
