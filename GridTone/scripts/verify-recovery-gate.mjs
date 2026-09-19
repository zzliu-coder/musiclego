import {readFileSync,existsSync} from 'node:fs';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const sha=createHash('sha256').update(readFileSync('dist/index.html')).digest('hex');const failures=[];
for(const file of ['docs/recovery-2.2/evidence/browser/results.json','docs/recovery-2.2/evidence/regressions/results.json','docs/recovery-2.2/evidence/audio-smoke/results.json']){
 if(!existsSync(file)){failures.push(file+' not run');continue;}
 const r=JSON.parse(readFileSync(file)),checks=r.checks||[];
 if((r.htmlSha256||r.htmlSHA256||r.sha256)!==sha)failures.push(file+' build identity differs');
 if(checks.some(x=>x.status!=='PASS'))failures.push(file+' checks failed');
}
if(process.argv.includes('--release'))failures.push('Native macOS Chrome / persistent-origin refresh / perceptual listening not validated by this environment');
console.log(JSON.stringify({status:failures.length?'NOT_CLOSED':'PASS',scope:'recovery engineering evidence (not a Mac release certification)',failures},null,2));process.exitCode=failures.length?1:0;
