import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
export const root=path.resolve(process.env.GRIDTONE_SOURCE || fileURLToPath(new URL('..',import.meta.url)));
export function runtime(extra={}){
 const c=vm.createContext({console,crypto:webcrypto,atob,btoa,Blob,setTimeout,clearTimeout,setInterval,clearInterval,performance,...extra});c.globalThis=c;
 const modules=['model','presets','session','editing','commands','studio','workspace/selection','workspace/commands','music/progressions','music/harmony','music/generation','music/ensemble','catalog-data','catalog','music/recipes','creation/operations','creation/placement','creation/session','audio','audio/instruments','audio/sample-banks','storage/projects','io','playback'];
 for(const f of modules)vm.runInContext(fs.readFileSync(path.join(root,'src',f+'.js'),'utf8'),c,{filename:f+'.js'});
 return c.GridTone;
}
export const json=x=>JSON.parse(JSON.stringify(x));
export function blank(G,bars=8){const p=G.blankProject();p.bars=bars;p.tracks[0].patterns[0].bars=bars;return G.validateProject(p);}
export function context(G,bars=4){let p=G.recipeProject('recipe.pop');if(bars===8){const h=p.tracks[0],pat=h.patterns[0];const old=G.clone(pat.notes);pat.notes.push(...old.map(n=>({...n,id:G.uid('n'),start:n.start+4*G.BAR})));const ev=G.clone(pat.harmony.events);pat.bars=8;pat.harmony.events.push(...ev.map(e=>({...e,start:e.start+4*G.BAR})));G.confirmHarmony(pat,pat.harmony);p.bars=8;for(const t of p.tracks.slice(1))t.patterns[0].bars=8;}
 const t=p.tracks.at(-1);return {p,t,pat:t.patterns[0],target:{trackId:t.id,clipId:t.clips[0].id},source:p.tracks[0]};}
