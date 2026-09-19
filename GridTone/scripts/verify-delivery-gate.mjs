/** Release evidence must belong to the delivered bytes, and must explicitly pass. */
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function evidenceProblems(report,hash,kind){
 const errors=[];
 if(!report||report.sha256!==hash)errors.push(kind+' 的证据不属于当前构建');
 if(!report)return errors;
 if(kind==='engineering'){
  if(report.status!=='PASS')errors.push('engineering 尚未通过');
  const rows=report.results||[],expected=['catalog','build','core','browser','reaudit','audio'];
  if(rows.length!==expected.length||expected.some(name=>rows.filter(r=>r.name===name&&r.status==='PASS'&&r.exit===0).length!==1))errors.push('工程检查任务缺失、重复或未通过');
 }else if(kind==='soak'){
  if(report.status!=='PASS'||!(report.wallSeconds>=600)||!report.records?.length||report.pageErrors?.length||report.final?.previews!==0||report.final?.errors)errors.push('持续运行尚未通过十分钟检查');
 }else{
  const rows=report.checks||[],minimum=kind==='audio'?55:kind==='browser'?45:16;
  if(!Array.isArray(rows)||rows.length<minimum||rows.some(r=>r.status!=='PASS')||report.counts?.FAIL||report.pageErrors?.length)errors.push(kind+' 检查缺失或尚未通过');
  if(kind==='audio'&&report.status!=='PASS')errors.push('audio 尚未通过');
  if(kind!=='audio'&&report.counts?.PASS!==rows.length)errors.push(kind+' 计数与明细不一致');
 }
 return errors;
}
export function verifyDelivery(root){
 const errors=[],read=f=>JSON.parse(readFileSync(resolve(root,f),'utf8'));
 try{
  const manifest=read('dist/manifest.json'),bytes=readFileSync(resolve(root,'dist/index.html')),hash=sha(bytes),pkg=read('package.json');
  if(hash!==manifest.sha256||bytes.length!==manifest.bytes||manifest.version!==pkg.version)errors.push('交付 HTML、版本与 manifest 不一致');
  for(const file of ['乐构.html','声格.html'])if(sha(readFileSync(resolve(root,file)))!==hash)errors.push(file+' 与交付 HTML 不一致');
  const assets=read('assets.json'),h=createHash('sha256');
  for(const f of ['assets.json','package.json',...assets.styles,...assets.scripts]){h.update(f+'\0');h.update(readFileSync(resolve(root,f)));h.update('\0');}
  if(h.digest('hex')!==manifest.runtimeDigest)errors.push('源码与构建摘要不一致，需要重建');
  const base='docs/design-1.9/';
  for(const [kind,file]of Object.entries({engineering:'evidence/engineering.json',browser:'evidence/browser/results.json',reaudit:'evidence/regressions/results.json',audio:'evidence/audio.json',soak:'evidence/soak.json'})){
   try{const r=read(base+file);errors.push(...evidenceProblems(r,hash,kind));if(kind==='audio')for(const item of r.checks||[])if(item.type==='recipe'){
    if(!item.file||!item.audioSha256||sha(readFileSync(resolve(root,base+'evidence',item.file)))!==item.audioSha256)errors.push('配方音频文件不匹配：'+item.id);
   }}catch(e){errors.push(kind+'：'+e.message);}
  }
  const design=read(base+'evidence/design-engineering.json');
  if(design.status!=='PASS'||design.sha256!==hash||design.results?.length!==9||design.results.some(r=>r.status!=='PASS'||r.exit!==0))errors.push('本轮设计与交互工程验收尚未完整通过');
  const extra=read(base+'evidence/design-browser/results.json');
  if(extra.sha256!==hash||extra.counts?.FAIL||!extra.checks?.length||extra.checks.some(r=>r.status!=='PASS'))errors.push('本轮设计页面检查没有全部通过');
  const external=read(base+'external-checks.json');
  for(const item of external.checks)if(item.required){
   if(item.status!=='PASS'||item.sha256!==hash||!item.evidence){errors.push(`${item.id}：${item.status} · ${item.title}`);continue;}
   const file=resolve(root,base,item.evidence);
   if(!existsSync(file)){errors.push(item.id+' 的补验文件不存在');continue;}
   const report=JSON.parse(readFileSync(file,'utf8'));
   if(report.sha256!==hash||report.status!=='PASS')errors.push(item.id+' 的补验内容未通过或版本不一致');
   if(item.id==='EXT-LISTEN'&&(!report.reviewer||!report.notes||!report.date))errors.push('实际音乐听评缺少执行者、日期或记录');
  }
 }catch(e){errors.push(e.message);}
 return {status:errors.length?'NOT_RELEASE_CLOSED':'PASS',errors};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),result=verifyDelivery(root);
 console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=2;
}
