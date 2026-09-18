/** Verify the actual double-click artifact without an HTTP server or external requests. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),file=resolve(root,'乐构.html'),out=resolve(root,process.env.EVIDENCE_DIR||'docs/closure-v2/evidence/current');
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),context=await browser.newContext(),page=await context.newPage(),requests=[],errors=[],checks=[];let passed=false;
page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort('internetdisconnected');});
try{
 await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.GridToneApp&&!/正在/.test(GridToneApp.getState().saveStatus));
 await page.evaluate(async()=>{const p=GridTone.recipeProject('recipe.pop');await GridToneApp.loadProject(p);GridToneApp.changeView('edit');});
 await page.locator('[data-tool="draw"]').click();const pos=await page.locator('#note-grid').evaluate(e=>({x:Number(e.dataset.left)+Number(e.dataset.cellWidth)*3+2,y:40}));await page.locator('#note-grid').click({position:pos});
 const expected=await page.evaluate(async()=>{await GridToneApp.flushSave();return GridToneApp.getProject();});await page.reload();await page.waitForFunction(id=>window.GridToneApp?.getProject().id===id,expected.id);assert.deepEqual(await page.evaluate(()=>GridToneApp.getProject()),expected);checks.push('file:// Chinese-named artifact opens, actual pointer editing saves and reloads intact');
 const rendered=await page.evaluate(async()=>{const p=GridToneApp.getProject(),r=await GridToneApp.engine.exportWav(p);return {midiBytes:GridTone.encodeMidi(p).byteLength,wavBytes:r.blob.size,peak:r.peak};});assert.ok(rendered.peak>0&&rendered.wavBytes>1000&&rendered.midiBytes>100);checks.push({name:'Offline built-in synthesis and MIDI rendering',...rendered});
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);passed=true;
}finally{await writeFile(out+'/offline-file.json',JSON.stringify({status:passed?'PASS':'FAIL',sha256:createHash('sha256').update(await readFile(file)).digest('hex'),date:new Date().toISOString(),browser:'macOS Chrome',checks,externalRequests:requests,errors,scope:'Isolated browser context, actual file:// artifact; browser/HTTP storage are intentionally separate.'},null,2));await browser.close();}
