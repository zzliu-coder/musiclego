import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {writeFile,mkdir} from 'node:fs/promises';import {harness} from './browser-harness.mjs';
const h=await harness(),results=[];await mkdir(h.output+'/audio',{recursive:true});
let completed=false;
try{
 const recipes=await h.page.evaluate(()=>[...GridTone.RECIPES.map(r=>r.id),...GridTone.PRESETS.map(r=>r.id)]);
 for(const id of recipes){
  const result=await h.page.evaluate(async id=>{
   const G=GridTone,recipe=G.RECIPES.find(r=>r.id===id),preset=G.PRESETS.find(r=>r.id===id),p=recipe?G.recipeProject(id):G.blankProject();if(preset){const t=p.tracks[0];t.preset=id;t.kind=preset.category==='鼓组'?'drum':'melodic';t.patterns[0].bars=1;p.bars=1;p.bpm=100;const pitches=t.kind==='drum'?[36,38,42,46]:preset.category==='低音'?[36,43,48,43]:[60,64,67,72];t.patterns[0].notes=pitches.map((pitch,i)=>G.newNote(pitch,i*G.PPQ,G.PPQ*.7,.35+i*.15));}const audio=await GridToneApp.engine.exportWav(p);let energy=0,count=0,clipped=0;
   for(let channel=0;channel<audio.buffer.numberOfChannels;channel++){const data=audio.buffer.getChannelData(channel);for(const v of data){energy+=v*v;count++;if(Math.abs(v)>=1)clipped++;}}
   const bytes=new Uint8Array(await audio.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {id,name:(recipe||preset).name,kind:recipe?'recipe':'preset',peak:audio.peak,rms:Math.sqrt(energy/count),clipped,seconds:audio.buffer.duration,events:G.compileSong(p).events.length,wav:btoa(binary)};
  },id);
  assert.ok(Number.isFinite(result.peak)&&result.peak>0.001);assert.ok(result.rms>0.00001);assert.equal(result.clipped,0);
  const {wav,...metrics}=result,bytes=Buffer.from(wav,'base64');await writeFile(h.output+'/audio/'+id+'.wav',bytes);results.push({...metrics,wavSha256:createHash('sha256').update(bytes).digest('hex'),engineering:'PASS',listening:'NOT_RUN',file:'audio/'+id+'.wav'});console.log('PASS',id,'peak',result.peak.toFixed(3),'rms',result.rms.toFixed(4));
 }
 const performance=await h.page.evaluate(()=>{const G=GridTone,p=G.recipeProject('recipe.pop'),t=p.tracks.at(-1),harmony=G.resolveHarmony(p,{trackId:t.id,clipId:t.clips[0].id,sourceTrackId:p.tracks[0].id}),times=[];for(let seed=0;seed<100;seed++){const start=performance.now();G.generateMelody({harmony,notes:[]},{},seed);times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {samples:100,p50:times[50],p95:times[95],userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency};});
 assert.ok(performance.p95<=200,JSON.stringify(performance));results.push({name:'R6-T13 computation benchmark',...performance});
 assert.equal(results.filter(r=>r.kind==='preset').length,47);assert.equal(results.filter(r=>r.kind==='recipe').length,8);
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));await writeFile(h.output+'/listening.html',`<!doctype html><meta charset="utf-8"><title>乐构 · 听感核验</title><style>body{font:16px system-ui;max-width:880px;margin:40px auto;color:#202633;background:#fafafa}article{padding:16px;background:white;border:1px solid #ddd;border-radius:12px;margin:12px 0}audio{width:100%}small{overflow-wrap:anywhere;color:#657080}</style><h1>音色与配方听感核验</h1><p>55 段实际导出音频。自动检查只确认有效信号和溢出情况，听感尚未评定。</p><p>请记录：刺耳、爆音、异常尾音、声部遮盖，以及是否符合该风格。</p><small>构建 ${h.sha256}</small>${results.filter(r=>r.file).map(r=>`<article><h2>${esc(r.name)}</h2><audio controls preload="none" src="${esc(r.file)}"></audio><small>${esc(r.id)} · SHA-256 ${r.wavSha256}</small></article>`).join('')}`);
 assert.deepEqual(h.errors,[]);completed=true;
}finally{await writeFile(h.output+'/audio.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),results,errors:h.errors,scope:'Offline Web Audio rendering and measurements. Human listening and physical-device latency not measured.'},null,2));await h.close();}
