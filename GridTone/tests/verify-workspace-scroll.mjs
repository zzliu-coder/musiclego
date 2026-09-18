import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {harness} from './browser-harness.mjs';
const h=await harness(),p=h.page,checks=[];let passed=false;
async function bottom(){const r=await p.locator('.view-content').boundingBox();await p.mouse.move(r.x+5,r.y+r.height/2);for(let i=0;i<5;i++){await p.mouse.wheel(0,900);await p.waitForTimeout(90);}}
try{
 await p.evaluate(async()=>{const doc=GridTone.recipeProject('recipe.pop');doc.bars=12;await GridToneApp.loadProject(doc);});
 const original=await p.evaluate(()=>GridToneApp.getProject());
 for(const [width,height] of [[1440,900],[1280,720],[1152,600]])for(const view of ['arrange','edit'])for(const dock of [false,true]){
  await p.setViewportSize({width,height});await p.evaluate(({view,dock})=>{const A=GridToneApp;A.creation.close();A.changeView(view);if(dock)A.creation.open();document.querySelector('.view-content').scrollTop=0;},{view,dock});
  const fixed=await p.evaluate(()=>[document.querySelector('.topbar').getBoundingClientRect().top,document.querySelector('.playback-footer').getBoundingClientRect().bottom]);
  await bottom();
  const result=await p.evaluate(view=>{const v=document.querySelector('.view-content'),last=document.querySelector(view==='arrange'?'.dock-footer .btn:last-child':'.arrange-bottom .btn:last-child'),r=last.getBoundingClientRect(),vr=v.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:v.scrollTop,max:v.scrollHeight-v.clientHeight,visible:r.top>=vr.top&&r.bottom<=vr.bottom+1,hit:hit===last||last.contains(hit),width:document.documentElement.scrollWidth,viewport:innerWidth,fixed:[document.querySelector('.topbar').getBoundingClientRect().top,document.querySelector('.playback-footer').getBoundingClientRect().bottom]};},view);
  assert.ok(result.max>0,'fixture must overflow');assert.ok(Math.abs(result.top-result.max)<2,'wheel must reach workspace bottom');assert.ok(result.visible&&result.hit,'bottom action visible and hit-testable');assert.ok(result.width<=result.viewport);assert.deepEqual(result.fixed,fixed);
  await p.evaluate(()=>GridToneApp.render());assert.ok(Math.abs(await p.locator('.view-content').evaluate(e=>e.scrollTop)-result.top)<2,'render retains scroll');
  await p.evaluate(()=>GridToneApp.changeView(GridToneApp.getState().view==='edit'?'arrange':'edit'));await p.evaluate(view=>GridToneApp.changeView(view),view);assert.ok(Math.abs(await p.locator('.view-content').evaluate(e=>e.scrollTop)-result.top)<2,'view switch retains scroll');
  checks.push({width,height,view,dock,status:'PASS',scrollTop:result.top});
 }
 await p.setViewportSize({width:1280,height:720});await p.evaluate(()=>{const A=GridToneApp;A.creation.close();A.changeView('edit');document.querySelector('.view-content').scrollTop=0;const g=document.querySelector('.grid-scroll');g.scrollTop=g.scrollHeight;});
 const grid=await p.locator('.grid-scroll').boundingBox();await p.mouse.move(grid.x+100,Math.min(grid.y+70,600));await p.mouse.wheel(0,500);await p.waitForTimeout(250);assert.ok(await p.locator('.view-content').evaluate(e=>e.scrollTop)>0,'grid boundary chains vertical wheel');
 assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),original);assert.deepEqual(h.errors,[]);await bottom();await p.screenshot({path:h.output+'/workspace-bottom.png'});passed=true;
}finally{await writeFile(h.output+'/workspace-scroll.json',JSON.stringify({status:passed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),checks,errors:h.errors,scope:'Actual wheel, bottom action hit-testing, fixed chrome, render/view retention and grid boundary chaining. Desktop effective viewports include reduced height / zoom-equivalent space.'},null,2));await h.close();}
