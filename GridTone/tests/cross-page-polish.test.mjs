/** Cross-page presentation contracts; screenshots remain a separate acceptance lane. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,root,context} from './runtime.mjs';
const source=f=>fs.readFileSync(root+'/src/'+f,'utf8');
const G=runtime(),env=vm.createContext({GridTone:G,console});
for(const f of ['ui/formatters','ui/music-palette','ui/components','views/mix'])vm.runInContext(source(f+'.js'),env);
test('CP01 persistent controls share one inset state and exclude disabled controls',()=>{
 const css=source('styles/components.css');
 assert.match(css,/\.btn\[data-variant\]:is\(\[aria-pressed=true\],\.active,\.on\):not\(:disabled\)/);
 assert.match(css,/box-shadow: var\(--active-control-shadow\)/);
 assert.match(css,/\.task-choice:hover:not\(\[aria-pressed=true\]\)/);
});
test('CP02 dialogs only accept the registered size classes and escape headings',()=>{
 for(const kind of ['form','confirm','menu'])assert.match(G.ui.Dialog({title:'<标题>',body:{kind,body:'正文'}}),new RegExp('data-dialog-kind="'+kind+'"'));
 const h=G.ui.Dialog({title:'<标题>',body:{kind:'unknown',body:'正文'}});
 assert.match(h,/data-dialog-kind="standard"/);assert.match(h,/&lt;标题&gt;/);
});
test('CP03 long sidebar commands use an explicit wrapping component',()=>{
 assert.match(source('styles/components.css'),/\.btn\[data-wrap=true\].*white-space:normal/);
 assert.match(source('views/inspector.js'),/data-wrap="true"/);
});
test('CP04 generic dialog grids leave harmonic event geometry intact',()=>{
 const css=source('styles/dialogs.css');
 assert.match(css,/\.form-grid:not\(\.harmony-events \.form-grid\)/);
 assert.match(css,/\.harmony-events \.form-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('CP05 compact list metadata, preview and descriptions own separate cells',()=>{
 const css=source('styles/library.css');
 assert.match(css,/\.is-list \.library-family \{ min-height:76px/);
 assert.match(css,/\.is-list \.library-family-description\s*\{[^}]*grid-row:3/);
});
test('CP06 mixer renders one task header without changing music or session',()=>{
 const {p}=context(G),S=G.createEditorSession(p),B={selectedTrackIds:[],soloIds:[],target:'all'},before=JSON.stringify({p,S,B});
 const h=G.views.renderMix({project:p,S,B,...G.ui,presetName:()=>'<长音色>',trackIcon:()=> 'piano'});
 assert.equal((h.match(/<h2>混音<\/h2>/g)||[]).length,1);
 assert.equal((h.match(/class="vertical-fader"/g)||[]).length,p.tracks.length);
 assert.match(h,/title="&lt;长音色&gt;"/);assert.equal(JSON.stringify({p,S,B}),before);
});
test('CP07 modal focus includes disclosure and multiline controls; empty names have inline errors',()=>{
 assert.match(source('ui/focus.js'),/\.modal textarea:not\(\[disabled\]\),\.modal summary/);
 const app=source('app.js');assert.match(app,/aria-describedby="form-error"/);assert.match(app,/setAttribute\('aria-invalid','true'\)/);
});
test('CP08 mobile tools and library use viewport space with ordered task layers',()=>{
 assert.match(source('styles/tool-panel.css'),/position:fixed;inset:8px;width:auto/);
 const css=source('styles/library.css');assert.match(css,/\.studio-library\{inset:8px;z-index:45\}/);
 assert.match(css,/\.batch-plan-panel\{inset:8px;width:auto;max-width:none;z-index:46\}/);
 assert.doesNotMatch(source('views/studio-library.js'),/host\.style\.(top|bottom)/);
 assert.doesNotMatch(source('app.js'),/lib\.style\.(top|bottom)/);
});
test('CP09 long composer choices span the detail column and checkboxes keep inline semantics',()=>{
 const css=source('styles/tool-panel.css');assert.match(css,/data-field=composer-mode/);assert.match(css,/data-field=composer-rhythm/);assert.match(css,/:not\(\.catalog-check\)/);
});
test('CP10 comparison actions remain together before the primary commit',()=>{
 const css=source('styles/dialogs.css');assert.match(css,/\.modal-actions>\.btn\[data-variant=primary\]\{margin-left:auto\}/);
 assert.match(css,/\.modal-actions:not\(:has\(>\.btn\[data-variant=primary\]\)\)/);
});
