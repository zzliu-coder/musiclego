/** Actual-file release checks. This gate never upgrades an unexecuted device/user test. */
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const digest=x=>createHash('sha256').update(x).digest('hex');
export function reportProblems(q,hash,kind,min=0){
 const e=[];if(!q||q.sha256!==hash)e.push('wrong or missing build');
 const checks=q?.checks||q?.results;
 if(kind==='browser'){if(!Array.isArray(checks)||checks.length<min||checks.some(x=>x.status!=='PASS'))e.push('incomplete browser cases');const c=q?.counts||q?.summary;if(!c||c.PASS!==checks?.length||c.FAIL)e.push('browser counts differ');}
 if(kind==='soak'){if(q?.status!=='PASS'||q.wallSeconds<1800||q.iterations<100||!q.records?.length||q.pageErrors?.length||q.final?.sources||q.final?.previews||q.final?.errors)e.push('30-minute run incomplete');}
 if(kind==='audio'){if(q?.status!=='PASS'||q.counts?.presets!==76||q.counts?.combinations!==26||q.counts?.legacyWithinQuantization!==55)e.push('audio regression incomplete');}
 return e;
}
export function inspect(root,{release=false}={}){
 const errors=[],blocked=[],read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
 try{
  const m=read('dist/manifest.json'),pkg=read('package.json'),raw=readFileSync(resolve(root,'dist/index.html')),a=read('assets.json');
  if(m.sha256!==digest(raw)||m.bytes!==raw.length||m.version!==pkg.version)errors.push('build/bytes/version do not match');
  for(const f of ['乐构.html','声格.html'])if(digest(readFileSync(resolve(root,f)))!==m.sha256)errors.push(f+' differs');
  const h=createHash('sha256');for(const f of ['assets.json','package.json',...a.styles,...a.scripts]){h.update(f+'\0');h.update(readFileSync(resolve(root,f)));h.update('\0');}if(h.digest('hex')!==m.runtimeDigest)errors.push('production sources differ');
  const base='docs/magnet-2.1/evidence/';
  for(const[file,n]of [['workspace-final/results.json',45],['reaudit-final/results.json',16],['design-final-v2/results.json',34],['studio-final-v2/results.json',29],['magnet-browser/results.json',25]])for(const err of reportProblems(read(base+file),m.sha256,'browser',n))errors.push(file+': '+err);
  for(const[file,kind]of [['audio-final-v2/results.json','audio'],['soak-final/soak.json','soak']])for(const err of reportProblems(read(base+file),m.sha256,kind))errors.push(file+': '+err);
  const core=read(base+'core-final.json');if(core.sha256!==m.sha256||core.runtimeDigest!==m.runtimeDigest||core.exit!==0||core.failed!==0||core.passed<333||core.skipped!==0)errors.push('core evidence incomplete/stale');
  const log=readFileSync(resolve(root,base+core.log));if(digest(log)!==core.logSha256)errors.push('core log changed');
  const visuals=read(base+'final-visual/manifest.json');if(visuals.sha256!==m.sha256||visuals.screens.length<61||visuals.screens.some(s=>s.pageErrors?.length))errors.push('visual evidence incomplete');
  for(const s of visuals.screens)if(!existsSync(resolve(root,base+'final-visual/'+s.file)))errors.push('missing image '+s.file);
  const dirs=read(base+'directions/manifest.json');if(dirs.sha256!==m.sha256||dirs.screens.length!==12)errors.push('A/B/C comparisons incomplete');
  for(const st of new Set(dirs.screens.map(s=>s.state))){const xs=dirs.screens.filter(s=>s.state===st);if(xs.length!==3||xs.some(s=>JSON.stringify(s.geometry)!==JSON.stringify(xs[0].geometry)||s.documentHash!==xs[0].documentHash))errors.push('directions change content/geometry');}
  const audit=read(base+'static/static-design-audit.json');if(audit.status!=='PASS')errors.push('static design audit failed');
  const files=read(base+'engineering.json');if(files.sha256!==m.sha256||files.runtimeDigest!==m.runtimeDigest||files.status!=='PASS')errors.push('engineering receipt incomplete');
  for(const receipt of files.receipts||[]){const f=resolve(root,receipt.path);if(!existsSync(f)||digest(readFileSync(f))!==receipt.sha256)errors.push('receipt differs '+receipt.path);}
  const acceptance=read('docs/magnet-2.1/acceptance.json');if(acceptance.sha256!==m.sha256||acceptance.cases.length!==36)errors.push('blueprint inventory incomplete');
  for(const item of acceptance.cases){if(item.status==='FAIL'||item.status==='NOT_RUN')errors.push(item.id+' is '+item.status);if(item.status!=='PASS')blocked.push(item.id+': '+item.status+' — '+item.reason);}
  if(release)for(const x of read('docs/magnet-2.1/external-checks.json').checks){if(!x.required)continue;if(x.status!=='PASS'||!x.evidence){blocked.push(x.id+': '+x.status+' — '+x.title);continue;}const result=read(x.evidence);if(result.sha256!==m.sha256||result.status!=='PASS')errors.push(x.id+' evidence wrong build');}
 }catch(e){errors.push(e.message);}
 return {status:errors.length?'FAIL':release&&blocked.length?'NOT_RELEASE_CLOSED':'PASS',engineeringErrors:errors,externalGaps:blocked,scope:release?'Blueprint and external release closure':'Reproducible engineering evidence; external gaps remain separately visible'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=inspect(resolve(dirname(fileURLToPath(import.meta.url)),'..'),{release:process.argv.includes('--release')});console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:2;}
