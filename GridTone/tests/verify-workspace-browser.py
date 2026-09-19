"""Production 1.8 UI journey. Uses real pointer/keyboard; fixture setup uses public app API.
Inline mode is explicitly not origin-persistence or native Safari evidence.
"""
import argparse, hashlib, json, os, time, traceback, wave
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--browser',default=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'));args=ap.parse_args()
O=R/os.environ.get('WORKSPACE_EVIDENCE_DIR','docs/workspace-1.8/evidence/browser');O.mkdir(parents=True,exist_ok=True);(O/'screens').mkdir(exist_ok=True);(O/'downloads').mkdir(exist_ok=True)
html=(R/'dist/index.html').read_text();checks=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def run(name,fn):
  c=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=c.new_page();p.set_default_timeout(7000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));start=time.time()
  try:
   if args.url:p.goto(args.url)
   else:p.set_content(html,wait_until='load')
   p.wait_for_function('!!window.GridToneApp');p.wait_for_timeout(180)
   result=fn(p);assert not errors,errors;checks.append({'id':name,'status':'PASS','seconds':round(time.time()-start,3),'detail':result});print('PASS',name,flush=True)
  except Exception as e:
   checks.append({'id':name,'status':'FAIL','error':str(e),'pageErrors':errors,'trace':traceback.format_exc()});print('FAIL',name,str(e),flush=True)
  finally:
   p.screenshot(path=str(O/'screens'/f'{name}.png'));c.close()
 def ev(p,s,arg=None):return p.evaluate(s,arg)
 def act(p,a,extra=''):
  scope=p.locator('.modal') if p.locator('.modal').count() else p
  scope.locator(f'button[data-action="{a}"]'+extra).filter(visible=True).first.click()
 def cmd(p,k):p.locator(f'#edit-command-bar [data-command="{k}"]').click()
 def fixture(p,bars=4,notes=True,open=True):
  return ev(p,'''({bars,notes,open})=>{const A=GridToneApp,G=GridTone;A.playback.stop();A.creation.close();A.composer.reset();A.shelf.cancel();A.materials.c.closeModal();let d=G.recipeProject('recipe.pop');d.id=A.getProject().id;d.bars=Math.max(8,bars);const t=d.tracks.at(-1),pat=t.patterns[0];pat.bars=bars;pat.notes=notes?[G.newNote(60,0,960,.7),G.newNote(64,1920,480,.6),G.newNote(67,5760,960,.7)]:[];const out=A.materials.c.commit({project:d,trackId:t.id,patternId:pat.id,clipId:t.clips[0].id});if(out?.ok===false)throw Error(out.error.message);const s=A.materials.c.getSession();s.view='arrange';s.rightPanel=null;s.editorOpen=false;s.editorManuallyClosed=false;s.editorExpanded=false;s.snap=240;s.continuous=true;s.tool='draw';s.editClipboard=null;s.cursor=0;s.selected=[];s.clipIds=[];s.editTarget={kind:'none'};s.arrangeCursor={trackId:t.id,tick:0};s.scrolls={};A.shelf.collapsed=false;A.render();if(open)A.openPattern({trackId:t.id,clipId:t.clips[0].id,edit:true,activation:'notes'});return {trackId:t.id,patternId:pat.id,clipId:t.clips[0].id,noteIds:pat.notes.map(n=>n.id),sourceTrackId:d.tracks[0].id,sourceClipId:d.tracks[0].clips[0].id}}''',{'bars':bars,'notes':notes,'open':open})
 def ns(p,tid=None):return ev(p,'''tid=>{const A=GridToneApp,s=A.getState(),t=A.getProject().tracks.find(t=>t.id===(tid||s.trackId));return t.patterns.find(p=>p.id===s.patternId)?.notes||t.patterns[0].notes}''',tid)
 def note(p,id):p.locator(f'#note-layer [data-note="{id}"] .note-body').scroll_into_view_if_needed();p.locator(f'#note-layer [data-note="{id}"] .note-body').click()
 def gridpoint(p,tick,pitch=60):
  p.locator('#gridframe').scroll_into_view_if_needed()
  xy=ev(p,'''({tick,pitch})=>{const A=GridToneApp,G=GridTone,s=A.materials.c.getSession(),d=A.getProject(),t=d.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),svg=document.querySelector('#note-grid'),r=svg.getBoundingClientRect(),rows=G.visiblePitches(d,s,t,pat),win=G.gridWindow(s,pat);return {x:r.x+Number(svg.dataset.left)+(tick-win.offset)/240*Number(svg.dataset.cellWidth)+3,y:r.y+28+(rows.indexOf(pitch)+.5)*Number(svg.dataset.rowHeight)}}''',{'tick':tick,'pitch':pitch})
  p.evaluate('''({x,y})=>{const sc=document.querySelector('.grid-scroll'),r=sc.getBoundingClientRect();if(y>r.bottom-35)sc.scrollTop+=y-(r.bottom-35);if(y<r.top+35)sc.scrollTop-=r.top+35-y;}''',xy)
  xy=ev(p,'''({tick,pitch})=>{const A=GridToneApp,G=GridTone,s=A.materials.c.getSession(),d=A.getProject(),t=d.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),svg=document.querySelector('#note-grid'),r=svg.getBoundingClientRect(),rows=G.visiblePitches(d,s,t,pat),win=G.gridWindow(s,pat);return {x:r.x+Number(svg.dataset.left)+(tick-win.offset)/240*Number(svg.dataset.cellWidth)+3,y:r.y+28+(rows.indexOf(pitch)+.5)*Number(svg.dataset.rowHeight)}}''',{'tick':tick,'pitch':pitch})
  return xy
 def setcursor(p,tick):ev(p,'tick=>{GridToneApp.materials.c.getSession().cursor=tick;GridToneApp.render()}',tick)
 def choose_source(p):
  field=p.locator('[data-field="creation-sourceTrackId"]');
  if field.count() and not field.input_value():field.select_option(index=1)
 def gen(p):
  act(p,'edit-tools');act(p,'creation',':not([data-mode])');choose_source(p);act(p,'creation-generate');p.wait_for_timeout(80)
 def initial(p):
  assert p.locator('.workspace-tabs button').count()==2
  assert p.locator('[data-view="edit"]').count()==0
  assert p.locator('#note-grid').count()==0
  assert p.locator('#edit-command-bar [data-command="delete"]').is_disabled()
  return {'version':ev(p,'GridToneApp.version')}
 run('UI01-single-home-no-duplicate-view',initial)
 def click_delete(p):
  f=fixture(p,open=False);before=ev(p,'GridToneApp.getProject()');p.locator(f'[data-clip="{f["clipId"]}"]').click();assert p.locator('#note-grid').count()==1;assert ev(p,'GridToneApp.getState().editTarget.kind')=='clips';cmd(p,'delete');d=ev(p,'GridToneApp.getProject()');t=next(t for t in d['tracks']if t['id']==f['trackId']);assert len(t['clips'])==0 and len(t['patterns'][0]['notes'])==3;act(p,'undo');assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).clips.length',f['trackId'])==1
 run('UI02-block-selection-deletes-occurrence-only',click_delete)
 def delete_notes(p):
  f=fixture(p);note(p,f['noteIds'][0]);assert ev(p,'GridToneApp.getState().editTarget.kind')=='notes';cmd(p,'delete');assert len(ns(p))==2;assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.length')==1;assert p.locator('#edit-command-bar [data-command="delete"]').is_disabled();act(p,'undo');assert len(ns(p))==3
 run('UI03-toolbar-target-survives-button-focus',delete_notes)
 def clipboard(p):
  f=fixture(p);note(p,f['noteIds'][0]);setcursor(p,7200);cmd(p,'copy');assert ev(p,'GridToneApp.getState().cursor')==7200;cmd(p,'paste');assert any(n['start']==7200 for n in ns(p));act(p,'undo');assert len(ns(p))==3
 run('UI04-copy-keeps-cursor-and-paste-literal',clipboard)
 def moving_playhead(p):
  f=fixture(p);note(p,f['noteIds'][0]);cmd(p,'copy');setcursor(p,8640);act(p,'play');p.wait_for_timeout(200);ev(p,'GridToneApp.playback.seek(2400)');cmd(p,'paste');assert any(n['start']==8640 for n in ns(p));act(p,'stop')
 run('UI05-playing-does-not-move-paste-destination',moving_playhead)
 def multiple(p):
  f=fixture(p);note(p,f['noteIds'][0]);p.keyboard.down('Shift');note(p,f['noteIds'][1]);p.keyboard.up('Shift');assert ev(p,'GridToneApp.getState().editTarget.ids.length')==2;cmd(p,'copy');setcursor(p,8000);cmd(p,'paste');added=[n for n in ns(p)if n['start']>=8000];assert [n['start']for n in added]==[8000,9920]
 run('UI06-noncontiguous-notes-shared-command',multiple)
 def track(p):
  f=fixture(p);opened=ev(p,'GridToneApp.getState().patternId');p.locator(f'.arrange-track-name[data-id="{f["sourceTrackId"]}"]').click();assert ev(p,'GridToneApp.getState().patternId')==opened;assert ev(p,'GridToneApp.getState().editTarget.kind')=='track';field=p.locator('[data-field="inspector-name"]');field.fill('伴奏轨');field.press('Tab');assert ev(p,'GridToneApp.getProject().tracks[0].name')=='伴奏轨';assert ns(p)==ev(p,'GridToneApp.getProject().tracks.at(-1).patterns[0].notes')
 run('UI07-track-selection-does-not-hijack-open-phrase',track)
 def text(p):
  f=fixture(p);note(p,f['noteIds'][0]);n=len(ns(p));field=p.locator('[data-field="shelf-search"]');field.fill('旋律');field.press('Control+a');field.press('Backspace');assert len(ns(p))==n;assert field.input_value()=='';cmd(p,'delete');assert len(ns(p))==n-1
 run('UI08-text-edit-isolated-from-musical-delete',text)
 def blockdup(p):
  f=fixture(p,open=False);p.locator(f'[data-clip="{f["clipId"]}"]').click();cmd(p,'duplicate');d=ev(p,'GridToneApp.getProject().tracks.at(-1)');assert len(d['clips'])==2 and d['clips'][0]['patternId']!=d['clips'][1]['patternId'];act(p,'edit-tools');assert p.locator('[data-command="unlink"]').is_disabled();act(p,'undo');assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.length')==1
 run('UI09-block-duplicate-independent-undo',blockdup)
 def linked(p):
  f=fixture(p,open=False);p.locator(f'[data-clip="{f["clipId"]}"]').click();act(p,'edit-tools');p.locator('#creation-dock [data-command="linked"]').click();d=ev(p,'GridToneApp.getProject().tracks.at(-1)');assert d['clips'][0]['patternId']==d['clips'][1]['patternId'];p.locator('#creation-dock [data-command="unlink"]').click();d=ev(p,'GridToneApp.getProject().tracks.at(-1)');assert d['clips'][0]['patternId']!=d['clips'][1]['patternId']
 run('UI10-explicit-associated-repeat-and-unlink',linked)
 def collapse(p):
  f=fixture(p);act(p,'close-editor');p.locator(f'[data-clip="{f["clipId"]}"]').click();assert p.locator('#note-grid').count()==0;p.locator(f'[data-clip="{f["clipId"]}"]').dblclick();assert p.locator('#note-grid').count()==1;assert ev(p,'GridToneApp.getState().view')=='arrange'
 run('UI11-respect-manual-collapse-and-reopen',collapse)
 def expand(p):
  f=fixture(p);before=ev(p,'JSON.stringify(GridToneApp.getProject())');h=ev(p,'GridToneApp.getHistory().undo');act(p,'expand-editor');assert not p.locator('#arrangement-pane').is_visible();assert p.locator('#note-grid').is_visible();act(p,'expand-editor');assert p.locator('#arrangement-pane').is_visible();assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before;assert ev(p,'GridToneApp.getHistory().undo')==h
 run('UI12-expand-is-layout-only',expand)
 def mixed(p):
  f=fixture(p);note(p,f['noteIds'][0]);act(p,'canvas-settings');ev(p,'document.querySelector(".view-content").scrollTop=200');before=ev(p,'JSON.stringify(GridToneApp.getProject())');act(p,'play');pos=ev(p,'GridToneApp.playback.position()');act(p,'view','[data-view="mix"]');assert p.locator('#edit-command-bar').count()==0;assert ev(p,'GridToneApp.engine.playing');act(p,'view','[data-view="arrange"]');assert ev(p,'GridToneApp.getState().rightPanel')=='view';assert ev(p,'GridToneApp.getState().editTarget.kind')=='notes';assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before;act(p,'stop')
 run('UI13-mix-roundtrip-keeps-layout-target-audio',mixed)
 def sound(p):
  f=fixture(p);p.locator(f'.arrange-track-name[data-id="{f["sourceTrackId"]}"]').click();p.locator('[data-action="inspector-tab"][data-panel="sound"]').click();assert p.locator('#note-grid').is_visible();key=p.locator('[data-action="audition-key"]').first;box=key.bounding_box();assert box['width']>15 and box['height']>50;key.click();p.wait_for_timeout(100);assert ev(p,'GridToneApp.engine.previewGraphs.size')>0
  p.locator('#creation-dock [data-action="preset"][data-id="prism.reed"]').click();assert ev(p,'GridToneApp.getProject().tracks[0].preset')=='prism.reed';assert ev(p,'GridToneApp.getProject().tracks.at(-1).preset')!='prism.reed';act(p,'stop');return box
 run('UI14-track-sound-side-by-side-and-real-key',sound)
 def drawing(p):
  f=fixture(p,notes=False);before=ev(p,'GridToneApp.getHistory().undo');xy=gridpoint(p,240,60);p.mouse.move(xy['x'],xy['y']);p.mouse.down();p.mouse.move(xy['x']+60,xy['y'],steps=8);p.mouse.up();assert len(ns(p))==1;assert ns(p)[0]['duration']>240;assert ev(p,'GridToneApp.getHistory().undo')==before+1;act(p,'undo');assert len(ns(p))==0
 run('UI15-pencil-drag-one-transaction',drawing)
 def range_draw(p):
  f=fixture(p);p.locator('[data-tool="range"]').click();a=gridpoint(p,960,60);z=gridpoint(p,3840,60);p.mouse.move(a['x'],a['y']);p.mouse.down();p.mouse.move(z['x'],z['y'],steps=8);p.mouse.up();assert ev(p,'GridToneApp.getState().editTarget.kind')=='range';cmd(p,'copy');clip=ev(p,'GridToneApp.getState().editClipboard');assert clip['kind']=='range' and clip['span']>2000;cmd(p,'delete');assert ev(p,'GridToneApp.getState().editTarget.kind')=='range';act(p,'undo');assert len(ns(p))==3
 run('UI16-time-range-includes-rests-and-undo',range_draw)
 def clipboard_drums(p):
  f=fixture(p);note(p,f['noteIds'][0]);cmd(p,'copy');did=ev(p,'GridToneApp.getProject().tracks.find(t=>t.kind==="drum").clips[0].id');p.locator(f'[data-clip="{did}"]').click();p.locator('#gridframe').focus();assert p.locator('#edit-command-bar [data-command="paste"]').is_disabled()
 run('UI17-incompatible-note-clipboard-explicit',clipboard_drums)
 def shelf_place(p):
  f=fixture(p,open=False);p.locator('[data-action="shelf-filter"][data-filter="melody"]').click();card=p.locator('.shelf-card').first;card.locator('[data-action="shelf-pick"]').click();p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click();p.wait_for_timeout(100);assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.length')==2;assert ev(p,'GridToneApp.getState().view')=='arrange';assert ev(p,'GridToneApp.getState().editorOpen')==False
 run('UI18-shelf-click-placement-does-not-navigate',shelf_place)
 def generation(p):
  f=fixture(p);note(p,f['noteIds'][0]);gen(p);assert ev(p,'GridToneApp.creation.session.candidates.length')>=1;act(p,'creation-preview');p.wait_for_timeout(120);assert ev(p,'!!GridToneApp.playback.auditionProject');act(p,'stop');act(p,'creation-apply');assert len(ns(p))>0;act(p,'undo');assert len(ns(p))==3
 run('UI19-local-generation-apply-and-undo',generation)
 def drafts(p):
  f=fixture(p);note(p,f['noteIds'][0]);gen(p);old=ev(p,'GridToneApp.creation.session.candidates[0].candidateId');act(p,'open-sound');assert ev(p,'GridToneApp.getState().rightPanel')=='sound';assert ev(p,'GridToneApp.creation.session.candidates[0].candidateId')==old;act(p,'edit-tools');act(p,'creation',':not([data-mode])');assert ev(p,'GridToneApp.creation.session.candidates[0].candidateId')==old
 run('UI20-tool-panel-switch-keeps-generation-draft',drafts)
 def stale(p):
  f=fixture(p);note(p,f['noteIds'][0]);gen(p);act(p,'canvas-settings');p.locator('[data-field="key"]').select_option('6');act(p,'edit-tools');act(p,'creation',':not([data-mode])');# chord-only generation intentionally not dependent on reference label
  assert ev(p,'GridToneApp.creation.session.candidates.length')>=1
  ev(p,'''()=>{const A=GridToneApp,d=A.getProject(),t=d.tracks.find(t=>t.id===A.creation.session.target.trackId);t.patterns[0].notes[0].pitch++;A.materials.c.commit({project:d,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id})}''')
  assert ev(p,'GridToneApp.creation.session.candidates.length')==0;assert p.locator('[data-action="creation-apply"]').count()==0
 run('UI21-candidate-target-change-invalidates',stale)
 def text_target(p):
  f=fixture(p);note(p,f['noteIds'][0]);p.locator('#gridframe').focus();p.keyboard.press('Control+a');assert ev(p,'GridToneApp.getState().editTarget.ids.length')==3;p.locator('[data-field="shelf-search"]').fill('和弦');cmd(p,'copy');assert len(ev(p,'GridToneApp.getState().editClipboard.notes'))==3
 run('UI22-command-bar-does-not-steal-selection',text_target)
 def track_delete(p):
  f=fixture(p);p.locator(f'.arrange-track-name[data-id="{f["sourceTrackId"]}"]').click();cmd(p,'delete');assert p.locator('.modal').is_visible();act(p,'close-modal');assert ev(p,'GridToneApp.getProject().tracks.length')==5;cmd(p,'delete');act(p,'confirm');assert ev(p,'GridToneApp.getProject().tracks.length')==4;assert ev(p,'GridToneApp.getState().patternId')==f['patternId'];act(p,'undo');assert ev(p,'GridToneApp.getProject().tracks.length')==5
 run('UI23-track-deletion-confirmed-and-undoable',track_delete)
 def clear(p):
  f=fixture(p);note(p,f['noteIds'][0]);act(p,'edit-tools');p.locator('#creation-dock [data-command="clear"]').click();assert p.locator('.modal').is_visible();act(p,'confirm');assert len(ns(p))==0;assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.length')==1;act(p,'undo');assert len(ns(p))==3
 run('UI24-clear-content-distinct-from-remove-block',clear)
 def duration(p):
  f=fixture(p);note(p,f['noteIds'][0]);act(p,'edit-tools');p.locator('[data-duration="half"]').click();assert next(n for n in ns(p)if n['id']==f['noteIds'][0])['duration']==480;assert next(n for n in ns(p)if n['id']==f['noteIds'][1])['duration']==480;act(p,'undo');assert next(n for n in ns(p)if n['id']==f['noteIds'][0])['duration']==960
 run('UI25-transform-tools-respect-selected-notes',duration)
 def clip_multi(p):
  f=fixture(p,open=False);p.locator(f'[data-clip="{f["clipId"]}"]').click();p.keyboard.down('Shift');p.locator(f'[data-clip="{f["sourceClipId"]}"]').click();p.keyboard.up('Shift');assert ev(p,'GridToneApp.getState().editTarget.ids.length')==2;assert '2 个音乐块' in p.locator('#edit-command-bar').inner_text();cmd(p,'delete');assert ev(p,'GridToneApp.getProject().tracks[0].clips.length')==0;assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.length')==0;act(p,'undo')
 run('UI26-multi-block-delete-single-command',clip_multi)
 def blank(p):
  f=fixture(p,open=False);el=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="5"]');el.dblclick();assert ev(p,'GridToneApp.getState().editorOpen');assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.at(-1).bar')==5;assert len(ns(p))==0;assert ev(p,'GridToneApp.getState().view')=='arrange'
 run('UI27-empty-bar-double-click-create',blank)
 def context(p):
  f=fixture(p);loc=p.locator(f'#note-layer [data-note="{f["noteIds"][0]}"] .note-body');loc.scroll_into_view_if_needed();loc.click(button='right');assert p.locator('.modal [data-command="copy"]').count()==1;act(p,'context-edit','[data-command="copy"]');assert ev(p,'GridToneApp.getState().editClipboard.kind')=='notes';assert not p.locator('.modal').count()
 run('UI28-context-menu-uses-common-command',context)
 def export(p):
  fixture(p);expected=ev(p,'Array.from(GridTone.encodeMidi(GridToneApp.getProject()))');act(p,'export')
  with p.expect_download() as info:act(p,'export-midi')
  out=O/'downloads'/'workspace.mid';info.value.save_as(out);assert list(out.read_bytes())==expected
  with p.expect_download() as info:act(p,'export-project')
  out=O/'downloads'/'workspace.gridtone';info.value.save_as(out);data=json.loads(out.read_text());ev(p,'d=>GridTone.validateProject(d)',data)
  with p.expect_download(timeout=60000) as info:act(p,'export-wav')
  out=O/'downloads'/'workspace.wav';info.value.save_as(out)
  with wave.open(str(out)) as w:assert w.getframerate()==44100 and w.getnchannels()==2
  return {'projectBytes':len(json.dumps(data)),'wavBytes':out.stat().st_size}
 run('UI29-real-project-MIDI-WAV-downloads',export)
 def panels(p):
  f=fixture(p);note(p,f['noteIds'][0]);act(p,'edit-tools');act(p,'composer');assert p.locator('#composer-feedback').count()==1;act(p,'composer-preview');p.wait_for_timeout(80);assert ev(p,'!!GridToneApp.playback.auditionProject');act(p,'inspector-tab','[data-panel="sound"]') if p.locator('[data-action="inspector-tab"]').count() else act(p,'open-sound');act(p,'edit-tools');act(p,'composer');assert ev(p,'GridToneApp.getState().rightPanel')=='composer';assert p.locator('#note-grid').is_visible()
 run('UI30-composer-shares-right-slot-not-canvas',panels)
 def layout(p):
  f=fixture(p);results=[]
  for w,h in [(1440,900),(1280,720),(1152,600)]:
   p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(130)
   for panel in [False,True]:
    if panel:act(p,'canvas-settings')
    elif p.locator('[data-action="inspector-close"]').is_visible():act(p,'inspector-close')
    p.locator('.view-content').hover(position={'x':4,'y':30});p.mouse.wheel(0,1800);p.wait_for_timeout(200)
    r=ev(p,'''()=>{const v=document.querySelector('.view-content'),footer=document.querySelector('.playback-footer').getBoundingClientRect(),bar=document.querySelector('.topbar').getBoundingClientRect();return {scrollable:v.scrollHeight>v.clientHeight,scroll:v.scrollTop,top:bar.y,footer:footer.bottom,viewport:innerHeight,width:document.documentElement.scrollWidth,screen:innerWidth}}''');assert 0<=r['top']<=12 and 0<=h-r['footer']<=12;assert r['width']<=w;assert r['scroll']>0 or not r['scrollable'];results.append({'w':w,'h':h,'panel':panel,**r})
  return results
 run('UI31-short-desktop-layout-and-scroll',layout)
 def skins(p):
  f=fixture(p);before=ev(p,'JSON.stringify(GridToneApp.getProject())');act(p,'appearance');act(p,'choose-skin','[data-skin="pearl"]');act(p,'close-modal');assert ev(p,'document.documentElement.dataset.skin')=='pearl';assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before
  p.screenshot(path=str(O/'screens'/'pearl-final.png'));act(p,'view','[data-view="mix"]');p.screenshot(path=str(O/'screens'/'pearl-mix.png'))
 run('UI32-skin-change-keeps-music',skins)
 def pipeline(p):
  f=fixture(p);note(p,f['noteIds'][0]);act(p,'open-sound');p.locator('[data-panel="pipeline"]').click();assert p.locator('#note-grid').is_visible();p.locator('[data-field="arp"]').select_option('up');assert ev(p,'GridToneApp.getProject().tracks.at(-1).pipeline.arp')=='up';act(p,'bake-pipeline');act(p,'confirm');assert ev(p,'GridToneApp.getProject().tracks.at(-1).pipeline.arp')=='off';act(p,'undo');assert ev(p,'GridToneApp.getProject().tracks.at(-1).pipeline.arp')=='up'
 run('UI33-performance-processing-in-inspector',pipeline)
 def resize(p):
  fixture(p);d=p.locator('.dock-resize');d.scroll_into_view_if_needed();box=d.bounding_box();before=ev(p,'GridToneApp.getState().editorHeight');hist=ev(p,'GridToneApp.getHistory().undo');p.mouse.move(box['x']+box['width']/2,box['y']+8);p.mouse.down();p.mouse.move(box['x']+box['width']/2,box['y']-50,steps=6);p.mouse.up();assert ev(p,'GridToneApp.getState().editorHeight')>before;assert ev(p,'GridToneApp.getHistory().undo')==hist
 run('UI34-divider-one-height-no-music-history',resize)
 def cancel_drag(p):
  f=fixture(p,open=False);before=ev(p,'JSON.stringify(GridToneApp.getProject())');el=p.locator(f'[data-clip="{f["clipId"]}"]');box=el.bounding_box();p.mouse.move(box['x']+15,box['y']+15);p.mouse.down();p.mouse.move(box['x']+170,box['y']+15,steps=8);p.keyboard.press('Escape');p.mouse.up();assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before;assert p.locator('.clip-target').count()==0
 run('UI35-cancel-block-drag-restores-original',cancel_drag)

 def return_draft(p):
  f=fixture(p);note(p,f['noteIds'][0]);gen(p);cid=ev(p,'GridToneApp.creation.session.candidates[0].candidateId');before=ev(p,'JSON.stringify(GridToneApp.getProject())');hist=ev(p,'GridToneApp.getHistory().undo')
  p.locator(f'[data-clip="{f["sourceClipId"]}"]').click();assert p.locator('[data-action="creation-apply"]').is_disabled();act(p,'creation-return');assert ev(p,'GridToneApp.getState().clipId')==f['clipId'];assert ev(p,'GridToneApp.creation.session.candidates[0].candidateId')==cid;assert not p.locator('[data-action="creation-apply"]').is_disabled();assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before;assert ev(p,'GridToneApp.getHistory().undo')==hist
 run('UI36-generator-fixed-target-and-return',return_draft)
 def chord_return(p):
  f=fixture(p);act(p,'edit-tools');act(p,'composer');act(p,'composer-preview');before=ev(p,'JSON.stringify(GridToneApp.getProject())');p.locator(f'[data-clip="{f["sourceClipId"]}"]').click();assert p.locator('[data-action="composer-apply"]').is_disabled();act(p,'return-draft-target','[data-panel="composer"]');assert not p.locator('[data-action="composer-apply"]').is_disabled();assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before
 run('UI37-composer-target-return-is-explicit',chord_return)
 def panel_scroll(p):
  f=fixture(p);act(p,'open-sound');ev(p,'document.querySelector("#creation-dock").scrollTop=800');old=ev(p,'document.querySelector("#creation-dock").scrollTop');assert old>100
  p.locator('[data-action="inspector-tab"][data-panel="properties"]').click();assert ev(p,'document.querySelector("#creation-dock").scrollTop')<150
  p.locator('[data-action="inspector-tab"][data-panel="sound"]').click();assert abs(ev(p,'document.querySelector("#creation-dock").scrollTop')-old)<2
 run('UI38-per-tool-scroll-isolation',panel_scroll)
 def empty_selection(p):
  f=fixture(p);before=ev(p,'JSON.stringify(GridToneApp.getProject())');p.locator('#gridframe').focus();p.keyboard.press('Escape');p.keyboard.press('Delete');assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before;assert p.locator('#edit-command-bar [data-command="delete"]').is_disabled()
 run('UI39-empty-notes-never-delete-the-block',empty_selection)
 def literal_reject(p):
  f=fixture(p);note(p,f['noteIds'][0]);cmd(p,'copy');setcursor(p,15000);before=ev(p,'JSON.stringify(GridToneApp.getProject())');hist=ev(p,'GridToneApp.getHistory().undo');cmd(p,'paste');assert ev(p,'JSON.stringify(GridToneApp.getProject())')==before;assert ev(p,'GridToneApp.getHistory().undo')==hist;assert '超出' in p.locator('#toast').inner_text()
 run('UI40-paste-does-not-silently-clamp',literal_reject)
 def precision_resize(p):
  f=fixture(p);ev(p,'''()=>{const A=GridToneApp,d=A.getProject(),t=d.tracks.at(-1);t.patterns[0].notes[0].duration=120;A.materials.c.commit({project:d,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});}''');body=p.locator(f'#note-layer [data-note="{f["noteIds"][0]}"] .note-body');body.scroll_into_view_if_needed();box=body.bounding_box();p.mouse.move(box['x']+box['width']-1,box['y']+6);p.mouse.down();p.mouse.move(box['x']+box['width']-1,box['y']+12,steps=2);p.mouse.up();assert next(n for n in ns(p)if n['id']==f['noteIds'][0])['duration']==120
 run('UI41-short-note-resize-preserves-time-until-horizontal-change',precision_resize)
 def selected_range_keeps(p):
  f=fixture(p);ev(p,'''()=>{const A=GridToneApp,s=A.getState();A.activateTarget({kind:'range',trackId:s.trackId,patternId:s.patternId,clipId:s.clipId,range:{start:0,end:3840}})}''');cmd(p,'copy');clip=ev(p,'GridToneApp.getState().editClipboard');assert clip['span']==3840
  setcursor(p,7680);ev(p,'''()=>{const A=GridToneApp,s=A.getState();A.activateTarget({kind:'notes',trackId:s.trackId,patternId:s.patternId,clipId:s.clipId,ids:[]})}''');cmd(p,'paste');assert sorted(n['start']for n in ns(p)if n['start']>=7680)==[7680,9600]
 run('UI42-range-clipboard-preserves-rests',selected_range_keeps)
 def draft_resume(p):
  f=fixture(p);note(p,f['noteIds'][0]);gen(p);cid=ev(p,'GridToneApp.creation.session.candidates[0].candidateId');act(p,'open-sound');assert p.locator('[data-action="resume-tool"][data-panel="creation"]').count()==1;act(p,'resume-tool','[data-panel="creation"]');assert ev(p,'GridToneApp.creation.session.candidates[0].candidateId')==cid
 run('UI43-inactive-draft-discoverable-in-tool-slot',draft_resume)
 def component_gallery(p):
  p.set_content((R/'components.html').read_text());assert p.locator('[id^="example-command-"]').count()==5
  p.locator('button[data-gallery-skin="pearl"]').click();assert ev(p,'document.documentElement.dataset.skin')=='pearl'
  p.locator('.components-page').hover();p.mouse.wheel(0,1600);p.wait_for_timeout(180);assert ev(p,'document.querySelector(".components-page").scrollTop')>0
  assert p.locator('[data-variant="danger"][disabled]').count()>0
 run('UI44-production-components-and-skin-gallery',component_gallery)
 def quantize(p):
  f=fixture(p);ev(p,'''()=>{const A=GridToneApp,d=A.getProject(),t=d.tracks.at(-1);t.patterns[0].notes[0].start=130;A.materials.c.commit({project:d,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});}''');note(p,f['noteIds'][0]);act(p,'edit-tools');p.locator('[data-transform="quantize"]').click();assert next(n for n in ns(p)if n['id']==f['noteIds'][0])['start']==240;assert next(n for n in ns(p)if n['id']==f['noteIds'][0])['duration']==960;act(p,'undo');assert next(n for n in ns(p)if n['id']==f['noteIds'][0])['start']==130
 run('UI45-explicit-quantization-selected-only',quantize)
 result={'version':json.loads((R/'package.json').read_text())['version'],'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'mode':'origin'if args.url else 'complete production HTML via set_content','checks':checks,'counts':{k:sum(x['status']==k for x in checks)for k in ['PASS','FAIL']},'boundary':'No Safari/physical microphone/origin persistence claim. Pointer, keyboard, button actions and downloads are browser operations; setup fixtures use public API.'}
 (O/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(result['counts']);b.close()
raise SystemExit(bool(result['counts']['FAIL']))
