/** Layout contracts use production renderers; browser geometry is verified separately. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,root,context} from './runtime.mjs';
import {studioRuntime} from './studio-runtime.mjs';
const G=runtime();
const env=vm.createContext({GridTone:G,console,document:{querySelector:()=>null},innerHeight:900,innerWidth:1440});
for(const f of ['ui/formatters','ui/music-palette','ui/components','ui/tool-panel','views/edit-bar','views/editor','views/inspector','views/shell'])
 vm.runInContext(fs.readFileSync(root+'/src/'+f+'.js','utf8'),env);
G.keymap={bindings:{},label:()=>''};
function fixture(){
 const {p,t,pat,target}=context(G),S=G.createEditorSession(p);
 G.openPatternInSession(S,p,{...target,edit:true});S.view='arrange';S.editorOpen=true;
 const C={project:p,S,B:{range:null,loop:false,soloIds:[],target:'song'},...G.ui,engine:{playing:false},history:[],future:[],track:()=>t,pattern:()=>pat,presetName:()=> '声音',renderPipeline:()=>'<p>演奏参数</p>',scrollKey:'workspace:arrange',renderArrange:()=>'<div id="timeline-fixture"></div>',renderMix:()=>'<div>混音</div>'};
 C.renderEditor=()=>G.views.renderEditor(C);
 return C;
}
test('LC01 timeline visual and pointer coordinate metrics agree',()=>{
 const css=fs.readFileSync(root+'/src/styles/tokens.css','utf8');
 assert.equal(G.UI_METRICS.trackHead,Number(css.match(/--track-head:\s*(\d+)px/)[1]));
 assert.equal(G.UI_METRICS.trackHead,216);
});
for(const expanded of [false,true])test('LC02 single command host in '+(expanded?'expanded editor':'arrangement'),()=>{
 const C=fixture();C.S.editorExpanded=expanded;const before=JSON.stringify(C.project),h=G.views.renderShell(C);
 assert.equal((h.match(/id="editbar-host"/g)||[]).length,1);
 assert.equal((h.match(/id="edit-command-bar"/g)||[]).length,1);
 assert.equal(JSON.stringify(C.project),before);
 const owner=h.slice(0,h.indexOf('<div class="workspace-body">'));
 assert.ok(owner.includes('id="editbar-host"'));
});
test('LC03 no empty inspector is made visible by layout framing',()=>assert.equal(G.ui.toolPanelLayout(''),''));
test('CW01 arrangement owns structure tools; global rail follows the agreed order',()=>{
 const C=fixture(),h=G.views.renderShell(C),top=h.slice(0,h.indexOf('<div class="workspace-body">'));
 assert.match(h,/compact-workbench/);assert.doesNotMatch(top,/data-component="structure-module"/);
 const order=['class="top-transport','class="global-edit-module','class="top-actions','class="workspace-tabs'];
 for(let i=1;i<order.length;i++)assert.ok(top.indexOf(order[i-1])<top.indexOf(order[i]));
 assert.match(h.slice(h.indexOf('id="arrangement-pane"')),/aria-label="编排结构"/);
 for(const action of ['add-track','new-blank-clip','structure-tools','time-tools'])assert.equal((h.match(new RegExp('data-action="'+action+'"','g'))||[]).length,1);
 assert.equal((h.match(/data-component="structure-module"/g)||[]).length,1);
});
test('CW02 mixer keeps its faders while expanded editors inherit the approved rail',()=>{
 const C=fixture();C.S.view='mix';assert.doesNotMatch(G.views.renderShell(C),/compact-workbench|workbench-structure/);
 C.S.view='arrange';C.S.editorExpanded=true;assert.match(G.views.renderShell(C),/compact-workbench/);
 assert.match(G.views.renderEditor(C),/editor-control-deck/);
 assert.doesNotMatch(G.views.renderEditor(C),/class="dock-header"|class="studio-edit-tools"/);
});
test('CW03 compact editor has one of every control and stable semantic reading order',()=>{
 const C=fixture(),before=JSON.stringify(C.project),h=G.views.renderEditor(C);
 assert.match(h,/data-component="editor-control-deck" role="toolbar" aria-label="画板工具"/);
 assert.ok(h.indexOf('class="dock-identity"')<h.indexOf('class="tool-group'));
 assert.ok(h.indexOf('class="tool-group')<h.indexOf('class="canvas-view-controls"'));
 assert.ok(h.indexOf('class="canvas-view-controls"')<h.indexOf('class="dock-actions"'));
 for(const action of ['open-sound','listen-pattern','zoom-in','zoom-out','fit-notes','close-editor'])assert.equal((h.match(new RegExp('data-action="'+action+'"','g'))||[]).length,1);
 assert.equal(JSON.stringify(C.project),before);
});
test('CW04 moved structure commands retain composer protected scope',()=>{
 const C=fixture();C.S.rightPanel='composer';C.creationMarkup='<p>候选</p>';
 const h=G.views.renderShell(C);
 assert.match(h,/class="global-edit-module" inert/);
 assert.match(h,/class="view-content" inert/);
});
test('CW05 clipboard destination and long names remain represented and escaped',()=>{
 const C=fixture();C.pattern().name='<一段很长的旋律>';C.S.editClipboard={kind:'clips'};
 assert.match(G.views.renderEditor(C),/title="&lt;一段很长的旋律&gt;"/);
 assert.match(G.views.renderEditBar(C),/paste-destination/);
});
test('CW06 wide toolbar and wrapped pairs retain the same reading order',()=>{
 const C=fixture(),h=G.views.renderEditor(C);
 const rows=h.split('class="editor-utility-row"');
 assert.equal(rows.length,2);
 assert.match(rows[0],/class="editor-primary-row"/);
 assert.match(rows[0],/class="tool-group/);
 assert.doesNotMatch(rows[0],/data-action="close-editor"/);
 assert.match(rows[1],/data-action="close-editor"/);
 assert.match(rows[1],/class="canvas-view-controls"/);
 const css=fs.readFileSync(root+'/src/styles/workspace.css','utf8');
 assert.match(css,/@container \(min-width:1400px\)/);
 assert.match(css,/grid-template-columns:var\(--workbench-identity\) max-content minmax\(0,1fr\) max-content/);
});
test('CW11 both local headers share a stable title column without changing musical geometry',()=>{
 const css=fs.readFileSync(root+'/src/styles/workspace.css','utf8'),tokens=fs.readFileSync(root+'/src/styles/tokens.css','utf8');
 assert.match(tokens,/--workbench-identity: var\(--track-head\)/);
 for(const selector of ['arrangement-structure','editor-control-deck'])assert.match(css,new RegExp('\\.compact-workbench \\.'+selector+' \\{[^}]*grid-template-columns:var\\(--workbench-identity\\) minmax\\(0,1fr\\)'));
 assert.match(css,/max-width:720px[\s\S]*editor-control-deck \{ grid-template-columns:minmax\(0,1fr\)/);
 assert.equal(G.UI_METRICS.trackHead,216);
});
test('CW12 compact modes and toggles share inset state while focus and objects stay separate',()=>{
 const css=fs.readFileSync(root+'/src/styles/components.css','utf8');
 assert.match(css,/\.compact-workbench \.btn\[data-variant\]:is\(\[aria-pressed=true\],\.active,\.on\):not\(:disabled\)/);
 assert.match(css,/border-color:transparent;box-shadow:var\(--workbench-active-shadow\)/);
 assert.doesNotMatch(css,/studio-editor \.segmented-control \.btn\[aria-pressed=true\]/);
 assert.match(css,/\.btn:focus-visible \{ outline: 2px solid var\(--focus-color\)/);
 const block=fs.readFileSync(root+'/src/styles/music-block.css','utf8');
 assert.match(block,/\.song-clip.selected \{ outline:\s*2px solid/);
 const h=G.views.renderShell(fixture());assert.match(h,/data-action="loop"[^>]*aria-pressed=/);
});
test('CW07 compact play and stop share a usable size and tempo stays an input',()=>{
 const tokens=fs.readFileSync(root+'/src/styles/tokens.css','utf8');
 const css=fs.readFileSync(root+'/src/styles/components.css','utf8');
 assert.ok(Number(tokens.match(/--transport-compact:\s*(\d+)px/)[1])>=44);
 assert.match(css,/\.top-transport \.btn\[data-action=stop\][^}]+height:var\(--transport-compact\)/);
 assert.match(G.views.renderShell(fixture()),/<input id="bpm" type="number"[^>]+aria-label="速度 BPM"/);
});
test('CW08 precision density preserves touch targets and readable triplet labels',()=>{
 const css=fs.readFileSync(root+'/src/styles/components.css','utf8');
 const layout=fs.readFileSync(root+'/src/styles/workspace.css','utf8');
 assert.match(G.views.renderEditor(fixture()),/data-density="compact"/);
 assert.match(css,/@media\(pointer:coarse\)[\s\S]*editor-control-deck\[data-density=compact\][^}]*min-height:var\(--touch-control\)/);
 assert.match(layout,/select:has\(option:checked:is\(\[value="320"\],\[value="160"\],\[value="80"\]\)\)/);
 assert.match(layout,/select\[data-field=editor-page\] \{ width:104px/);
 assert.match(layout,/topbar>:is\(\.action-tray,\.workspace-tabs,\.global-edit-module\)[^}]*--workbench-top-group/);
});
test('CW09 scope is expandable, no-selection is explicit and basic commands occur once',()=>{
 const C=fixture();
 C.S.editTarget={kind:'notes',trackId:C.track().id,patternId:C.pattern().id,ids:[]};
 C.S.editClipboard={kind:'notes'};
 const h=G.views.renderEditBar(C);
 assert.match(h,/<details class="edit-scope"/);assert.match(h,/音符 · 未选中/);
 assert.match(h,/paste-destination/);
 for(const id of ['copy','cut','paste','duplicate','delete','select-all'])assert.equal((h.match(new RegExp('data-command="'+id+'"','g'))||[]).length,1);
 assert.ok(h.indexOf('edit-scope')<h.indexOf('edit-primary-actions'));
 assert.ok(h.indexOf('edit-primary-actions')<h.indexOf('edit-secondary-actions'));
});
test('CW10 global editing keeps every target kind, clipboard destination and document intact',()=>{
 const C=fixture(),t=C.track(),p=C.pattern(),before=JSON.stringify(C.project);
 const targets=[{kind:'none'},{kind:'track',trackId:t.id},{kind:'clips',trackId:t.id,ids:[t.clips[0].id]},{kind:'notes',trackId:t.id,patternId:p.id,ids:p.notes.slice(0,2).map(n=>n.id)},{kind:'range',trackId:t.id,patternId:p.id,range:{start:0,end:480}}];
 for(const target of targets){
  C.S.editTarget=target;C.S.editClipboard={kind:'notes',trackKind:t.kind};
  const h=G.views.renderShell(C);
  assert.match(h,new RegExp('data-edit-kind="'+target.kind+'"'));
  assert.equal((h.match(/id="edit-command-bar"/g)||[]).length,1);
  assert.match(h,/class="edit-scope-detail"/);
  assert.match(h,/data-command="paste"[^>]+title="[^"]*粘贴 →/);
 }
 assert.equal(JSON.stringify(C.project),before);
 const source=fs.readFileSync(root+'/src/app.js','utf8');
 assert.match(source,/scope\.contains\(e\.target\)/);assert.match(source,/scope\.querySelector\('summary'\)\?\.focus\(\)/);
});
test('LC04 range and note selection are distinguished in visible controls',()=>{
 const h=G.views.renderEditor(fixture());assert.match(h,/选音符/);assert.match(h,/时间选区/);assert.match(h,/包含休止与所有音高/);
});
for(const type of ['properties','sound','pipeline','arrangement','view','edit'])test('LC05 '+type+' inspector preserves the musical document',()=>{
 const C=fixture();C.S.rightPanel=type;C.S.inspectorTrackId=C.track().id;const before=JSON.stringify(C.project);
 const h=G.views.renderInspector(C);assert.ok(h.includes('creation-dock-heading'));assert.ok(h.includes('inspector-close'));assert.equal(JSON.stringify(C.project),before);
});
test('LC06 hidden expanded preference cannot hide commands when editor is closed',()=>{
 const C=fixture();C.S.editorExpanded=true;C.S.editorOpen=false;
 assert.equal((G.views.renderShell(C).match(/id="editbar-host"/g)||[]).length,1);
});
test('LC07 wide chord pane class follows only the composer owner',()=>{
 const C=fixture();C.S.rightPanel='composer';C.creationMarkup='<p>草稿</p>';
 assert.match(G.views.renderShell(C),/creation-dock composer-wide/);
 C.S.rightPanel='creation';assert.doesNotMatch(G.views.renderShell(C),/class="creation-dock composer-wide"/);
});
test('LC08 compact track preview fits the row instead of clipping low notes',()=>{
 const css=fs.readFileSync(root+'/src/styles/music-block.css','utf8');
 assert.match(css,/song-clip \.mini-pattern[^}]*height: 30px/);
});
test('LC09 example works are individually discoverable without changing source identities',()=>{
 const H=studioRuntime(),env=vm.createContext({GridTone:H,console,document:{addEventListener(){}}});
 vm.runInContext(fs.readFileSync(root+'/src/views/studio-library.js','utf8'),env);
 const p=H.blankProject(),items=H.catalogTemplates().filter(x=>x.type==='song'),before=JSON.stringify(items);
 const library=Object.create(H.StudioLibrary.prototype);
 Object.assign(library,{c:{getProject:()=>p},shelf:{all:()=>items,item:id=>items.find(x=>x.id===id)},domain:'music',kind:'example',role:'all',subcategory:'all',browse:'all',query:'',collections:{},legacy:false});
 const rows=library.familyList();
 assert.ok(rows.length>=5);assert.ok(rows.every(f=>f.members.length===1));
 assert.equal(new Set(rows.map(f=>f.defaultId)).size,rows.length);assert.equal(JSON.stringify(items),before);
 for(const item of items)assert.ok(rows.some(f=>f.defaultId===item.id));
});
test('LC10 the global groove control is not presented as a canvas display setting',()=>{
 const C=fixture();C.S.rightPanel='view';assert.doesNotMatch(G.views.renderInspector(C),/data-range="project.swing"/);
 assert.match(fs.readFileSync(root+'/src/app.js','utf8'),/action==='global-groove'/);
});
test('LC11 composer navigation restores focus for narrow detail and return paths',()=>{
 const H={},focused=[];let narrow=true;
 const back={getClientRects:()=>narrow?[{}]:[],focus:()=>focused.push('back')},card={focus:()=>focused.push('card')};
 const env=vm.createContext({GridTone:H,document:{querySelector:s=>s.includes('composer-browse')?back:card}});
 vm.runInContext(fs.readFileSync(root+'/src/views/composer.js','utf8'),env);
 const composer=Object.create(H.ComposerUI.prototype);
 Object.assign(composer,{c:{playback:{endAudition(){}}},render(){},place(){}});
 composer.handleAction('composer-select',{dataset:{id:'example'}});
 assert.equal(composer.detailOpen,true);assert.deepEqual(focused,['back']);
 composer.handleAction('composer-browse',{});
 assert.equal(composer.detailOpen,false);assert.deepEqual(focused,['back','card']);
 narrow=false;composer.handleAction('composer-select',{dataset:{id:'example'}});
 assert.deepEqual(focused,['back','card','card']);
});
