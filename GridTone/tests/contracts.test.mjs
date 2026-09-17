import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/model.js';
import '../src/editing.js';
import '../src/commands.js';
const G = globalThis.GridTone;
test('R1: every allowed pattern length survives serialization', () => {
  for (const bars of G.PATTERN_BARS) {
    const p=G.blankProject(); p.bars=bars; p.tracks[0].patterns[0].bars=bars;
    p.tracks[0].patterns[0].notes=[G.newNote(60,bars*G.BAR-80.5,80.5)];
    assert.deepEqual(G.validateProject(JSON.parse(JSON.stringify(p))),p);
  }
});
test('R1: duration arithmetic ignores display grid, preserves fractional timing and split totals', () => {
  for (const duration of [120,80,240,1,80.5]) {
    const n=G.newNote(60,17.5,duration);
    assert.equal(G.durationNotes([n],'half',G.BAR)[0].duration,Math.max(1,duration/2));
    if(duration>=2){const parts=G.durationNotes([n],'split',G.BAR);assert.equal(parts[0].duration+parts[1].duration,duration);assert.equal(parts[1].start,n.start+parts[0].duration);}
  }
  assert.throws(()=>G.durationNotes([G.newNote(60,3800,40)],'double',G.BAR),/超出/);
  const n=G.newNote(60,10.5,120.5),parts=G.durationNotes([n],'cursor',G.BAR,80.25);
  assert.equal(parts[0].duration,69.75);assert.equal(parts[1].duration,50.75);assert.equal(parts[1].start,80.25);
  assert.deepEqual(G.durationNotes([n],'cursor',G.BAR,0),[n]);
});
test('command failure keeps input and no-op declares unchanged',()=>{
 const p=G.demoProject(),before=G.clone(p),failed=G.executeCommand(p,draft=>{draft.tracks[0].patterns[0].notes[0].duration=0;return draft;});assert.equal(failed.ok,false);assert.deepEqual(p,before);assert.equal(G.executeCommand(p,draft=>draft).changed,false);
});
test('R1-T03 resizing shared content checks every placement and rejects the whole command',()=>{
 const p=G.blankProject(),t=p.tracks[0],pat=t.patterns[0];p.bars=8;pat.bars=4;t.clips.push({id:G.uid('c'),patternId:pat.id,bar:4});const before=G.clone(p);const bad=G.executeCommand(p,draft=>{draft.tracks[0].patterns[0].bars=8;return draft;});assert.equal(bad.ok,false);assert.deepEqual(p,before);
});
test('R1: track duplication keeps internal sharing and isolates source IDs and music', () => {
  const p=G.demoProject(),t=p.tracks[0],result=G.duplicateTrack(p,t.id),copy=result.project.tracks[1];
  assert.notEqual(t.id,copy.id);assert.equal(copy.clips[0].patternId,copy.clips[1].patternId);
  assert.notEqual(copy.patterns[0].id,t.patterns[0].id);
  copy.patterns[0].notes[0].pitch=100;assert.notEqual(t.patterns[0].notes[0].pitch,100);
  assert.deepEqual(copy.fx,t.fx);assert.equal(copy.preset,t.preset);
});
