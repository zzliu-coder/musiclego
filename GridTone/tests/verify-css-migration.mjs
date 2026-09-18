/** Proves the cleanup preserves computed appearance with identical pre-cleanup DOM/JS. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {harness,root} from './browser-harness.mjs';
const baseline=execFileSync('git',['show','eaa01e6:GridTone/dist/index.html'],{cwd:root,maxBuffer:3e6}).toString();
const manifest=JSON.parse(await readFile(root+'assets.json','utf8'));
const css=(await Promise.all(manifest.styles.map(f=>readFile(root+f,'utf8')))).join('\n');
const migrated=baseline.replace(/<style>[\s\S]*?<\/style>/,'<style>'+css+'</style>');
const snapshots=[];let output;
for(const html of [baseline,migrated]){
 const h=await harness({html});output=h.output;const states=[];
 try{for(const skin of ['pearl','crystal'])for(const width of [1280,1440])for(const view of ['arrange','edit','mix']){
  await h.page.setViewportSize({width,height:900});await h.page.evaluate(({skin,view})=>{GridTone.appearance.set({skin,motion:'reduced'});GridToneApp.changeView(view);},{skin,view});
  states.push(await h.page.evaluate(()=>{
   const selectors=['.topbar','.workspace-tabs','.workspace-body','.template-shelf','.shelf-card','.arrange-row','.track-header','#gridframe','#note-grid','.editor-toolbar','.mix-strip','.btn','.statusbar'];
   return Object.fromEntries(selectors.map(s=>{const el=document.querySelector(s);if(!el)return [s,null];const c=getComputedStyle(el);return [s,Object.fromEntries([...c].filter(k=>!k.startsWith('--')).map(k=>[k,c.getPropertyValue(k)]))];}));
  }));
 }assert.deepEqual(h.errors,[]);}finally{await h.close();}snapshots.push(states);
}
assert.deepEqual(snapshots[1],snapshots[0]);
await writeFile(output+'/css-equivalence.json',JSON.stringify({status:'PASS',date:new Date().toISOString(),sha256:createHash('sha256').update(await readFile(root+'dist/index.html')).digest('hex'),baseline:'eaa01e6',cssSha256:createHash('sha256').update(css).digest('hex'),states:snapshots[0].length,method:'Identical baseline HTML/JS; old versus current CSS full computed styles across three workspaces, two skins and 1280/1440 desktop widths.'},null,2));
console.log('PASS CSS computed-style equivalence in 12 desktop states');
