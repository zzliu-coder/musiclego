import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,root,context} from './runtime.mjs';
const G=runtime();
vm.runInNewContext(fs.readFileSync(root+'/src/views/piano-roll.js','utf8'),{GridTone:G});
test('PR01 time ruler uses the same bar geometry, independently of snap grid',()=>{
 const geo={width:1400,left:86,top:28,cw:12.5,offset:0,bars:4};
 const h=G.views.pianoTimeRuler(geo);
 assert.match(h,/data-time-axis="true"/);assert.match(h,/data-time-corner="true"/);
 assert.match(h,/<text x="92"[^>]*>1<\/text>/);
 assert.match(h,/<text x="292"[^>]*>2<\/text>/);
 assert.match(h,/<text x="142"[^>]*>1.2<\/text>/);
 assert.match(h,/height="28"/);
});
test('PR02 dense view hides beat labels and page mode uses actual pattern bar offset',()=>{
 const h=G.views.pianoTimeRuler({width:800,left:100,top:28,cw:5,offset:4*G.BAR,bars:1});
 assert.match(h,/<text x="106"[^>]*>5<\/text>/);assert.doesNotMatch(h,/>5\.2<\/text>/);
 assert.equal((h.match(/<path d="M\d+ (19|23)V28"/g)||[]).length,4);
});
test('PR03 both axes and the corner pin independently through diagonal scrolling',()=>{
 const attrs={},svg={querySelector:s=>({setAttribute:(k,v)=>attrs[s+':'+k]=v})};
 G.views.pinPianoAxes({scrollLeft:320,scrollTop:97},svg);
 assert.deepEqual(attrs,{'#pitch-axis:transform':'translate(320,0)','#time-axis:transform':'translate(0,97)','#time-axis-corner:transform':'translate(320,0)'});
 G.views.pinPianoAxes({scrollLeft:0,scrollTop:0},svg);
 assert.equal(attrs['#time-axis:transform'],'translate(0,0)');
 assert.doesNotThrow(()=>G.views.pinPianoAxes({scrollLeft:0,scrollTop:0},null));
});
test('PR05 scroll binding survives DOM attribute reconciliation without duplicate listeners',()=>{
 let count=0,callback;const attrs={},node={setAttribute:(k,v)=>attrs[k]=v};
 const scroll={scrollLeft:20,scrollTop:30,querySelector:()=>({querySelector:()=>node}),addEventListener:(type,fn)=>{count++;callback=fn;}};
 G.views.bindPianoAxes(scroll);G.views.bindPianoAxes(scroll);assert.equal(count,1);
 scroll.scrollTop=80;callback();assert.equal(attrs.transform,'translate(20,0)');
});
test('PR06 template placements exclude fixed axes including the diagonally scrolled corner',()=>{
 vm.runInNewContext(fs.readFileSync(root+'/src/views/template-shelf.js','utf8'),{GridTone:G});
 const shelf=Object.create(G.TemplateShelf.prototype);
 shelf.c={getSession(){throw Error('ruler must not resolve a placement target');}};
 for(const part of ['time-axis','time-axis-corner','pitch-axis']){
  const target={closest:s=>s==='[data-pitch-axis],[data-time-axis]'?{part}:null};
  assert.equal(shelf.location({target,clientX:400,clientY:90}),null);
 }
 const source=fs.readFileSync(root+'/src/views/template-shelf.js','utf8');
 assert.match(source,/target\.svg\.insertBefore\(g,target\.svg\.querySelector\('#pitch-axis'\)\)/);
 assert.match(source,/if\(!target\)\{this\.clearGhost\(\);this\.ghostKey=null;/);
});
for(const tool of ['draw','erase','range','select','chord','pan'])test('PR04 pinned header seeks without editing notes in '+tool+' mode',()=>{
 const {p,t,pat,target}=context(G),S=G.createEditorSession(p),handlers={};
 G.openPatternInSession(S,p,target);S.tool=tool;S.snap=240;
 const original=JSON.stringify(p),seek=[],frame={focus(){},parentElement:{scrollLeft:300,scrollTop:80}};
 const svg={getBoundingClientRect:()=>({left:-300,top:-80,width:1000,height:600})};
 const doc={querySelector:s=>s==='#note-grid'?svg:null,addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(fs.readFileSync(root+'/src/ui/editor-gestures.js','utf8'),{GridTone:G,document:doc,window:{addEventListener(){}},clearTimeout});
 const ui=G.createEditorInteractions({S,track:()=>t,pattern:()=>pat,getProject:()=>p,interact(){},drawGrid(){},selectionChanged(){},seekPattern:x=>seek.push(x),snapshot(){throw Error('ruler must not begin note editing');},noteMenu(){throw Error('ruler must not open note menu');}});
 ui.setGeometry({width:1000,height:600,left:86,top:28,cw:10,rows:[60],row:24,bars:4,offset:0});
 const targetNode={matches:()=>false,closest:s=>s==='#gridframe'||s.startsWith('#gridframe,')?frame:s==='[data-time-axis]'?{}:null};
 const event={target:targetNode,button:0,pointerId:1,pointerType:'mouse',clientX:300,clientY:10,preventDefault(){}};
 handlers.pointerdown(event);assert.equal(seek.length,1);assert.equal(seek[0],12240);assert.equal(ui.getDrag(),null);
 handlers.contextmenu(event);assert.equal(JSON.stringify(p),original);
 targetNode.closest=s=>s==='#gridframe'||s.startsWith('#gridframe,')?frame:s==='[data-time-axis]'||s==='[data-time-corner]'?{}:null;
 handlers.pointerdown({...event,clientX:15});assert.equal(seek.length,1);assert.equal(JSON.stringify(p),original);
});
