const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.argv[2];
function setup() {
  const listeners = {}, timers = new Map(); let timerId = 0;
  const stats = {draws:0, renders:0, commits:0, menu:0};
  class Element {
    matches() { return false; }
    closest(s) { return s === '#gridframe' ? frame : null; }
  }
  const frame = new Element();
  Object.assign(frame,{setPointerCapture(){},focus(){},classList:{add(){},remove(){}},parentElement:{scrollLeft:0,scrollTop:0}});
  const grid = {getBoundingClientRect:()=>({left:0,top:0,width:960,height:336})};
  const document={activeElement:frame,querySelector:s=>s==='#note-grid'?grid:s==='#gridframe'?frame:null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f};
  const context=vm.createContext({document,window:{addEventListener:(n,f)=>listeners['window:'+n]=f},Element,console,Blob,Date,Math,setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:i=>timers.delete(i)});
  for(const f of ['src/model.js','src/session.js','src/ui/editor-gestures.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
  const G=context.GridTone;let p=G.blankProject();const S=G.createEditorSession(p);S.view='edit';
  const track=()=>p.tracks[0],pattern=()=>track().patterns[0];
  const noop=()=>{};
  const interaction=G.createEditorInteractions({S,B:G.createPlaybackContext(),getProject:()=>p,setProject:v=>p=v,track,pattern,snapshot:()=>G.clone(p),markChanged:before=>{if(JSON.stringify(before)!==JSON.stringify(p))stats.commits++;},render:()=>stats.renders++,drawGrid:()=>stats.draws++,preview:noop,selectedNotes:()=>pattern().notes.filter(n=>S.selected.includes(n.id)),noteMenu:()=>stats.menu++,openPattern:noop,toast:noop,closeModal:noop,togglePlay:noop,undo:noop,redo:noop,handleAction:noop,mutate:f=>f(),copyNotes:noop,pasteNotes:noop,deleteNotes:noop,interact:noop,beginRange:noop,commitRange:noop,hasForm:()=>false});
  interaction.setGeometry({width:960,left:72,top:30,row:24,cw:55,rows:[72,71,70,69,68,67,66,65,64,63],height:336});
  const fire=(name,x=100,y=42,extra={})=>listeners[name]({target:frame,clientX:x,clientY:y,button:0,pointerId:1,pointerType:'mouse',preventDefault(){},key:'',code:'',...extra});
  return {G,S,pattern,interaction,stats,fire,timers};
}
const results=[];
function record(name,run){const observed=run(setup());results.push({name,...observed});}
record('Right-click handler',h=>{try{h.fire('contextmenu');return {reproduced:false};}catch(e){return {reproduced:e.name==='ReferenceError',error:e.message};}});
record('Click beat ruler above note rows',h=>{h.fire('pointerdown',100,18);h.fire('pointerup',100,18);return {reproduced:h.pattern().notes.length===1,notesAdded:h.pattern().notes.length,pitch:h.pattern().notes[0]?.pitch};});
record('Escape during drawing gesture',h=>{h.fire('pointerdown');h.fire('pointermove',190,42);h.fire('keydown',190,42,{key:'Escape'});const active=!!h.interaction.getDrag();h.fire('pointerup',190,42);return {reproduced:active&&h.pattern().notes.length===1,gestureStillActiveAfterEscape:active,notesAfterRelease:h.pattern().notes.length,historyCommits:h.stats.commits};});
record('Shift-add marquee selection',h=>{const a=h.G.newNote(72,0),b=h.G.newNote(72,960);h.pattern().notes=[a,b];h.S.tool='select';h.S.selected=[a.id];h.fire('pointerdown',280,31,{shiftKey:true});h.fire('pointermove',350,53,{shiftKey:true});h.fire('pointerup',350,53,{shiftKey:true});return {reproduced:!h.S.selected.includes(a.id)&&h.S.selected.includes(b.id),priorSelectionRetained:h.S.selected.includes(a.id),newSelectionIncluded:h.S.selected.includes(b.id)};});
record('Sub-threshold movement plus long press',h=>{const note=h.G.newNote(72,0,480);h.pattern().notes=[note];h.fire('pointerdown',100,53);h.fire('pointermove',100,55);const drag=h.interaction.getDrag();const thresholdReached=drag.moved;for(const f of h.timers.values())f();h.fire('pointerup',100,55);return {reproduced:h.pattern().notes[0].pitch===71&&h.stats.commits===0,pitchBefore:72,pitchAfter:h.pattern().notes[0].pitch,thresholdReached,historyCommits:h.stats.commits,menuOpened:h.stats.menu};});
record('120 pointer events within same snap cell',h=>{h.fire('pointerdown');const before=h.stats.draws;for(let i=0;i<120;i++)h.fire('pointermove',101+(i%2),42);const draws=h.stats.draws-before;h.fire('pointerup');return {reproduced:draws===120,pointerEvents:120,gridRedrawRequests:draws,noteCount:h.pattern().notes.length,limit:'Counts handler calls only; does not measure browser frame rate'};});
console.log(JSON.stringify({method:'Isolated Node VM runs unmodified source with stubbed DOM, pointer events, timers and callbacks. No browser rendering or audio hardware.',results},null,2));
