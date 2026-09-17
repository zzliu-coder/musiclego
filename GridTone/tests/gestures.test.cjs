const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');const root=path.join(__dirname,'..');
function setup() {
  const listeners = {}, timers = new Map(); let timerId = 0;
  const stats = {draws:0, renders:0, commits:0, menu:0};
  class Element {
    matches() { return false; }
    closest(s) { return s.includes('#gridframe') ? frame : null; }
  }
  const frame = new Element();
  Object.assign(frame,{setPointerCapture(){},focus(){},classList:{add(){},remove(){}},parentElement:{scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,right:960,top:0,bottom:336})}});
  const grid = {getBoundingClientRect:()=>({left:0,top:0,width:960,height:336})};
  const document={activeElement:frame,querySelector:s=>s==='#note-grid'?grid:s==='#gridframe'?frame:null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f};
  const frames=new Map();const flush=()=>{const fs=[...frames.values()];frames.clear();for(const f of fs)f();};
  const context=vm.createContext({requestAnimationFrame:f=>{frames.set(++timerId,f);return timerId;},cancelAnimationFrame:i=>frames.delete(i),document,window:{addEventListener:(n,f)=>listeners['window:'+n]=f},Element,console,Blob,Date,Math,setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:i=>timers.delete(i)});
  for(const f of ['src/model.js','src/session.js','src/studio.js','src/ui/editor-gestures.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
  const G=context.GridTone;let p=G.blankProject();const S=G.createEditorSession(p);S.view='edit';
  const track=()=>p.tracks[0],pattern=()=>track().patterns[0];
  const noop=()=>{};
  const interaction=G.createEditorInteractions({S,B:G.createPlaybackContext(),getProject:()=>p,setProject:v=>p=v,track,pattern,snapshot:()=>G.clone(p),markChanged:before=>{if(JSON.stringify(before)!==JSON.stringify(p))stats.commits++;},render:()=>stats.renders++,drawGrid:()=>stats.draws++,preview:noop,selectedNotes:()=>pattern().notes.filter(n=>S.selected.includes(n.id)),noteMenu:()=>stats.menu++,openPattern:noop,toast:noop,closeModal:noop,togglePlay:noop,undo:noop,redo:noop,handleAction:noop,mutate:f=>f(),copyNotes:noop,pasteNotes:noop,deleteNotes:noop,interact:noop,seekPattern:()=>stats.seek=(stats.seek||0)+1,beginRange:noop,commitRange:noop,hasForm:()=>false});
  interaction.setGeometry({width:960,left:72,top:30,row:24,cw:55,rows:[72,71,70,69,68,67,66,65,64,63],height:336,offset:0,bars:1});
  const fire=(name,x=100,y=42,extra={})=>listeners[name]({target:frame,clientX:x,clientY:y,button:0,pointerId:1,pointerType:'mouse',preventDefault(){},key:'',code:'',...extra});
  return {G,S,pattern,interaction,stats,fire,timers,flush};
}

test('ruler click never writes music',()=>{const h=setup();h.fire('pointerdown',100,18);h.fire('pointerup',100,18);assert.equal(h.pattern().notes.length,0);assert.equal(h.stats.seek,1);});
test('Escape rolls back live drawing without an undo item',()=>{const h=setup();h.fire('pointerdown');h.fire('pointermove',190,42);h.flush();h.fire('keydown',190,42,{key:'Escape'});h.fire('pointerup',190,42);assert.equal(h.pattern().notes.length,0);assert.equal(h.stats.commits,0);assert.equal(h.interaction.getDrag(),null);});
test('right click on a note opens menu without ReferenceError',()=>{const h=setup();h.pattern().notes=[h.G.newNote(72,0,480)];h.fire('contextmenu');assert.equal(h.stats.menu,1);});
test('Shift marquee adds to prior selection',()=>{const h=setup(),a=h.G.newNote(72,0),b=h.G.newNote(72,960);h.pattern().notes=[a,b];h.S.tool='select';h.S.selected=[a.id];h.fire('pointerdown',280,31,{shiftKey:true});h.fire('pointermove',350,53,{shiftKey:true});h.flush();h.fire('pointerup',350,53,{shiftKey:true});assert.ok(h.S.selected.includes(a.id));assert.ok(h.S.selected.includes(b.id));});
test('touch movement below threshold cannot silently alter pitch',()=>{const h=setup();h.pattern().notes=[h.G.newNote(72,0,480)];h.fire('pointerdown',100,53,{pointerType:'touch'});h.fire('pointermove',100,55);h.flush();for(const f of [...h.timers.values()])f();h.fire('pointerup',100,55);assert.equal(h.pattern().notes[0].pitch,72);assert.equal(h.stats.commits,0);assert.equal(h.stats.menu,1);});
test('120 pointer events coalesce to one animation update and one undo',()=>{const h=setup();h.fire('pointerdown');const d=h.stats.draws;for(let i=0;i<120;i++)h.fire('pointermove',120+i%2,42);assert.equal(h.stats.draws,d);h.flush();assert.equal(h.stats.draws-d,1);h.fire('pointerup',120,42);assert.equal(h.stats.commits,1);});

test('pointercancel restores original note geometry and prior selection',()=>{const h=setup(),a=h.G.newNote(72,0,480);h.pattern().notes=[a];h.S.selected=[];h.fire('pointerdown',100,42);h.fire('pointermove',210,66);h.flush();assert.notEqual(h.pattern().notes[0].start,0);h.fire('pointercancel');assert.equal(h.pattern().notes[0].start,0);assert.equal(h.pattern().notes[0].pitch,72);assert.equal(h.S.selected.length,0);assert.equal(h.stats.commits,0);});
test('subthreshold note movement is selection only',()=>{const h=setup(),a=h.G.newNote(72,0,480);h.pattern().notes=[a];h.fire('pointerdown',100,42);h.fire('pointermove',102,43);h.flush();h.fire('pointerup',102,43);assert.equal(h.pattern().notes[0].start,0);assert.equal(h.stats.commits,0);assert.ok(h.S.selected.includes(a.id));});
test('one committed drag snaps timing and keeps duration unchanged',()=>{const h=setup(),a=h.G.newNote(72,0,480);h.pattern().notes=[a];h.fire('pointerdown',100,42);h.fire('pointermove',230,66);h.flush();h.fire('pointerup',230,66);const n=h.pattern().notes[0];assert.equal(n.start%h.S.snap,0);assert.equal(n.duration,480);assert.equal(n.pitch,71);assert.equal(h.stats.commits,1);});
test('window blur cancels the drawing transaction',()=>{const h=setup();h.fire('pointerdown');h.fire('pointermove',240,42);h.flush();h.fire('window:blur');assert.equal(h.pattern().notes.length,0);assert.equal(h.stats.commits,0);assert.equal(h.interaction.getDrag(),null);});
