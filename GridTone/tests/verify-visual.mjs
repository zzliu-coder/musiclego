import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {harness} from './browser-harness.mjs';
const h=await harness(),results=[],p=h.page;
const click=action=>p.locator(`button[data-action="${action}"]`).filter({visible:true}).first().click();
let completed=false;
try{
 await p.evaluate(async()=>{await GridToneApp.loadProject(GridTone.recipeProject('recipe.lofi'));GridToneApp.changeView('edit');});
 // Small-screen work is deferred by the user's 2026-09-18 scope decision.
 for(const width of [1440,1280])for(const skin of ['crystal','pearl']){
  await p.setViewportSize({width,height:900});await p.evaluate(skin=>{GridTone.appearance.set({skin});GridToneApp.render();},skin);
  for(const view of ['edit','arrange','mix']){
   await p.evaluate(view=>{GridToneApp.changeView(view);document.querySelector('.workspace-body').scrollTop=0;document.querySelector('.sound-track-list')?.scrollTo(0,0);},view);await p.screenshot({path:`${h.output}/${skin}-${width}-${view}.png`,fullPage:true,animations:'disabled'});
   const state=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,stop:document.querySelector('.top-transport [data-action="stop"]').getBoundingClientRect().height,status:getComputedStyle(document.querySelector('#storage-status')).display,label:getComputedStyle(document.querySelector('#playback-label')).display}));
   results.push({skin,width,view,...state});assert.equal(state.overflow,false,JSON.stringify(results.at(-1)));assert.ok(state.stop>0);assert.notEqual(state.status,'none');assert.notEqual(state.label,'none');
  }
  await p.evaluate(()=>GridToneApp.changeView('edit'));
  for(const tab of ['sound','pipeline']){await p.locator(`[data-action="editor-tab"][data-tab="${tab}"]`).click();await p.screenshot({path:`${h.output}/${skin}-${width}-${tab}.png`,animations:'disabled'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  await p.locator('[data-action="editor-tab"][data-tab="notes"]').click();
  for(const action of ['catalog','creation','project-menu']){await click(action);await p.waitForSelector('.modal');await p.screenshot({path:`${h.output}/${skin}-${width}-${action}.png`,animations:'disabled'});const bounds=await p.locator('.modal').boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,`${action} ${width}`);await p.locator('.modal header button[data-action="close-modal"]').click();}
 }
 await p.goto(h.url.replace('/dist/index.html','/components.html'));await p.screenshot({path:h.output+'/components.png',fullPage:true,animations:'disabled'});assert.ok(await p.locator('[data-variant]').count()>=20);
 assert.deepEqual(h.errors,[]);completed=true;
}finally{await writeFile(h.output+'/visual.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),results,errors:h.errors,scope:'DOM geometry and browser screenshots. Human review recorded separately.'},null,2));await h.close();}
