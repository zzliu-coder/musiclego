import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {harness} from './browser-harness.mjs';
const h=await harness(),p=h.page,checks=[];let passed=false;
try{
 for(const bars of [32,128,256])for(const view of ['arrange','edit']){
  const bar=Math.min(127,bars-8);await p.evaluate(async({bars,bar,view})=>{const G=GridTone,doc=G.blankProject();doc.bars=bars;doc.tracks[0].patterns[0].bars=4;doc.tracks[0].patterns[0].notes=[G.newNote(60,0,480)];doc.tracks[0].clips[0].bar=bar;await GridToneApp.loadProject(doc);GridToneApp.changeView(view);},{bars,bar,view});
  const scroll=p.locator('.arrange-scroll');await scroll.evaluate((el,bar)=>el.scrollLeft=bar*96-48,bar);
  const clip=p.locator('.song-clip').first();await clip.click({position:{x:24,y:18}});
  const geometry=await clip.boundingBox(),barWidth=await p.locator('.arrange-lane').evaluate((e,bars)=>e.clientWidth/bars,bars);assert.ok(barWidth>=96);assert.ok(Math.abs(geometry.width-(4*barWidth-8))<1);const rulerWidth=await p.locator('.ruler-bars').evaluate(e=>e.clientWidth);assert.ok(Math.abs(rulerWidth-barWidth*bars)<=1);
  const before=await p.evaluate(()=>GridToneApp.getProject());
  await p.mouse.move(geometry.x+30,geometry.y+18);await p.mouse.down();await p.mouse.move(geometry.x+30+barWidth,geometry.y+18,{steps:5});await p.mouse.up();
  assert.equal(await p.evaluate(()=>GridToneApp.getProject().tracks[0].clips[0].bar),bar+1);assert.equal(await p.evaluate(()=>GridToneApp.getHistory().undo),1);
  await p.locator('.topbar [data-action="undo"]').click();assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),before);
  await p.locator('.arrange-track-head [data-action="mute"]').click();assert.equal(await p.evaluate(()=>GridToneApp.getProject().tracks[0].mute),true);await p.locator('.topbar [data-action="undo"]').click();
  const snapshot=await p.evaluate(()=>GridToneApp.getProject());await p.locator('.arrange-track-head [data-action="solo"]').click();assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),snapshot);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  checks.push({bars,view,status:'PASS',clipBar:bar,barWidth,actions:['scroll','select','drag-one-bar','undo','mute','solo']});
 }
 assert.deepEqual(h.errors,[]);passed=true;
}finally{await writeFile(h.output+'/long-timeline.json',JSON.stringify({status:passed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),checks,errors:h.errors},null,2));await h.close();}
