/** The v2 release gate preserves all 169 IDs; only direct user scope changes may exclude work. */
import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function verifyClosure(ledger,{base=resolve(root,'docs/closure-v2'),checkFiles=true}={}){
 const errors=[],rows=[...(ledger.legacy_tests||[]),...(ledger.supplemental_tests||[])],spec=JSON.parse(await readFile(resolve(root,'docs/closure-v2/spec/ACCEPTANCE_LEDGER.json'),'utf8'));
 const ids=[...spec.legacy_tests,...spec.supplemental_tests].map(r=>r.id).sort(),actual=rows.map(r=>r.id).sort();
 if(JSON.stringify(ids)!==JSON.stringify(actual))errors.push('The exact 169 acceptance IDs must be preserved.');
 if(ledger.issue_coverage?.length!==29)errors.push('The 29 issue mappings must be preserved.');
 const allowedExclusions=new Set(['R3-T04','C10-T02']);
 const scope=ledger.scope_changes?.find(s=>s.source==='Direct user messages'&&s.text?.includes('小屏布局先不用考虑'));
 const release=ledger.release||{},sha=release.build_sha256;
 if(!/^[a-f0-9]{64}$/.test(sha||''))errors.push('Final build hash missing.');
 if(!/^[a-f0-9]{40}$/.test(release.candidate_commit||''))errors.push('Final source commit missing.');
 if(release.open_issue_count!==0)errors.push('Open in-scope issues remain.');
 if(release.package_verified!==true)errors.push('Independent package rebuild not verified.');
 for(const row of rows){
  if(row.status==='EXCLUDED_BY_USER'){
   if(!allowedExclusions.has(row.id)||!scope?.affected_ids.includes(row.id)||!row.scope_reason)errors.push(row.id+': unauthorized exclusion.');
   continue;
  }
  if(row.priority!=='required'||row.status!=='PASS')errors.push(row.id+': required acceptance is '+row.status+'.');
  if(row.build_sha256!==sha||row.tested_commit!==release.candidate_commit)errors.push(row.id+': evidence identity differs.');
  if(!row.actual||!row.executed_at||!row.evidence?.length)errors.push(row.id+': actual result, time or evidence missing.');
  if(checkFiles)for(const file of row.evidence||[]){try{const path=resolve(base,file);await access(path);if(path.endsWith('.json')){const report=JSON.parse(await readFile(path,'utf8'));if(report.status&&report.status!=='PASS')errors.push(row.id+': referenced report not PASS: '+file);if(report.sha256&&report.sha256!==sha)errors.push(row.id+': referenced build differs: '+file);}}catch{errors.push(row.id+': evidence unavailable: '+file);}}
 }
 for(const row of ledger.issue_coverage||[])if(row.status!=='PASS'||!row.acceptance_ids?.length||row.acceptance_ids.some(id=>!rows.some(r=>r.id===id&&['PASS','EXCLUDED_BY_USER'].includes(r.status))))errors.push(row.id+': issue mapping remains open.');
 if(ledger.phases?.length!==12||ledger.phases.some(p=>p.status!=='PASS'))errors.push('All C0-C11 phases must be verified.');
 return errors;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const path=resolve(process.argv[2]||root+'docs/closure-v2/ACCEPTANCE_LEDGER.json');
 try{const ledger=JSON.parse(await readFile(path,'utf8')),errors=await verifyClosure(ledger,{base:dirname(path)});for(const error of errors)console.error(error);console.log(errors.length?'FULL RELEASE NOT PASSED':'Full v2 release acceptance passed.');process.exitCode=errors.length?2:0;}catch(e){console.error(e.message);process.exitCode=1;}
}
