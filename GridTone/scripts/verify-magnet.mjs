/** Reproduce all engineering checks. Approx.40min including a real30-minute run. */
import{spawnSync}from'node:child_process';import{writeFileSync,mkdirSync}from'node:fs';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);const out='docs/magnet-2.1/evidence';mkdirSync(out,{recursive:true});
const tasks=[
 ['build','npm',['run','build'],{}],['core','node',['scripts/record-core.mjs'],{}],
 ['workspace','python3',['tests/verify-workspace-browser.py'],{WORKSPACE_EVIDENCE_DIR:out+'/workspace-final'}],
 ['reaudit','python3',['tests/verify-workspace-regressions.py','--out',out+'/reaudit-final'],{}],
 ['design','python3',['tests/verify-design-system.py'],{DESIGN_EVIDENCE_DIR:out+'/design-final-v2'}],
 ['studio','python3',['tests/verify-studio-browser.py'],{STUDIO_EVIDENCE_DIR:out+'/studio-final-v2'}],
 ['magnet','python3',['tests/verify-magnet-browser.py'],{}],
 ['static','python3',['scripts/audit-design-source.py'],{DESIGN_EVIDENCE_DIR:out+'/static'}],
 ['audio','python3',['tests/verify-studio-audio.py'],{AUDIO_EVIDENCE_DIR:out+'/audio-final-v2',LEGOU_LEGACY_HTML:root+'/tests/fixtures/v2.0/app.html'}],
 ['compat','node',['tests/verify-magnet-backcompat.mjs'],{}],
 ['visual','python3',['tests/verify-magnet-visual.py'],{}],
 ['details','python3',['tests/capture-magnet-extra.py'],{}],
 ['directions','python3',['tests/capture-magnet-directions.py'],{}],
 ['performance','python3',['tests/measure-magnet-performance.py'],{}],
 ['workload','python3',['tests/measure-magnet-workload.py'],{}],
 ['soak','python3',['tests/verify-repair-soak.py','--seconds','1800'],{REPAIR_EVIDENCE_DIR:out+'/soak-final'}],
 ['receipts','node',['scripts/record-magnet-evidence.mjs'],{}],
 ['gate','node',['scripts/verify-magnet-gate.mjs'],{}]
];
for(const[name,cmd,args,env]of tasks){const start=Date.now(),r=spawnSync(cmd,args,{env:{...process.env,...env},encoding:'utf8',maxBuffer:64*1024*1024});writeFileSync(out+'/runner-'+name+'.log',(r.stdout||'')+(r.stderr||'')+(r.error?.message||''));console.log(name,r.status===0?'PASS':'FAIL',Date.now()-start+'ms');if(r.status!==0){console.error((r.stdout||'').slice(-4000),(r.stderr||'').slice(-4000));process.exit(r.status||1);}}
