import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {harness} from './browser-harness.mjs';
const h=await harness(),p=h.page,checks=[];await mkdir(h.output+'/fixtures',{recursive:true});
const click=action=>p.locator(`button[data-action="${action}"]${action==='creation'?':not([data-mode])':''}`).filter({visible:true}).first().click();
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
function midiEvents(bytes){
 assert.equal(bytes.toString('ascii',0,4),'MThd');assert.equal(bytes.readUInt16BE(12),960);let offset=14,notes=[];
 while(offset<bytes.length){assert.equal(bytes.toString('ascii',offset,offset+4),'MTrk');let pos=offset+8,end=pos+bytes.readUInt32BE(offset+4),tick=0;
  const vlq=()=>{let value=0,b;do{b=bytes[pos++];value=(value<<7)|(b&127);}while(b&128);return value;};
  while(pos<end){tick+=vlq();const status=bytes[pos++];if(status===255){pos++;const length=vlq();pos+=length;}else{const kind=status&240,a=bytes[pos++],b=kind===192||kind===208?undefined:bytes[pos++];if(kind===144&&b>0)notes.push([tick,a,b]);}}
  assert.equal(pos,end);offset=end;
 }return notes.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
}
let fixture;
let completed=false;
try{
 await check('R9-T03 recipe → melody → retained range → variation → mix → save',async()=>{
  await p.evaluate(async()=>{const G=GridTone,doc=G.recipeProject('recipe.lofi');doc.title='验收 A · 模板与旋律';await GridToneApp.loadProject(doc);const t=GridToneApp.getProject().tracks.at(-1);GridToneApp.openPattern({trackId:t.id,clipId:t.clips[0].id});});
  await click('creation');await click('creation-generate');await click('creation-preview');await p.waitForFunction(()=>GridToneApp.engine.playing);await click('creation-apply');await click('stop');
  const first=await p.evaluate(()=>{const a=GridToneApp,s=a.getState(),t=a.getProject().tracks.find(t=>t.id===s.trackId);return t.patterns.find(p=>p.id===s.patternId).notes.filter(n=>n.start<GridTone.BAR);});
  await click('creation');await p.locator('#creation-options summary').click();await p.locator('[data-field="creation-end"]').fill('4');await p.locator('[data-field="creation-end"]').dispatchEvent('change');await p.locator('.retention-controls summary').click();await p.locator('[data-keep="range"]').click();await click('creation-save-keeps');
  await click('creation');await click('creation-generate');await click('creation-apply');
  assert.deepEqual(await p.evaluate(()=>{const a=GridToneApp,s=a.getState(),t=a.getProject().tracks.find(t=>t.id===s.trackId);return t.patterns.find(p=>p.id===s.patternId).notes.filter(n=>n.start<GridTone.BAR);}),first);
  await p.locator('[data-action="creation"][data-mode="arrange"]').click();await click('creation-generate');await click('creation-apply');
  await p.locator('.workspace-tabs [data-view="mix"]').click();await p.locator('[data-action="creation"][data-mode="mix"]').click();await click('creation-generate');const original=await p.evaluate(()=>GridToneApp.getProject());await click('creation-preview');await click('creation-close');assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),original);
  await p.locator('.workspace-tabs [data-view="mix"]').click();await p.locator('[data-action="creation"][data-mode="mix"]').click();await click('creation-generate');await click('creation-apply');await p.evaluate(()=>GridToneApp.flushSave());fixture=await p.evaluate(()=>GridToneApp.getProject());assert.equal(fixture.bars,12);
 });
 await check('R9-T03 browser downloads engineering project, MIDI events and complete WAV',async()=>{
  await click('export');
  const download=async(type,file)=>{const result=p.waitForEvent('download');await click('export-'+type);const item=await result;await item.saveAs(h.output+'/fixtures/'+file);return readFile(h.output+'/fixtures/'+file);};
  const project=await download('project','success-path.gridtone');assert.deepEqual(JSON.parse(project),fixture);
  const midi=await download('midi','success-path.mid'),expected=await p.evaluate(()=>GridTone.compileSong(GridToneApp.getProject()).events.map(n=>[Math.round(n.start),Math.round(n.pitch),Math.max(1,Math.round(n.velocity*127))]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]));assert.deepEqual(midiEvents(midi),expected);
  const wav=await download('wav','success-path.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(40),wav.length-44);const duration=(wav.length-44)/(44100*4);assert.ok(Math.abs(duration-(fixture.bars*4*60/fixture.bpm+3))<.01);await click('close-modal');
 });
 await check('R9-T04 real-origin A/B reload preserves generated sources and retained silence',async()=>{
  await p.evaluate(async id=>{const a=GridToneApp,other=GridTone.blankProject();other.title='验收 B';await a.loadProject(other);await a.loadProject(await GridTone.projects.load(id),{fromLibrary:true});},fixture.id);
  await p.reload();await p.waitForFunction(id=>window.GridToneApp?.getProject().id===id,fixture.id);assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),fixture);
 });
 await check('R2-T09 recovery and clean-context import retain custom sample sound',async()=>{
  const doc=await p.evaluate(async()=>{const G=GridTone;G.installCatalog(G.EXAMPLE_CATALOG);let p=G.applyTemplate(G.blankProject(),G.getTemplate('example.beat'),{mode:'new-track',bar:0}).project;p.title='采样恢复验收';await G.projects.save(p);const r=(await G.projects.recoveries(p.id))[0];return G.projects.recovery(r.id,p.id);});
  const clean=await h.browser.newContext(),tab=await clean.newPage();tab.on('pageerror',e=>h.errors.push(e.message));await tab.goto(h.url);await tab.waitForFunction(()=>window.GridToneApp);
  const metrics=await tab.evaluate(async doc=>{const G=GridTone;await GridToneApp.loadProject(doc);G.assertPlayable(GridToneApp.getProject());const audio=await GridToneApp.engine.exportWav(GridToneApp.getProject());return {peak:audio.peak,assets:Object.keys(GridToneApp.getProject().assets),notes:G.compileSong(GridToneApp.getProject()).events.length};},doc);assert.ok(metrics.peak>.001);assert.ok(metrics.assets.length);assert.ok(metrics.notes);await clean.close();
 });
 await check('R4-T06 manual harmony fields commit actual root, quality and duration',async()=>{
  await p.evaluate(()=>{const A=GridToneApp,t=A.getProject().tracks.find(t=>t.role==='chords');A.openPattern({trackId:t.id,clipId:t.clips[0].id});});await click('creation');await click('harmony-editor');
  await p.locator('[data-harmony="rootPitchClass"]').first().selectOption('9');await p.locator('[data-harmony="quality"]').first().selectOption('dom7');await click('harmony-confirm');
  const event=await p.evaluate(()=>GridToneApp.getProject().tracks.find(t=>t.role==='chords').patterns[0].harmony.events[0]);assert.equal(event.rootPitchClass,9);assert.equal(event.quality,'dom7');
 });
 assert.deepEqual(h.errors,[]);completed=true;
}finally{await writeFile(h.output+'/release-flow.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),checks,errors:h.errors},null,2));await h.close();}
