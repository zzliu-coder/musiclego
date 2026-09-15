import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/model.js';import '../src/presets.js';import '../src/session.js';
const G=globalThis.GridTone;
test('R1: migrates v1 without mutating source or musical notes',()=>{
 const old=JSON.parse(readFileSync(new URL('../examples/午后的留白.gridtone',import.meta.url)));const before=G.clone(old),p=G.validateProject(old);
 assert.equal(p.version,2);assert.deepEqual(old,before);
 for(let i=0;i<p.tracks.length;i++){assert.deepEqual(p.tracks[i].patterns,old.tracks[i].patterns);assert.equal('octave' in p.tracks[i],false);assert.equal('solo' in p.tracks[i],false);}
});
test('R1: view-only browsing does not change project or compiled notes',()=>{const p=G.demoProject(),s=G.createEditorSession(p),b=G.clone(p),events=G.compileSong(p);G.moveViewport(s,p.tracks[0],12);G.fitViewport(s,p.tracks[0],p.tracks[0].patterns[1]);assert.deepEqual(p,b);assert.deepEqual(G.compileSong(p),events);});
test('R1: all clip openings resolve coherent track/pattern/instance',()=>{const p=G.demoProject(),s=G.createEditorSession(p),t=p.tracks[2],c=t.clips[2];G.openPatternInSession(s,p,{trackId:t.id,clipId:c.id});assert.equal(s.patternId,c.patternId);assert.equal(s.trackId,t.id);assert.equal(s.clipId,c.id);assert.equal(s.view,'edit');assert.throws(()=>G.openPatternInSession(s,p,{patternId:'missing'}));});
test('R1: deleted selections and monitoring ids reconcile',()=>{const p=G.demoProject(),s=G.createEditorSession(p),b=G.createPlaybackContext();s.selected=['missing'];b.soloIds=['missing',p.tracks[0].id];s.clipId='missing';G.reconcileSession(s,p,b);assert.deepEqual(s.selected,[]);assert.deepEqual(b.soloIds,[p.tracks[0].id]);assert.ok(s.clipId);});
test('R1: local scope and labels use actual pattern length',()=>{const p=G.demoProject(),s=G.createEditorSession(p),b=G.createPlaybackContext();p.tracks[0].patterns[0].bars=4;b.target='pattern';assert.match(G.playbackLabel(p,s,b),/4 小节/);assert.equal(G.scopeFor(p,s,b).ignoreMute,true);b.soloIds=[p.tracks[0].id];b.target='song';assert.deepEqual(G.scopeFor(p,s,b,{exporting:true}).soloIds,[]);});
