import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
const out='docs/workspace-1.8/evidence';mkdirSync(out,{recursive:true});
const tasks=[['catalog',process.execPath,['scripts/catalog-build.mjs']],['build',process.execPath,['scripts/build.mjs']],['core','npm',['test']],['browser','python3',['tests/verify-workspace-browser.py']],['reaudit','python3',['tests/verify-workspace-regressions.py']],['audio','python3',['tests/verify-repair-audio.py']]];
const results=[];for(const [name,cmd,args]of tasks){const start=Date.now(),r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:32*1024*1024});writeFileSync(`${out}/${name}.log`,(r.stdout||'')+(r.stderr||'')+(r.error?.message||''));results.push({name,status:r.status===0?'PASS':'FAIL',exit:r.status,ms:Date.now()-start});console.log(name,results.at(-1).status);if(r.status!==0)break;}
const manifest=JSON.parse(readFileSync('dist/manifest.json'));writeFileSync(`${out}/engineering.json`,JSON.stringify({status:results.length===tasks.length&&results.every(r=>r.status==='PASS')?'PASS':'FAIL',sha256:manifest.sha256,runtimeDigest:manifest.runtimeDigest,results,scope:'Core and full inline Chromium engineering. Separate origin-persistence, macOS, physical input and listening gates remain applicable.'},null,2));if(results.length!==tasks.length||results.some(r=>r.status!=='PASS'))process.exitCode=1;
