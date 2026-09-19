/** Strict release gate: implementation evidence and external evidence are not conflated. */
import{readFileSync,existsSync}from'node:fs';import{createHash}from'node:crypto';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),read=f=>JSON.parse(readFileSync(resolve(root,f),'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');let errors=[];
try{
 const m=read('dist/manifest.json'),p=read('package.json'),bytes=readFileSync(resolve(root,'dist/index.html'));
 if(m.sha256!==sha(bytes)||m.bytes!==bytes.length||m.version!==p.version)errors.push('HTML/manifest/version mismatch');
 for(const f of ['乐构.html','声格.html'])if(sha(readFileSync(resolve(root,f)))!==m.sha256)errors.push(f+' differs');
 const a=read('assets.json'),h=createHash('sha256');for(const f of ['assets.json','package.json',...a.styles,...a.scripts]){h.update(f+'\0');h.update(readFileSync(resolve(root,f)));h.update('\0');}if(h.digest('hex')!==m.runtimeDigest)errors.push('Runtime sources differ from build');
 const base='docs/content-2.0/evidence/',r=read(base+'engineering.json'),expected=['build','core','workspace','reaudit','design','studio','static','audio','soak'];
 if(r.sha256!==m.sha256||r.runtimeDigest!==m.runtimeDigest||r.status!=='PASS'||r.results.length!==expected.length||expected.some(n=>r.results.filter(x=>x.name===n&&x.status==='PASS'&&x.exit===0).length!==1))errors.push('Engineering checks incomplete or from a different build');
 for(const[file,min]of [['regression/workspace/results.json',45],['regression/reaudit/results.json',16],['regression/design/results.json',34],['studio-browser/results.json',29]]){const q=read(base+file);if(q.sha256!==m.sha256||q.checks.length<min||q.checks.some(x=>x.status!=='PASS')||q.counts.PASS!==q.checks.length||q.counts.FAIL)errors.push(file+' not fully verified for this build');}
 const audio=read(base+'audio/results.json');if(audio.sha256!==m.sha256||audio.status!=='PASS'||audio.counts.presets!==76||audio.counts.combinations!==26||audio.counts.legacyWithinQuantization!==55)errors.push('Sound tests incomplete');
 const so=read(base+'soak.json');if(so.sha256!==m.sha256||so.status!=='PASS'||so.wallSeconds<600||so.pageErrors.length||so.final.sources||so.final.previews)errors.push('Ten-minute run incomplete');
 for(const x of read('docs/content-2.0/external-checks.json').checks){if(!x.required)continue;if(x.status!=='PASS'||!x.evidence){errors.push(x.id+': '+x.status+' — '+x.title);continue;}const q=read(x.evidence);if(q.sha256!==m.sha256||q.status!=='PASS')errors.push(x.id+' wrong build/not passed');if(x.id==='LISTEN'&&(!q.reviewer||!q.notes||!q.date))errors.push('Human listening evidence incomplete');}
}catch(e){errors.push(e.message);}
console.log(JSON.stringify({status:errors.length?'NOT_RELEASE_CLOSED':'PASS',errors},null,2));if(errors.length)process.exitCode=2;
