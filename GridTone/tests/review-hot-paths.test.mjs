import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtime,root} from './runtime.mjs';

function scheduler({loop=false}={}) {
 const G=runtime(),p=G.blankProject();p.bpm=120;
 const t=p.tracks[0],pat=t.patterns[0];pat.bars=4;
 pat.notes=[G.newNote(60,0,120),G.newNote(60,1920,120),G.newNote(62,1968,120)];
 const e=new G.AudioEngine(),calls=[],ctx={currentTime:.9};
 const record=({graph,note,at})=>{const source={id:note.id,gridStart:at,cancelled:false,stop(when){if(when<this.gridStart){this.cancelled=true;graph.sources.delete(this);}}};calls.push(source);graph.sources.add(source);};
 G.registerInstrument(G.presetById(t.preset,p).engine||'synth',record);
 e.ctx=ctx;e.graph={ctx,project:p,buses:new Map([[t.id,{input:{}}]]),sources:new Set(),update(){},dispose(){}};
 e.project=p;e.scope={kind:'song'};e.plan=e.compile(p,e.scope);e.tempo=120;e.playing=true;e.loop=loop;e.origin=0;e.fromTime=.9;
 e.tick();assert.equal(e.error,null);
 return {G,p,e,calls,ctx,live:()=>calls.filter(s=>!s.cancelled)};
}
for(const now of [.975,.997,.998,.999,1,1.001,1.015])test(`R-A onset partition and immediate refill at ${now}s`,()=>{
 const {G,p,e,calls,ctx,live}=scheduler();ctx.currentTime=now;
 const edited=G.cloneProject(p);edited.tracks[0].patterns[0].notes.push(G.newNote(67,2400,120));
 e.update(edited);
 assert.equal(e.error,null);assert.equal(e.playing,true);
 for(const time of [1,1.025])assert.equal(live().filter(s=>Math.abs(s.gridStart-time)<1e-8).length,1,`exactly one onset at ${time}`);
 assert.equal(live().filter(s=>s.gridStart===1).length,1);
 assert.ok(e.fromTime>=now+.129);assert.ok(calls.length>=2);
});
test('R-A repeated near-onset edits and loop seam do not duplicate or drop events',()=>{
 const {p,e,ctx,live}=scheduler({loop:true});
 for(const now of [.997,.998,.999,1,1.001]){ctx.currentTime=now;e.update(p);}
 assert.equal(live().filter(s=>s.gridStart===1).length,1);
 ctx.currentTime=7.9;e.fromTime=7.9;e.tick();ctx.currentTime=7.999;e.update(p);
 assert.equal(live().filter(s=>s.gridStart===8).length,1);
});
test('R-A tempo switches at cutoff and preserves the imminent old onset',()=>{
 const {G,p,e,ctx,live}=scheduler();ctx.currentTime=.999;
 const changed=G.cloneProject(p);changed.bpm=180;e.update(changed);
 assert.equal(live().filter(s=>s.gridStart===1).length,1);
 const expected=1.002+(1.025-1.002)*120/180;
 assert.equal(live().filter(s=>Math.abs(s.gridStart-expected)<1e-8).length,1);
});

function sampled(G){const p=G.blankProject();p.assets.sound={data:'data:audio/wav;base64,'+'A'.repeat(4*1024*1024),root:60,mode:'pitched',name:'sample',extra:{label:'original'}};p.tracks[0].patterns[0].notes=[G.newNote(60,0,240)];return G.validateProject(p);}
test('R-E ordinary production command never JSON-serializes the sample body',()=>{
 const lengths=[];const G=runtime({JSON:{parse:JSON.parse,stringify(value,...rest){const result=JSON.stringify(value,...rest);lengths.push(result?.length||0);return result;}}});
 const p=sampled(G);lengths.length=0;
 const before=G.cloneProject(p),result=G.executeCommand(before,d=>{d.tracks[0].patterns[0].notes[0].pitch++;});
 const persisted=G.cloneProject(result.document);
 assert.equal(result.ok,true);assert.equal(result.changed,true);assert.equal(persisted.assets.sound.data,p.assets.sound.data);
 assert.ok(Math.max(...lengths)<10000,`largest JSON serialization ${Math.max(...lengths)}`);
 assert.equal(p.tracks[0].patterns[0].notes[0].pitch,60);
});
test('R-E metadata snapshots are independent and data/meta changes remain undoable',()=>{
 const G=runtime(),p=sampled(G),before=G.cloneProject(p);
 const r=G.executeCommand(p,d=>{d.assets.sound.root=48;d.assets.sound.mode='oneshot';d.assets.sound.extra.label='changed';});
 assert.equal(r.changed,true);assert.equal(before.assets.sound.root,60);assert.equal(before.assets.sound.extra.label,'original');
 assert.equal(G.projectEquals(before,p),true);assert.equal(G.projectEquals(before,r.document),false);
 for(const change of [d=>{d.assets.sound.data+='A';},d=>{delete d.assets.sound;},d=>{d.assets.other={...d.assets.sound};}])assert.equal(G.executeCommand(p,change).changed,true);
 assert.equal(G.executeCommand(p,()=>{}).changed,false);
});
test('R-E imported and mutated sample bodies and metadata are still validated',()=>{
 const G=runtime(),p=sampled(G);
 for(const edit of [a=>a.data='bad',a=>a.data=null,a=>a.root=500,a=>a.mode='bad']){
  const next=G.cloneProject(p);edit(next.assets.sound);assert.throws(()=>G.validateProject(next));
 }
 const imported=JSON.parse(JSON.stringify(p));imported.assets.sound.data='not-audio';assert.throws(()=>G.validateProject(imported));
 const copy=G.validateProject(p);copy.assets.sound.extra.label='different';assert.equal(p.assets.sound.extra.label,'original');
});
test('R-E app reuses command result while direct gestures retain validation',()=>{
 const source=fs.readFileSync(root+'/src/app.js','utf8');
 assert.match(source,/markChanged\(before,false,result\)/);
 assert.match(source,/if\(!commandResult\)\{[\s\S]*?project=validateProject\(project\)/);
 assert.match(source,/commandResult \? !commandResult.changed : G.projectEquals\(before,project\)/);
});
