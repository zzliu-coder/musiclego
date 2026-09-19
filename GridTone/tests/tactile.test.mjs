import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime, root} from './runtime.mjs';

function ui() {
  const G = runtime();
  const ctx = vm.createContext({GridTone:G, console});
  for (const file of ['messages.zh-CN', 'formatters', 'music-palette', 'components', 'music-block'])
    vm.runInContext(fs.readFileSync(`${root}/src/ui/${file}.js`, 'utf8'), ctx);
  return G;
}
test('tactile: CSS track heading and timeline fallback share the same geometry', () => {
  const G=ui(), css=fs.readFileSync(`${root}/src/styles/tokens.css`,'utf8');
  assert.equal(Number(css.match(/--track-head:\s*(\d+)px/)[1]),G.UI_METRICS.trackHead);
});
test('tactile: muted and solo controls explicitly use the shared keycap component', () => {
  const G=ui(), t=G.recipeProject('recipe.pop').tracks[0];
  for(const selected of [false,true]) {
    const html=G.ui.TrackHeader({track:{...t,mute:selected},solo:selected});
    assert.match(html,/data-variant="secondary"[^>]*data-action="mute"/);
    assert.match(html,/data-variant="secondary"[^>]*data-action="solo"/);
    assert.ok(html.includes(`aria-pressed="${selected}"`));
  }
});
test('tactile: palette and preview rendering preserve every source note and track color', () => {
  const G=ui();
  for(const recipe of G.RECIPES) {
    const p=G.recipeProject(recipe.id), before=JSON.stringify(p);
    for(const t of p.tracks) G.ui.musicStyle(t.color,t.role);
    const model=G.ui.musicBlock.model({type:'song',name:p.title,project:p});
    const drawing=G.ui.musicBlock.drawing(model,300,100);
    assert.match(drawing,/<svg/);
    assert.doesNotMatch(drawing,/data-note=|data-resize=|data-clip=/);
    assert.equal(JSON.stringify(p),before);
  }
});
test('tactile: musical hit targets remain immediate and motion reduction remains available', () => {
  const css=fs.readFileSync(`${root}/src/styles/workspace.css`,'utf8');
  assert.match(css,/\.note-handle[^\n]+transition: none; animation: none/);
  assert.match(css,/\.note\.is-moving \.note-body \{ filter: none/);
  assert.match(fs.readFileSync(`${root}/src/styles/tokens.css`,'utf8'),/prefers-reduced-motion:reduce/);
});
test('tactile: library detail preview uses selected data, no separate decorative score', () => {
  const js=fs.readFileSync(`${root}/src/views/studio-library.js`,'utf8');
  assert.match(js,/musicBlock\.drawing\(G\.ui\.musicBlock\.model\(item,\{key:p\.key\}\),300,100\)/);
  assert.match(js,/isSound\?'':`<figure/);
});
test('tactile: numeric fields and quiet actions do not inherit keycap surfaces', () => {
  const css=fs.readFileSync(`${root}/src/styles/components.css`,'utf8');
  const fields=css.split('\n').find(line=>line.startsWith('input[type=text],'));
  assert.match(fields,/border-radius: 0; border: 0; border-bottom: 1px/);
  assert.match(fields,/box-shadow: none/);
  assert.match(css,/input\[type=number\] \{ cursor: text; font-variant-numeric: tabular-nums/);
  assert.match(css,/\.btn\[data-variant=quiet\]:disabled \{ background: transparent; border-color: transparent/);
  assert.match(css,/:focus-visible \{ outline: 2px solid var\(--focus-color\)/);
  const editor=fs.readFileSync(`${root}/src/views/editor.js`,'utf8');
  assert.match(editor,/tool-group segmented-control" role="group" aria-label="编辑工具"/);
  assert.doesNotMatch(editor,/soft-btn|secondary/);
});
