import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {studioRuntime} from './studio-runtime.mjs';
import {root,json} from './runtime.mjs';
const G=studioRuntime(),pack=G.EXPANSION_PACK;
test('EX00 retained source content and original studio DSP match imported 2.2.1 baseline',()=>{
 const hashes={'catalog/builtin.json':'4205d9193552a7148c9194f13a7012994d49bc596c1c087a3c2e88b97ad76717','catalog/studio.json':'46be32083370069d6457c23be9c37077c81e2089e10f22fa219c0985e29860da','catalog/studio-combos.json':'ee6020aeeccbb6debfe7784e7bfdd7fd6c4f5e90a10821bf924bd71c6dad99b4','catalog/studio-sources.json':'38201f8123bbbc4d272791b3fd4cf1c8a932245efe04f561f423a8f01d981378','src/audio/studio-engines.js':'badea879edc4d541a72e8c539ea5651febc8f9de2d4fb3dcb3c29c9edb18f1c9'};
 for(const [path,hash]of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(root+'/'+path)).digest('hex'),hash,path);
});
test('EX01 expansion validates, has 26 melodic sounds, one 16-piece kit and 24 patterns',()=>{
 const c=G.validateCatalog(pack);assert.equal(c.presets.length,27);assert.equal(c.presets.filter(p=>p.engine!=='drum').length,26);assert.equal(c.templates.length,24);assert.equal(c.drumkits[0].rows.length,16);
 assert.equal(new Set(c.presets.map(p=>JSON.stringify(p.synthesis))).size,27);
 assert.equal(c.templates.filter(t=>t.role==='drums').length,12);
});
test('EX02 source files match pinned SHA256 and explicit licenses; sample payload stays below 1.3 MB',()=>{
 const receipts=JSON.parse(fs.readFileSync(root+'/vendor/expansion/sources.json'));
 for(const r of receipts){const bytes=fs.readFileSync(root+'/vendor/expansion/'+r.source+'/'+r.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.equal(r.license,'CC0-1.0');}
 assert.ok(receipts.filter(r=>/\.WAV$/i.test(r.path)).reduce((n,r)=>n+r.bytes,0)<1300000);
});
test('EX03 every new pattern can be placed, compiled, saved and reopened without modifying source',()=>{
 for(const item of pack.templates){const p=G.blankProject(),before=JSON.stringify(p),r=G.applyTemplate(p,G.getTemplate(item.id),{mode:'new-track',bar:0});assert.equal(JSON.stringify(p),before);const q=G.validateProject(JSON.parse(JSON.stringify(r.project))),events=G.compileSong(q).events;assert.equal(events.length,item.notes.length,item.id);assert.ok(events.every(n=>Number.isFinite(n.pitch)&&n.duration>0));assert.equal(G.missingResources(q).length,0);}
});
test('EX04 new rhythm families differ in their rhythmic skeleton, not merely velocity or transposition',()=>{
 const seen=new Set();for(const t of pack.templates){const key=t.role+JSON.stringify(t.notes.map(n=>[t.kind==='drum'?n.pitch:0,n.start,n.duration]));assert.ok(!seen.has(key),t.id);seen.add(key);}
 const drums=pack.templates.filter(t=>t.kind==='drum');
 for(let i=0;i<drums.length;i++)for(let j=i+1;j<drums.length;j++){const a=new Set(drums[i].notes.map(n=>n.pitch+':'+n.start)),b=new Set(drums[j].notes.map(n=>n.pitch+':'+n.start)),union=new Set([...a,...b]),same=[...a].filter(x=>b.has(x)).length;assert.ok(1-same/union.size>.15,drums[i].id+' / '+drums[j].id);}
});
test('EX05 every progression is discoverable as chords, including twelve-bar blues',()=>{
 const p=G.blankProject(),families=G.studioFamilies(p,{kind:'rhythm',role:'chords'});
 for(const progression of G.PROGRESSIONS){const id=progression.id+'.generated';assert.ok(families.some(f=>f.members.includes(id)&&f.subcategory));const t=G.studioItem(id,p);assert.equal(t.bars,progression.bars);const r=G.applyTemplate(p,t,{mode:'new-track',bar:0});assert.equal(G.compileSong(r.project).events.length,t.notes.length);}
});
test('EX06 808 sound selection pins exact kit and assets while preserving original notes',()=>{
 const p=G.recipeProject('recipe.pop'),t=p.tracks.find(t=>t.kind==='drum'),before=JSON.stringify(p),notes=json(t.patterns[0].notes),q=G.applyStudioSound(p,t.id,'expansion.drum.808'),qt=q.tracks.find(x=>x.id===t.id);
 assert.equal(JSON.stringify(p),before);assert.deepEqual(json(qt.patterns[0].notes),notes);assert.equal(qt.drumkitId,'expansion.kit.808');assert.equal(Object.keys(q.assets).length,16);assert.equal(G.missingResources(q).length,0);
 assert.equal(G.newTrack('drum',0,'expansion.drum.808').drumkitId,'expansion.kit.808');
});
test('EX07 new synthesis definitions survive portable document roundtrip exactly',()=>{
 for(const preset of pack.presets){const p=G.blankProject();p.tracks=[G.newTrack(preset.engine==='drum'?'drum':'melodic',0,preset.id)];G.pinDocument(p);const q=G.validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(json(G.resolvePreset(preset.id,q).synthesis??null),json(preset.synthesis??null));}
});
test('EX08 malformed, silent, excessive or DC waveform coefficients are rejected',()=>{
 const original=pack.presets.find(p=>p.engine==='studio-wave');
 for(const mutate of [p=>p.real[0]=1,p=>p.imag.pop(),p=>p.real[1]=NaN,p=>p.real=Array(100).fill(.1),p=>{p.real.fill(0);p.imag.fill(0);},p=>p.attack=-1]){const p=G.clone(original);mutate(p.synthesis);assert.throws(()=>G.validateCatalog({...pack,presets:[p]}));}
});
test('EX09 all expansion material has one visible family and a non-empty subcategory',()=>{
 const fam=G.studioFamilies(G.blankProject());for(const item of [...pack.presets,...pack.templates]){const matches=fam.filter(f=>f.members.includes(item.id));assert.equal(matches.length,1,item.id);assert.ok(matches[0].subcategory);}
});
test('EX10 secondary category is remembered and applied independently from collections',()=>{
 const context=vm.createContext({GridTone:G,console,document:{addEventListener(){}}});
 vm.runInContext(fs.readFileSync(root+'/src/views/studio-library.js','utf8'),context);
 const p=G.blankProject(),library=Object.create(G.StudioLibrary.prototype);
 Object.assign(library,{c:{getProject:()=>p},shelf:{all:()=>[],item:()=>null},domain:'music',kind:'rhythm',role:'drums',subcategory:'碎拍',browse:'all',query:'',collections:{},legacy:false});
 const rows=library.familyList();assert.ok(rows.length>=3);assert.ok(rows.every(f=>f.subcategory==='碎拍'));assert.ok(library.familyList({ignoreSubcategory:true}).length>rows.length);
});
test('EX11 extra 808 percussion uses the original kit for preview if the current kit lacks roles',()=>{
 const p=G.blankProject(),t=G.newTrack('drum');p.tracks=[t];
 assert.equal(G.studioCanReuseTrack(p,G.getTemplate('expansion.pattern.drum.bossa'),t),false);
 assert.equal(G.studioCanReuseTrack(p,G.getTemplate('expansion.pattern.drum.one-drop'),t),true);
 t.drumkitId='expansion.kit.808';assert.equal(G.studioCanReuseTrack(p,G.getTemplate('expansion.pattern.drum.bossa'),t),true);
});
test('EX12 reselecting the same 808 kit preserves extended percussion without role remapping',()=>{
 const p=G.applyTemplate(G.blankProject(),G.getTemplate('expansion.pattern.drum.afro'),{mode:'new-track'}).project,t=p.tracks.at(-1),q=G.applyStudioSound(p,t.id,'expansion.drum.808');
 assert.deepEqual(json(q.tracks.at(-1).patterns[0].notes),json(t.patterns[0].notes));
});
test('EX13 new drum skeletons differ from retained studio patterns even after quantizing performance timing',()=>{
 const onsets=t=>new Set(t.notes.filter(n=>n.start<2*G.BAR).map(n=>n.pitch+':'+Math.round(n.start/240)));
 for(const a of pack.templates.filter(t=>t.kind==='drum'))for(const b of G.STUDIO_PACK.templates.filter(t=>t.kind==='drum')){const aa=onsets(a),bb=onsets(b),union=new Set([...aa,...bb]),same=[...aa].filter(x=>bb.has(x)).length;assert.ok(1-same/union.size>.2,a.id+' / '+b.id);}
});
