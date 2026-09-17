import assert from 'node:assert/strict';import {writeFile,readFile} from 'node:fs/promises';import {harness,root} from './browser-harness.mjs';
const h=await harness(),p=h.page,checks=[];
const click=action=>p.locator(`button[data-action="${action}"]`).filter({visible:true}).first().click();
const state=()=>p.evaluate(()=>({project:GridToneApp.getProject(),history:GridToneApp.getHistory()}));
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
let completed=false;
try{
 await check('R1-T04 actual pointer move commits once; Escape cancels without history',async()=>{
  await p.evaluate(async()=>{const G=GridTone,doc=G.blankProject();doc.tracks[0].patterns[0].notes=[G.newNote(60,0,480)];await GridToneApp.loadProject(doc);GridToneApp.changeView('edit');});await p.locator('[data-tool="select"]').click();
  const before=await state(),note=await p.locator('.note-body').boundingBox(),x=note.x+note.width/2,y=note.y+note.height/2;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+100,y,{steps:8});await p.keyboard.press('Escape');await p.mouse.up();assert.deepEqual(await state(),before);
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+100,y,{steps:8});await p.mouse.up();const after=await state();assert.equal(after.history.undo,before.history.undo+1);assert.ok(after.project.tracks[0].patterns[0].notes[0].start>0);await click('undo');assert.deepEqual((await state()).project,before.project);
 });
 await check('R3-T06 focused text editing and canvas deletion have separate scopes',async()=>{
  const before=await state();await click('catalog');const field=p.locator('[data-field="catalog-search"]');await field.fill('钢琴');await field.press('Meta+a');await field.press('Backspace');assert.equal(await field.inputValue(),'');assert.deepEqual(await state(),before);await click('close-modal');await p.locator('#gridframe').focus();await p.keyboard.press('Meta+a');await p.keyboard.press('Backspace');assert.equal((await state()).project.tracks[0].patterns[0].notes.length,0);await click('undo');assert.deepEqual((await state()).project,before.project);
 });
 await check('R3-T07 modal traps keyboard focus, keeps background inert and restores entrance',async()=>{
  await click('catalog');assert.equal(await p.locator('#app').evaluate(el=>el.inert),true);await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>!!document.activeElement.closest('.modal')),true);await click('close-modal');assert.equal(await p.locator('#app').evaluate(el=>el.inert),false);assert.equal(await p.evaluate(()=>document.activeElement.dataset.action),'catalog');
 });
 await check('R3-T03 desktop themes preserve document, playback scope and layout geometry',async()=>{
  const before=await state(),scope=await p.evaluate(()=>GridToneApp.getPlayback()),geometry=[];
  for(const skin of ['crystal','pearl']){await p.evaluate(skin=>{GridTone.appearance.set({skin});GridToneApp.render();},skin);geometry.push(await p.locator('#note-grid').boundingBox());assert.deepEqual(await state(),before);assert.deepEqual(await p.evaluate(()=>GridToneApp.getPlayback()),scope);}
  assert.deepEqual(geometry[0],geometry[1]);
 });
 await check('R3-T02/T09 bounded components and one semantic token update reach production controls',async()=>{
  await click('creation');const before=await p.locator('[data-action="creation-generate"]').evaluate(e=>getComputedStyle(e).backgroundColor);
  await p.evaluate(()=>document.documentElement.style.setProperty('--brand','#7a40ac'));await p.waitForFunction(()=>getComputedStyle(document.querySelector('[data-action="creation-generate"]')).backgroundColor==='rgb(122, 64, 172)');const after=await p.locator('[data-action="creation-generate"]').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(after,'rgb(122, 64, 172)');assert.notEqual(after,before);await p.evaluate(()=>document.documentElement.style.removeProperty('--brand'));await click('close-modal');
  const result=await p.evaluate(()=>{let rejected=false;try{GridTone.ui.Button({action:'test',label:'test',variant:'unbounded'});}catch{rejected=true;}const node=document.createElement('div');node.innerHTML=GridTone.ui.Button({action:'test',label:'正在生成',busy:true});const button=node.firstElementChild;return [rejected,button.disabled,button.getAttribute('aria-busy'),button.getAttribute('aria-label')];});assert.deepEqual(result,[true,true,'true','正在生成']);
 });
 await check('R7-T07 combined candidate preview/apply/undo is atomic',async()=>{
  await p.evaluate(async()=>{const G=GridTone,p=G.recipeProject('recipe.pop');const t=G.newTrack('melodic',0,'cloudpad');t.role='texture';t.patterns[0].bars=4;p.tracks.push(t);await GridToneApp.loadProject(p);const melody=GridToneApp.getProject().tracks.find(t=>t.name==='示范旋律');GridToneApp.openPattern({trackId:melody.id,clipId:melody.clips[0].id});});
  const before=await state();await click('creation');await p.locator('[data-field="creation-mode"]').selectOption('ensemble');await click('creation-generate');const candidate=await p.evaluate(()=>GridToneApp.creation.session.candidates[0]);assert.equal(candidate.trackIds.length,3);await click('creation-preview-solo');await p.waitForFunction(()=>GridToneApp.engine.playing);assert.deepEqual(await p.evaluate(()=>GridToneApp.playback.scope().soloIds),candidate.trackIds);await click('creation-apply');assert.deepEqual((await state()).project,candidate.project);assert.equal((await state()).history.undo,before.history.undo+1);await click('undo');assert.deepEqual((await state()).project,before.project);await click('redo');assert.deepEqual((await state()).project,candidate.project);
 });
 await check('R1-T07/R3 motion and playback regressions rerun on this build',async()=>{
  const script=(await readFile(root+'tests/legou-browser.js','utf8')).replace('A.loadProject(original);','await A.loadProject(original,{fromLibrary:true});');const result=await p.evaluate(script);assert.ok(result.results.length>10);assert.deepEqual(result.results.filter(x=>x.result!=='PASS'),[]);checks.push(...result.results.map(r=>({name:r.name,status:r.result})));
 });
 assert.deepEqual(h.errors,[]);completed=true;
}finally{await writeFile(h.output+'/interactions.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),checks,errors:h.errors},null,2));await h.close();}
