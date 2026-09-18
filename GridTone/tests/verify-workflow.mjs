import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {harness} from './browser-harness.mjs';
const h=await harness(),page=h.page,checks=[];
const click=action=>page.locator(`button[data-action="${action}"]${action==='creation'?':not([data-mode])':''}`).filter({visible:true}).first().click();
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
let completed=false;
try{
 await check('R1-T01 sixteen bars save and reload through app',async()=>{await page.evaluate(async()=>{const G=GridTone,p=G.blankProject();p.bars=16;p.tracks[0].patterns[0].bars=16;p.tracks[0].patterns[0].notes=[G.newNote(60,0,80.5)];await GridToneApp.loadProject(p);});await page.reload();await page.waitForFunction(()=>GridToneApp?.getProject().tracks[0].patterns[0].bars===16);assert.equal(await page.evaluate(()=>GridToneApp.getProject().tracks[0].patterns[0].notes[0].duration),80.5);});
 await check('R3-T01 templates and progressions immediately reachable',async()=>{await click('catalog');assert.ok(await page.getByText('模板与素材',{exact:true}).isVisible());await click('close-modal');await click('composer');assert.ok(await page.locator('.progression-list').isVisible());await click('creation-close');});
 await check('R5-T03/T07 recipe preview and atomic apply share identical candidate',async()=>{
  await click('catalog');await click('recipes');await click('creation-generate');const candidate=await page.evaluate(()=>GridToneApp.creation.session.candidates[0].project);const count=await page.evaluate(()=>GridToneApp.getHistory().undo);await click('creation-preview');await page.waitForFunction(()=>GridToneApp.engine.playing);await click('creation-apply');assert.deepEqual(await page.evaluate(()=>GridToneApp.getProject()),candidate);assert.equal(await page.evaluate(()=>GridToneApp.getHistory().undo),count+1);await click('stop');
 });
 await check('R6-T06/T09 melody candidates cancel without music or history writes',async()=>{
  const before=await page.evaluate(()=>({project:GridToneApp.getProject(),history:GridToneApp.getHistory()}));await click('creation');await click('creation-generate');assert.equal(await page.locator('[data-action="creation-choose"]').count(),3);await click('creation-preview');await page.waitForFunction(()=>GridToneApp.engine.playing);await click('creation-close');assert.deepEqual(await page.evaluate(()=>({project:GridToneApp.getProject(),history:GridToneApp.getHistory()})),before);
 });
 await check('R6-T03 retention persists and regeneration changes only unprotected fields',async()=>{
  await click('creation');await click('creation-generate');await click('creation-apply');await page.locator('#gridframe').focus();await page.keyboard.press('Meta+a');assert.ok((await page.evaluate(()=>GridToneApp.getState().selected)).length>0);await click('creation');await page.locator('.retention-controls summary').click();await page.locator('[data-action="creation-keep"][data-keep="rhythm"]').click();await click('creation-save-keeps');const before=await page.evaluate(()=>{const A=GridToneApp,s=A.getState(),t=A.getProject().tracks.find(t=>t.id===s.trackId);return t.patterns.find(p=>p.id===s.patternId).notes.map(n=>[n.id,n.start,n.duration]);});await click('creation');await page.locator('[data-field="creation-mode"]').selectOption('rhythm');await click('creation-generate');await click('creation-apply');assert.deepEqual(await page.evaluate(()=>{const A=GridToneApp,s=A.getState(),t=A.getProject().tracks.find(t=>t.id===s.trackId);return t.patterns.find(p=>p.id===s.patternId).notes.map(n=>[n.id,n.start,n.duration]);}),before);
 });
 await check('R6-T10 stale candidate is rejected',async()=>{
  await click('creation');await click('creation-generate');await page.evaluate(()=>{GridToneApp.creation.session.token='outdated';});const before=await page.evaluate(()=>GridToneApp.getProject());await click('creation-apply');assert.deepEqual(await page.evaluate(()=>GridToneApp.getProject()),before);assert.match(await page.locator('#creation-feedback').innerText(),/已变化/);await click('creation-close');
 });
 await check('R2-T01/T08 UI project list and independent history after switching',async()=>{
  await page.evaluate(()=>GridToneApp.flushSave());await click('project-menu');await page.waitForSelector('.project-list article');assert.ok(await page.locator('.project-list article').count()>=1);await click('new-project');await click('confirm');await page.waitForFunction(()=>GridToneApp.getProject().tracks.length===1);assert.equal(await page.evaluate(()=>GridToneApp.getHistory().undo),0);await page.evaluate(()=>GridToneApp.flushSave());
 });
 await check('R3-T05 large arrangement retains usable bar width',async()=>{
  await page.evaluate(async()=>{const p=GridTone.blankProject();p.bars=256;await GridToneApp.loadProject(p);GridToneApp.changeView('arrange');});const width=await page.locator('.empty-bar').first().evaluate(el=>el.getBoundingClientRect().width);assert.ok(width>=48,`bar width ${width}`);
 });
 assert.deepEqual(h.errors,[]);completed=true;
 await page.screenshot({path:h.output+'/workflow-desktop.png',fullPage:true});
}finally{await writeFile(h.output+'/workflow.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),checks,errors:h.errors},null,2));await h.close();}
