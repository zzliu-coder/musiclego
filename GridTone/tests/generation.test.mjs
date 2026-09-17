import test from 'node:test';import assert from 'node:assert/strict';
import '../src/model.js';import '../src/presets.js';import '../src/editing.js';import '../src/music/progressions.js';import '../src/music/harmony.js';import '../src/music/generation.js';import '../src/music/ensemble.js';import '../src/catalog-data.js';import '../src/catalog.js';import '../src/music/recipes.js';
const G=globalThis.GridTone;
function setup(key=0){const p=G.recipeProject('recipe.pop',{key}),t=p.tracks.find(t=>t.name==='示范旋律'),source=p.tracks.find(t=>t.role==='chords'),target={trackId:t.id,clipId:t.clips[0].id},harmony=G.resolveHarmony(p,{...target,sourceTrackId:source.id});return {p,t,source,target,harmony,context:{harmony,notes:t.patterns[0].notes}};}
test('R5-T03 eight recipes are editable, contain empty melody and survive export/reopen',()=>{
 for(const r of G.RECIPES){const p=G.recipeProject(r.id),before=G.clone(p);assert.equal(p.tracks.length,5);assert.equal(p.tracks.at(-1).patterns[0].notes.length,0);assert.ok(G.compileSong(p).events.length>20);assert.deepEqual(G.validateProject(JSON.parse(JSON.stringify(p))),p);const base=G.demoProject(),applied=G.applyRecipe(base,r.id,{bar:9});assert.deepEqual(applied.project.tracks.slice(0,4),base.tracks);assert.ok(applied.project.tracks.slice(4).every(t=>t.clips[0].bar===9));assert.deepEqual(p,before);for(const t of applied.project.tracks.slice(4))for(const pat of t.patterns)if(pat.generation)assert.equal(G.dependencyStatus(applied.project,pat),'current');}
});
test('R6-T01/T02 musical output valid and deterministic across keys and 100 seeds',()=>{
 for(let seed=0;seed<100;seed++){const {p,target,context}=setup(seed%12),result=G.generateMelody(context,{density:seed%2?'dense':'normal'},seed);assert.ok(result.candidates.length);for(const c of result.candidates){assert.doesNotThrow(()=>G.applyGenerated(p,target,c));for(let i=1;i<c.notes.length;i++)assert.ok(c.notes[i].start>=c.notes[i-1].start+c.notes[i-1].duration);}
 const other=G.clone(context);other.notes.forEach((n,i)=>n.id='other_'+i);assert.deepEqual(G.generateMelody(other,{},seed).candidates.map(c=>G.musicalNotes(c.notes)),G.generateMelody(context,{},seed).candidates.map(c=>G.musicalNotes(c.notes)));}
});
test('R6-T03/T04 retained dimensions and range silence survive regeneration',()=>{
 const {context}=setup();const notes=context.notes.slice(0,4);context.notes=notes;
 for(const kind of ['pitch','rhythm','all']){context.retention={notes:[{id:notes[0].id,[kind]:true}],ranges:[]};for(const c of G.generateMelody(context,{},42).candidates){const n=c.notes.find(n=>n.id===notes[0].id);assert.ok(n);if(kind!=='rhythm')assert.equal(n.pitch,notes[0].pitch);if(kind!=='pitch'){assert.equal(n.start,notes[0].start);assert.equal(n.duration,notes[0].duration);}if(kind==='all')assert.deepEqual(n,notes[0]);}}
 context.retention={notes:[],ranges:[{start:0,end:G.BAR}]};for(const c of G.generateMelody(context,{},42).candidates)assert.deepEqual(c.notes.filter(n=>n.start<G.BAR),notes.filter(n=>n.start<G.BAR));
 context.retention={notes:[],ranges:[{start:0,end:4*G.BAR}]};assert.equal(G.generateMelody(context,{},42).candidates.length,0);
});
test('R6-T05/T08 secondary dominant and sustained-note analysis use actual chord classes',()=>{
 const note=G.newNote(61,0,G.BAR),h={end:2*G.BAR,events:[{start:0,duration:G.BAR/2,pitchClasses:[9,1,4,7]},{start:G.BAR/2,duration:G.BAR/2,pitchClasses:[2,5,9]}]};assert.equal(G.explainNote(note,h).role,'有条件变化');assert.match(G.explainNote(note,h).reason,/长音/);
});
test('R6-T06/T07 three different candidates and only ending changes',()=>{
 const {context}=setup(),result=G.generateMelody(context,{},11);assert.equal(result.candidates.length,3);assert.equal(new Set(result.candidates.map(c=>JSON.stringify(G.musicalNotes(c.notes)))).size,3);
 for(const c of G.generateMelody(context,{mode:'ending'},42).candidates)assert.deepEqual(c.notes.filter(n=>n.start<3*G.BAR),context.notes.filter(n=>n.start<3*G.BAR));
});
test('R6-T11 shared instance generates independent music and preserves first instance',()=>{
 const {p,t,target,context}=setup();p.bars=8;t.clips.push({id:G.uid('c'),patternId:t.patterns[0].id,bar:4});const before=G.clone(t.patterns[0]),candidate=G.generateMelody(context,{},42).candidates[0];const result=G.applyGenerated(p,{trackId:t.id,clipId:t.clips[1].id},candidate);const track=result.project.tracks.find(x=>x.id===t.id);assert.deepEqual(track.patterns[0],before);assert.notEqual(track.clips[0].patternId,track.clips[1].patternId);assert.deepEqual(p.tracks.find(x=>x.id===t.id).patterns[0],before);
});
test('R6-T12 target transpose writes inverse pitch and preserves processing',()=>{
 const {p,t,target,source}=setup();t.pipeline.transpose=12;const h=G.resolveHarmony(p,{...target,sourceTrackId:source.id}),candidate=G.generateMelody({harmony:h,notes:[]},{low:60,high:72},42).candidates[0];assert.ok(candidate.notes.every(n=>n.pitch>=48&&n.pitch<=60));const applied=G.applyGenerated(p,target,candidate);assert.equal(applied.project.tracks.find(x=>x.id===t.id).pipeline.transpose,12);
});
test('R7-T01/T02 drum edits stay within selected role and missing role rejects',()=>{
 const {p}=setup(),t=p.tracks.find(t=>t.role==='drums'),target={trackId:t.id,clipId:t.clips[0].id},before=G.clone(t.patterns[0].notes);const c=G.generateEnsemble(p,target,{mode:'drums',drumRole:'closedHat',lastBeat:true,density:'dense'},42);assert.deepEqual(c.notes.filter(n=>n.pitch!==42||n.start<4*G.BAR-G.PPQ),before.filter(n=>n.pitch!==42||n.start<4*G.BAR-G.PPQ).sort((a,b)=>a.start-b.start||a.pitch-b.pitch));
 assert.throws(()=>G.remapDrums([G.newNote(42,0)],G.resolveKit('builtin.standard',p).rows,[]),/缺少/);
});
test('R7-T03/T04 strategies differ and source melody stays unchanged',()=>{
 const {p,t,source}=setup(),before=G.clone(p),drums=p.tracks.find(t=>t.role==='drums'),bass=p.tracks.find(t=>t.role==='bass');bass.patterns[0].notes=[];const target={trackId:bass.id,clipId:bass.clips[0].id},options={mode:'bass',sourceTrackId:source.id,referenceTrackId:drums.id};const a=G.generateEnsemble(p,target,{...options,strategy:'align'}),b=G.generateEnsemble(p,target,{...options,strategy:'answer'});assert.notDeepEqual(a.notes.map(n=>n.start),b.notes.map(n=>n.start));assert.ok(G.generateEnsemble(p,target,{mode:'bass',sourceTrackId:source.id}).notes.length);assert.deepEqual(t.patterns,before.tracks.find(x=>x.id===t.id).patterns);
});
test('R8-T03/T04 arrangement preserves original music and rejects collision atomically',()=>{
 const {p}=setup(),before=G.clone(p);for(const bars of [8,16]){const result=G.arrangeSections(p,{bar:8,bars,sourceBar:0,style:'variation'});assert.doesNotThrow(()=>G.validateProject(result));assert.notEqual(result.tracks[0].clips.at(-1).patternId,result.tracks[0].clips[0].patternId);}assert.throws(()=>G.arrangeSections(p,{bar:0,bars:8,sourceBar:0}),/已有/);assert.deepEqual(p,before);
});
test('R8 two generated melody tracks receive globally distinct arrangement note IDs',()=>{
 const {p,target,context}=setup();const empty=p.tracks.at(-1),harmony=G.resolveHarmony(p,{trackId:empty.id,clipId:empty.clips[0].id,sourceTrackId:p.tracks[0].id});
 const doc=G.applyGenerated(p,{trackId:empty.id,clipId:empty.clips[0].id},G.generateMelody({harmony,notes:[]},{},42).candidates[0]).project;
 for(const bars of [8,16]){const arranged=G.arrangeSections(doc,{bar:4,bars,sourceBar:0});assert.doesNotThrow(()=>G.validateProject(arranged));assert.equal(arranged.bars,bars+4);}
});
test('R4-T08 copying and deleting sources preserve generated notes with accurate dependency state',()=>{
 const {p,t,target,context}=setup(),c=G.generateMelody(context,{},9).candidates[0],result=G.applyGenerated(p,target,c).project,copy=G.copyProject(result),pat=copy.tracks.find(x=>x.id!==t.id&&x.name===t.name).patterns[0];assert.equal(G.dependencyStatus(copy,pat),'current');const notes=G.clone(pat.notes);copy.tracks=copy.tracks.filter(x=>x.id!==pat.generation.sources[0].trackId);assert.equal(G.dependencyStatus(copy,pat),'missing');assert.deepEqual(pat.notes,notes);assert.doesNotThrow(()=>G.validateProject(copy));
});
test('R5-T02 configured recipe extension works without a new rendering branch',()=>{
 const copy={...G.RECIPES[0],id:'recipe.test-config',name:'配置扩展验收'};G.RECIPES.push(copy);try{const p=G.recipeProject(copy.id);assert.equal(p.title,copy.name);assert.equal(p.tracks.length,5);}finally{G.RECIPES.pop();}
});
test('R5-T05 drum role mapping follows roles when target row pitches are reordered',()=>{
 const source=[{pitch:36,role:'kick'},{pitch:38,role:'snare'}],target=[{pitch:60,role:'snare'},{pitch:61,role:'kick'}],notes=[G.newNote(36,0),G.newNote(38,960)];assert.deepEqual(G.remapDrums(notes,source,target).map(n=>[n.pitch,n.start]),[[61,0],[60,960]]);assert.throws(()=>G.remapDrums(notes,source,[target[0]]),/kick/);
});
test('R5-T06 recipe failures leave old tracks and resource snapshots untouched',()=>{
 const {p}=setup();p.tracks=Array.from({length:60},(_,i)=>G.newTrack('melodic',i));const before=G.clone(p);assert.throws(()=>G.applyRecipe(p,G.RECIPES[0].id),/轨道空间/);assert.deepEqual(p,before);assert.throws(()=>G.applyRecipe(p,G.RECIPES[0].id,{bar:255}),/范围/);
});
test('R7-T04 accompaniment strategies use actual reference activity and keep melody immutable',()=>{
 const {p,t,source}=setup(),before=G.clone(t);const backing=G.newTrack('melodic',0,'cloudpad');backing.role='texture';backing.patterns[0].bars=4;p.tracks.push(backing);const target={trackId:backing.id,clipId:backing.clips[0].id},s={mode:'accompaniment',sourceTrackId:source.id,referenceTrackId:t.id};
 const a=G.generateEnsemble(p,target,{...s,strategy:'answer'}),b=G.generateEnsemble(p,target,{...s,strategy:'together'});assert.notDeepEqual(G.musicalNotes(a.notes),G.musicalNotes(b.notes));assert.deepEqual(t,before);assert.ok(b.notes.every(n=>t.patterns[0].notes.some(m=>m.start===n.start)));
});
test('R7-T06 source dependency changes do not automatically rewrite downstream music',()=>{
 const {p,t,target,context}=setup(),doc=G.applyGenerated(p,target,G.generateMelody(context,{},5).candidates[0]).project,pat=doc.tracks.find(x=>x.id===t.id).patterns[0],before=G.clone(pat.notes),source=doc.tracks.find(x=>x.id===pat.generation.sources[0].trackId);source.patterns[0].notes[0].pitch++;assert.equal(G.dependencyStatus(doc,pat),'stale');assert.deepEqual(pat.notes,before);source.patterns[0].notes[0].pitch--;assert.equal(G.dependencyStatus(doc,pat),'current');
});
test('R8-T01/A-prime preserves retained fields and whole protected range',()=>{
 const {p,t,context}=setup();const pat=t.patterns[0];pat.retention={notes:[{id:pat.notes.at(-1).id,all:true}],ranges:[{start:0,end:G.BAR}]};const result=G.arrangeSections(p,{bar:4,bars:16}),track=result.tracks.find(x=>x.id===t.id),variation=track.patterns.find(x=>x.id!==pat.id);assert.ok(variation);assert.deepEqual(G.musicalNotes(variation.notes.filter(n=>n.start<G.BAR)),G.musicalNotes(pat.notes.filter(n=>n.start<G.BAR)));assert.deepEqual(track.patterns[0],pat);assert.notDeepEqual(G.musicalNotes(variation.notes),G.musicalNotes(pat.notes));
});
