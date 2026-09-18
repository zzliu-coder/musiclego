import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {harness} from './browser-harness.mjs';
const browserType=process.env.TEST_BROWSER||'firefox',h=await harness({browserType}),p=h.page,checks=[];let passed=false;
try{
 await p.evaluate(async()=>{const G=GridTone,A=GridToneApp,doc=G.recipeProject('recipe.pop');await A.loadProject(doc);A.changeView('arrange');});
 assert.equal(await p.locator('.workspace-tabs [data-view="mix"]').count(),1);checks.push('Three workspaces reachable');
 const frame=p.locator('.song-clip').first();await frame.click();await p.evaluate(()=>GridToneApp.changeView('edit'));
 await p.locator('[data-action="creation"]').filter({visible:true}).first().click();assert.equal(await p.locator('#app').evaluate(e=>e.inert),false);await p.locator('[data-action="creation-close"]').first().click();checks.push('Nonmodal creation panel opens and closes');
 const expected=await p.evaluate(async()=>{const A=GridToneApp;await A.flushSave();return A.getProject();});await p.reload();await p.waitForFunction(()=>GridToneApp&&!/正在/.test(GridToneApp.getState().saveStatus));assert.deepEqual(await p.evaluate(()=>GridToneApp.getProject()),expected);checks.push('Actual origin save and reload');
 const exportResult=await p.evaluate(async()=>{const G=GridTone,A=GridToneApp,p=A.getProject(),r=await A.engine.exportWav(p);return {midi:G.encodeMidi(p).byteLength,wav:r.blob.size,peak:r.peak,events:G.compileSong(p).events.length,userAgent:navigator.userAgent};});assert.ok(exportResult.midi>100&&exportResult.wav>1000&&exportResult.peak>0);checks.push({name:'Native offline audio and MIDI export',...exportResult});
 assert.deepEqual(h.errors,[]);await p.screenshot({path:`docs/closure-v2/evidence/${browserType}-desktop.png`});passed=true;
}finally{await writeFile(`docs/closure-v2/evidence/${browserType}.json`,JSON.stringify({status:passed?'PASS':'FAIL',sha256:h.sha256,platform:process.platform,checks,errors:h.errors},null,2));await h.close();}
