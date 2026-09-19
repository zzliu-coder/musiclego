/** Evidence completeness and build identity, kept separate from native-platform certification. */
import {readFileSync,existsSync} from 'node:fs';import {createHash}from'node:crypto';import {fileURLToPath}from'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const sha=createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),root='docs/completion-2.2.1/',errors=[];
const get=f=>{try{return JSON.parse(readFileSync(root+f));}catch{errors.push(f+' unavailable');return null;}};
const manifest=JSON.parse(readFileSync('dist/manifest.json'));if(manifest.sha256!==sha)errors.push('dist manifest does not match actual HTML');
for(const f of ['core-results.json','browser/results.json','regressions/results.json','transactions/results.json','audio/results.json','soak/soak.json']){const r=get('evidence/'+f);if(!r)continue;if((r.htmlSha256||r.htmlSHA256||r.sha256)!==sha)errors.push(f+' belongs to another build');if(r.status&&r.status!=='PASS'||r.failed>0||(r.checks||[]).some(x=>x.status!=='PASS'))errors.push(f+' has failed checks');}
const req=get('requirements.json');if(!req||req.htmlSha256!==sha)errors.push('requirement receipt build differs');else for(const r of req.requirements){if(r.status!=='PASS'||!r.evidence?.length)errors.push(r.id+' is not closed');for(const e of r.evidence||[])if(!existsSync(e.split('#')[0]))errors.push(r.id+' missing evidence: '+e);}
const visual=get('evidence/visual/review.json');if(!visual||visual.htmlSha256!==sha||visual.status!=='REVIEWED')errors.push('visual review unavailable for this build');
const external=get('external-validation.json');const remaining=(external?.checks||[]).filter(x=>x.status!=='PASS');
if(process.argv.includes('--release'))for(const x of remaining)errors.push(x.name+': '+x.status);
console.log(JSON.stringify({version:manifest.version,htmlSha256:sha,status:errors.length?'NOT_CLOSED':'PASS',scope:process.argv.includes('--release')?'full platform release gate':'implemented requirements and current-environment engineering evidence',errors,unverifiedExternal:remaining},null,2));process.exitCode=errors.length?1:0;
