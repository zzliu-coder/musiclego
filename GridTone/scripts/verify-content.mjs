/** Repeat the complete 2.0 engineering suite; external Mac/origin/listening are separate. */
import{spawnSync}from'node:child_process';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);const out='docs/content-2.0/evidence';mkdirSync(out,{recursive:true});
const tasks=[
 ['build','npm',['run','build'],{}],['core','npm',['test'],{}],
 ['workspace','python3',['tests/verify-workspace-browser.py'],{WORKSPACE_EVIDENCE_DIR:out+'/regression/workspace'}],
 ['reaudit','python3',['tests/verify-workspace-regressions.py','--out',out+'/regression/reaudit'],{}],
 ['design','python3',['tests/verify-design-system.py'],{DESIGN_EVIDENCE_DIR:out+'/regression/design'}],
 ['studio','python3',['tests/verify-studio-browser.py'],{}],
 ['static','python3',['scripts/audit-design-source.py'],{DESIGN_EVIDENCE_DIR:out}],
 ['audio','python3',['tests/verify-studio-audio.py'],{}],
 ['soak','python3',['tests/verify-repair-soak.py','--seconds','600'],{REPAIR_EVIDENCE_DIR:out}],
];
const results=[];for(const[name,cmd,args,extra]of tasks){const start=Date.now(),r=spawnSync(cmd,args,{env:{...process.env,...extra},encoding:'utf8',maxBuffer:48*1024*1024});writeFileSync(`${out}/final-${name}.log`,(r.stdout||'')+(r.stderr||'')+(r.error?.message||''));results.push({name,status:r.status===0?'PASS':'FAIL',exit:r.status,milliseconds:Date.now()-start});console.log(name,results.at(-1).status);if(r.status!==0){console.error((r.stdout||'').slice(-2000),(r.stderr||'').slice(-2000));break;}}
const m=JSON.parse(readFileSync('dist/manifest.json'));const report={version:'2.0.0',sha256:m.sha256,runtimeDigest:m.runtimeDigest,status:results.length===tasks.length&&results.every(r=>r.status==='PASS')?'PASS':'FAIL',results,scope:'Actual Node and Linux Chromium production-page execution, audio render/measurement and ten-minute run. Physical Mac, true-origin save, system-clipboard permission, and human listening require separate evidence.'};writeFileSync(`${out}/engineering.json`,JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
