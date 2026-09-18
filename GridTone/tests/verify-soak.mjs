import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {harness,root} from './browser-harness.mjs';
const h=await harness(),p=h.page,samples=[],checks=[];
await mkdir(h.output+'/fixtures',{recursive:true});
const duration=30*60*1000,start=Date.now(),sha256=createHash('sha256').update(await readFile(root+'dist/index.html')).digest('hex');
const cdp=await h.context.newCDPSession(p);await cdp.send('Performance.enable');
let cycles=0,status='FAIL',failure;
try{
 await p.evaluate(async()=>{
  const G=GridTone;let doc=G.recipeProject('recipe.pop');
  for(let i=0;i<3;i++)doc=G.duplicateTrack(doc,doc.tracks[i].id).project;
  doc.bars=32;for(const t of doc.tracks){t.clips=Array.from({length:8},(_,bar)=>({id:G.uid('c'),patternId:t.patterns[0].id,bar:bar*4}));}
  await GridToneApp.loadProject(doc);window.soakId=GridToneApp.getProject().id;
 });
 while(Date.now()-start<duration){
  await p.evaluate(async i=>{
   const A=GridToneApp,G=GridTone,doc=A.getProject(),t=doc.tracks.find(t=>t.name==='示范旋律');
   A.openPattern({trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});A.changeView('edit');
   A.creation.open();A.creation.session.seed=100+i;A.creation.session.sourceTrackId=doc.tracks.find(t=>t.role==='chords').id;A.creation.generate();
   if(!A.creation.session.candidates.length)throw Error('Soak candidate missing');
   A.creation.handleAction('creation-apply',{});
   document.querySelector('button[data-action="undo"]').click();document.querySelector('button[data-action="redo"]').click();
   await A.flushSave();G.validateProject(A.getProject());
   if(i%6===0){A.changeView('mix');await A.playback.start('song');}
   if(i%6===3)A.playback.stop();
   if(i%40===0){const audio=await A.engine.exportWav(A.getProject());if(!(audio.peak>.001))throw Error('Soak WAV empty');const midi=G.encodeMidi(A.getProject());if(!midi)throw Error('Soak MIDI missing');}
   if(i%20===0){const original=A.getProject();await A.loadProject(G.blankProject());await A.loadProject(await G.projects.load(original.id),{fromLibrary:true});}
  },cycles++);
  if(cycles%12===0){
   await cdp.send('HeapProfiler.collectGarbage');
   const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   samples.push({elapsedMs:Date.now()-start,cycles,heap:metrics.JSHeapUsedSize,nodes:metrics.Nodes,listeners:metrics.JSEventListeners});
   await writeFile(h.output+'/soak-progress.json',JSON.stringify({sha256,elapsedMs:Date.now()-start,cycles,samples},null,2));
   console.log('soak',Math.round((Date.now()-start)/60000)+' min',cycles+' cycles',Math.round(metrics.JSHeapUsedSize/1024/1024)+' MB');
  }
  await p.waitForTimeout(3000);
 }
 const before=await p.evaluate(async()=>{GridToneApp.playback.stop();await GridToneApp.flushSave();return GridToneApp.getProject();});
 await writeFile(h.output+'/fixtures/soak-final.gridtone',JSON.stringify(before));
 await p.reload();await p.waitForFunction(id=>window.GridToneApp?.getProject().id===id,before.id);
 assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),before);checks.push('final real-origin reload matches document');
 assert.equal(before.tracks.length,8);assert.equal(before.bars,32);assert.ok(Date.now()-start>=duration);
 const warm=samples.slice(3),first=warm[0],last=warm.at(-1);
 assert.ok(last.heap<first.heap+32*1024*1024,'sustained heap growth exceeds 32 MB allowance');
 assert.ok(last.nodes<first.nodes+10000,'unbounded detached DOM growth');
 assert.ok(last.listeners<first.listeners+1000,'unbounded listener growth');
 assert.deepEqual(h.errors,[]);status='PASS';
}catch(e){failure=e.stack;throw e;}
finally{await writeFile(h.output+'/soak.json',JSON.stringify({status,sha256,date:new Date().toISOString(),durationMs:Date.now()-start,cycles,samples,checks,failure,errors:h.errors,scope:'30-minute automated 8-track 32-bar creation, undo/redo, WAV/MIDI export, save, project switch and playback. Heap after explicit GC; physical audio quality not measured.'},null,2));await h.close();}
