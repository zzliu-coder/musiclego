import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {harness} from './browser-harness.mjs';
const h=await harness(),results=[];await mkdir(h.output+'/audio',{recursive:true});
let completed=false;
try{
 const recipes=await h.page.evaluate(()=>GridTone.RECIPES.map(r=>r.id));
 for(const id of recipes){
  const result=await h.page.evaluate(async id=>{
   const G=GridTone,p=G.recipeProject(id),audio=await GridToneApp.engine.exportWav(p);let energy=0,count=0,clipped=0;
   for(let channel=0;channel<audio.buffer.numberOfChannels;channel++){const data=audio.buffer.getChannelData(channel);for(const v of data){energy+=v*v;count++;if(Math.abs(v)>=1)clipped++;}}
   const bytes=new Uint8Array(await audio.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {id,peak:audio.peak,rms:Math.sqrt(energy/count),clipped,seconds:audio.buffer.duration,events:G.compileSong(p).events.length,wav:btoa(binary)};
  },id);
  assert.ok(Number.isFinite(result.peak)&&result.peak>0.001);assert.ok(result.rms>0.00001);assert.equal(result.clipped,0);
  const {wav,...metrics}=result;await writeFile(h.output+'/audio/'+id+'.wav',Buffer.from(wav,'base64'));results.push({...metrics,engineering:'PASS',listening:'NOT_RUN',file:'audio/'+id+'.wav'});console.log('PASS',id,'peak',result.peak.toFixed(3),'rms',result.rms.toFixed(4));
 }
 const performance=await h.page.evaluate(()=>{const G=GridTone,p=G.recipeProject('recipe.pop'),t=p.tracks.at(-1),harmony=G.resolveHarmony(p,{trackId:t.id,clipId:t.clips[0].id,sourceTrackId:p.tracks[0].id}),times=[];for(let seed=0;seed<100;seed++){const start=performance.now();G.generateMelody({harmony,notes:[]},{},seed);times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {samples:100,p50:times[50],p95:times[95],userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency};});
 assert.ok(performance.p95<=200,JSON.stringify(performance));results.push({name:'R6-T13 computation benchmark',...performance});
 assert.deepEqual(h.errors,[]);completed=true;
}finally{await writeFile(h.output+'/audio.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),results,errors:h.errors,scope:'Offline Web Audio rendering and measurements. Human listening and physical-device latency not measured.'},null,2));await h.close();}
