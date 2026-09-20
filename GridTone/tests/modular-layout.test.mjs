/** Structural contracts supplement, not replace, rendered geometry acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,root,context} from './runtime.mjs';
const G=runtime(),env=vm.createContext({GridTone:G,document:{querySelector:()=>null},console});
for(const f of ['ui/formatters','ui/music-palette','ui/components','ui/tool-panel','views/edit-bar','views/inspector','views/sound'])vm.runInContext(fs.readFileSync(root+'/src/'+f+'.js','utf8'),env);
test('ML01 panel actions are explicit and survive without DOM parsing',()=>{
 const h=G.ui.PanelFrame({header:'<header>目标</header>',body:'<p>参数</p>',actions:'<button>采用</button>'});
 assert.match(h,/<footer class="tool-panel-actions"/);assert.ok(h.indexOf('参数')<h.indexOf('采用'));
 assert.doesNotMatch(fs.readFileSync(root+'/src/ui/tool-panel.js','utf8'),/createElement|querySelector/);
});
test('ML02 dialog slots keep adopted controls outside the body',()=>{
 const h=G.ui.Dialog({title:'确认',body:{body:'<p>原稿保持</p>',actions:'<button>采用</button>'}});
 assert.match(h,/<\/div><footer class="modal-actions modal-fixed-actions"/);
 assert.doesNotMatch(h,/\[object Object\]/);
});
test('ML03 legacy plain text dialog remains a valid short task',()=>{
 assert.match(G.ui.Dialog({title:'说明',body:'<p>提示</p>'}),/<div class="modal-body"><p>提示<\/p><\/div>/);
});
test('ML04 shared focus controller knows no musical fields or translated menu title',()=>{
 const h=fs.readFileSync(root+'/src/ui/focus.js','utf8');assert.doesNotMatch(h,/transpose-mode|data-time-tab|乐构 · 工作台/);assert.match(h,/body\?\.kind==='menu'/);
});
test('ML05 target commands and clipboard commands have separate containers',()=>{
 const {p}=context(G),S=G.createEditorSession(p),before=JSON.stringify(p),h=G.views.renderEditBar({project:p,S,...G.ui});
 assert.match(h,/data-component="target-module"/);assert.match(h,/aria-label="基础编辑"/);assert.equal(JSON.stringify(p),before);
});
test('ML06 global musical parameters are absent from local inspector fields',()=>{
 const {p,t}=context(G),S=G.createEditorSession(p);S.rightPanel='view';S.inspectorTrackId=t.id;
 const h=G.views.renderInspector({project:p,S,...G.ui});
 assert.doesNotMatch(h,/data-field="key"|data-field="scale"|data-range="project.swing"/);assert.match(h,/全曲调性与律动/);
});
test('ML07 export busy state selects the rendered controls',()=>{
 const h=fs.readFileSync(root+'/src/app.js','utf8');assert.doesNotMatch(h,/export-options button/);assert.match(h,/export-format-rows button/);
});
test('ML08 narrow layouts retain destination and grouped commands',()=>{
 const h=fs.readFileSync(root+'/src/styles/workspace.css','utf8');
 assert.doesNotMatch(h,/\.paste-destination\s*\{\s*display:none/);
 assert.doesNotMatch(h,/arrangement-command-deck[^}]*display:contents/);
 assert.match(h,/@container \(max-width:1100px\)/);
});
test('ML09 sound detail renders its fixed target name outside alternative placement',()=>{
 const h=fs.readFileSync(root+'/src/views/studio-library.js','utf8');assert.ok(h.includes("${isSound?params:''}"));
});
test('ML10 batch geometry follows observed top and bottom frames',()=>{
 const h=fs.readFileSync(root+'/src/app.js','utf8'),css=fs.readFileSync(root+'/src/styles/library.css','utf8');
 assert.match(h,/ResizeObserver\(syncWorkspaceBounds\)/);assert.match(css,/top:var\(--workspace-top/);assert.doesNotMatch(css,/top:78px;bottom:58px/);
});
test('ML11 production gallery uses the same explicit panel frame',()=>{
 const h=fs.readFileSync(root+'/src/ui/component-demo.js','utf8');assert.match(h,/U.PanelFrame\(\{header:U.PanelHeader/);assert.match(h,/U.ActionTray/);assert.match(h,/U.FieldGroup/);
});
