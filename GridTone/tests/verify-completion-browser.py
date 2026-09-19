"""Completion build: production-page checks, fixture setup via public application API.
Runs in Linux Chromium. Inline origin is not physical Mac or persistent-origin validation.
"""
import json,time,hashlib,traceback,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import fixture,act,ev,gen,gridpoint
R=Path(__file__).resolve().parents[1];O=R/'docs/completion-2.2.1/evidence/browser';O.mkdir(parents=True,exist_ok=True)
H=(R/'dist/index.html').read_text();checks=[]
def raw(p):return ev(p,'JSON.stringify(GridToneApp.getProject())')
def h(p):return ev(p,'GridToneApp.getHistory().undo')
def lib(p,kind='rhythm',id=None,tid=None):ev(p,'x=>GridToneApp.library.open(x.kind,x.id,x.tid)',dict(kind=kind,id=id,tid=tid));p.wait_for_timeout(50)
def tfixture(p,bars=4):
 f=fixture(p,bars=bars);ev(p,'()=>{const A=GridToneApp,d=A.getProject();d.bars=16;A.materials.c.commit({project:d});}');return f
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def run(name,fn):
  if os.environ.get('RECOVERY_ONLY') and not name.startswith(os.environ['RECOVERY_ONLY']):return
  print('START',name,flush=True)
  c=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=c.new_page();p.set_default_timeout(6500);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));start=time.monotonic()
  try:
   p.set_content(H,wait_until='load');p.wait_for_function('window.GridToneApp');p.wait_for_timeout(220);detail=fn(p);assert not errors,errors;checks.append(dict(name=name,status='PASS',seconds=round(time.monotonic()-start,2),detail=detail));print('PASS',name,flush=True)
  except Exception as e:checks.append(dict(name=name,status='FAIL',error=str(e),trace=traceback.format_exc(),pageErrors=errors));print('FAIL',name,str(e)[:280],flush=True)
  finally:
   p.screenshot(path=str(O/(name+'.png')));c.close()
 def home(p):
  assert ev(p,'GridToneApp.version')=='2.2.1';assert p.locator('.template-shelf').count()==0;assert p.locator('.workspace-tabs').inner_text().split()==['编排','混音'];assert p.locator('[data-action="time-tools"]').count()>0
 run('01-home-and-length-entry',home)
 def music(p):
  before=raw(p);act(p,'library-open');assert [x.strip() for x in p.locator('.library-tabs .btn').all_inner_texts()]==['全部模板','节奏与乐句','组合模板','示例作品'];assert p.locator('[data-kind="sound"]').count()==0;assert p.locator('.library-family[draggable=true]').count()>0;assert raw(p)==before
 run('02-music-library-excludes-sounds',music)
 def compact(p):
  f=fixture(p);act(p,'open-sound');assert p.locator('.sound-current').count()==1;assert p.locator('#creation-dock [data-action="library-open"]').count()==1;assert p.locator('#creation-dock .sound-card').count()==0;act(p,'library-open','[data-kind="sound"]');assert p.locator('.library-tabs').inner_text()=='本轨音色';assert p.locator('.library-family[draggable=true]').count()==0
 run('03-one-sound-chooser-in-track-panel',compact)
 def sound(p):
  f=fixture(p);before=ev(p,'GridToneApp.getProject()');old=h(p);lib(p,'sound','studio.fm.tine',f['trackId']);assert p.locator('[data-library-field="bar"]').count()==0;assert p.locator('[data-library-field="target"]').count()==0;act(p,'library-adopt');after=ev(p,'GridToneApp.getProject()');a=next(t for t in after['tracks'] if t['id']==f['trackId']);o=next(t for t in before['tracks'] if t['id']==f['trackId']);assert a['patterns']==o['patterns'];assert a['preset']=='studio.fm.tine';assert h(p)==old+1;act(p,'library-close');act(p,'undo');assert ev(p,'GridToneApp.getProject()')==before
 run('04-sound-use-preserves-notes-and-undo',sound)
 def fixed(p):
  f=fixture(p);before=ev(p,'GridToneApp.getProject()');lib(p,'sound','studio.fm.tine',f['trackId']);ev(p,'GridToneApp.selectTrack(GridToneApp.getProject().tracks[0].id)');act(p,'library-adopt');now=ev(p,'GridToneApp.getProject()');assert next(t for t in now['tracks'] if t['id']==f['trackId'])['preset']=='studio.fm.tine';assert now['tracks'][0]==before['tracks'][0]
 run('05-sound-fixed-target-despite-selection',fixed)
 def removed(p):
  f=fixture(p);lib(p,'sound','studio.fm.tine',f['trackId']);ev(p,'id=>{const A=GridToneApp,d=A.getProject();d.tracks=d.tracks.filter(t=>t.id!==id);A.materials.c.commit({project:d});}',f['trackId']);assert '音轨已删除' in p.locator('.library-bound-track').inner_text();assert p.locator('[data-action="library-adopt"]').is_disabled()
 run('06-deleted-sound-target-blocked',removed)
 def preview(p):
  f=fixture(p);old=raw(p);lib(p,'sound','studio.fm.tine',f['trackId']);act(p,'library-preview');p.wait_for_timeout(160);assert raw(p)==old;assert ev(p,'GridToneApp.playback.auditionProject!==null');act(p,'library-close');assert ev(p,'GridToneApp.playback.auditionProject===null')
 run('07-preview-does-not-write',preview)
 def take(p):
  f=tfixture(p);lib(p);ev(p,"()=>{GridToneApp.library.role='melody';GridToneApp.library.render()}");before=raw(p);box=p.locator('.arrange-lane').first.bounding_box();act(p,'library-take');assert p.locator('#studio-library').get_attribute('class').find('library-in-hand')>=0;assert p.locator('.workspace-body').get_attribute('inert') is None;after=p.locator('.arrange-lane').first.bounding_box();assert abs(box['width']-after['width'])<1;act(p,'shelf-cancel');assert p.locator('#studio-library').get_attribute('aria-hidden') is None;assert raw(p)==before
 run('08-take-cancel-preserves-geometry',take)
 def take_place(p):
  f=tfixture(p);lib(p);ev(p,"()=>{GridToneApp.library.role='melody';GridToneApp.library.render()}");sound=ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).preset',f['trackId']);old=h(p);before=raw(p);act(p,'library-take');loc=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]');loc.scroll_into_view_if_needed();loc.click(force=True);p.wait_for_timeout(120);assert h(p)==old+1;assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).preset',f['trackId'])==sound;assert p.locator('#studio-library').count()==0;act(p,'undo');assert raw(p)==before
 run('09-template-click-place-single-undo',take_place)
 def native_drag(p):
  f=tfixture(p);lib(p);ev(p,"()=>{GridToneApp.library.role='melody';GridToneApp.library.render()}");before=h(p);source=p.locator('.library-family[data-library-material]').first;target=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]');s=source.bounding_box();t=target.bounding_box();p.mouse.move(s['x']+30,s['y']+35);p.mouse.down();p.mouse.move(s['x']+44,s['y']+47,steps=6);p.mouse.move(t['x']+t['width']/2,t['y']+t['height']/2,steps=12);p.mouse.move(t['x']+t['width']/2+2,t['y']+t['height']/2,steps=2);p.mouse.up();p.wait_for_timeout(180);assert h(p)==before+1,(h(p),before,p.locator('#toast').inner_text());assert p.locator('.shelf-drop-ghost').count()==0
 run('10-real-mouse-drag-library-to-arrangement',native_drag)
 def batch(p):
  f=tfixture(p);lib(p);ev(p,"()=>{const A=GridToneApp;A.library.role='melody';A.library.render();const fs=A.library.familyList();A.library.multiIds=[fs[0].members[0],fs[1].members[0]];A.library.render()}");old=raw(p);before=h(p);act(p,'library-batch','[data-mode="series"]');p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click(force=True);act(p,'library-batch-apply');p.wait_for_timeout(100);assert h(p)==before+1,p.locator('#toast').inner_text();act(p,'undo');assert raw(p)==old
 run('11-ordered-batch-place-and-undo',batch)
 def parallel(p):
  f=tfixture(p);before=ev(p,'GridToneApp.getProject().tracks.length');lib(p);ev(p,"()=>{const A=GridToneApp,items=A.shelf.all().filter(x=>x.type==='pattern'&&x.bars<=4);A.library.multiIds=[items[0].id,items.find(x=>x.kind!==items[0].kind).id];A.library.render()}");act(p,'library-batch','[data-mode="parallel"]');p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click(force=True);
  for i in range(2):p.locator(f'[data-batch-field="target"][data-index="{i}"]').select_option('new-track')
  act(p,'library-batch-apply');p.wait_for_timeout(100);assert ev(p,'GridToneApp.getProject().tracks.length')==before+2,p.locator('#toast').inner_text()
 run('12-parallel-batch-allocates-tracks',parallel)
 def trim(p):
  tfixture(p);before=raw(p);old=h(p);act(p,'time-tools');act(p,'time-apply','[data-mode="trim"]');assert ev(p,'GridToneApp.getProject().bars')==4;assert h(p)==old+1;act(p,'undo');assert raw(p)==before
 run('13-trim-empty-tail-and-undo',trim)
 def resize(p):
  tfixture(p);act(p,'time-tools');p.locator('#song-bars').fill('2');act(p,'time-apply','[data-mode="resize"]');assert ev(p,'GridToneApp.getProject().bars')==16;assert '仍有音乐块' in p.locator('#toast').inner_text();p.locator('#song-bars').fill('8');act(p,'time-apply','[data-mode="resize"]');assert ev(p,'GridToneApp.getProject().bars')==8
 run('14-resize-protects-existing-blocks',resize)
 def delete(p):
  tfixture(p);before=raw(p);act(p,'time-tools');p.locator('#time-from').fill('2');p.locator('#time-to').fill('3');act(p,'time-apply','[data-mode="delete"]');act(p,'confirm');assert ev(p,'GridToneApp.getProject().bars')==14,p.locator('#toast').inner_text();assert ev(p,'!!GridTone.validateProject(GridToneApp.getProject())');act(p,'undo');assert raw(p)==before
 run('15-delete-time-and-whole-undo',delete)
 def clear(p):
  tfixture(p);act(p,'time-tools');p.locator('#time-from').fill('1');p.locator('#time-to').fill('2');act(p,'time-apply','[data-mode="clear"]');act(p,'confirm');assert ev(p,'GridToneApp.getProject().bars')==16;assert ev(p,'GridTone.compileSong(GridToneApp.getProject()).events.every(n=>n.start>=2*GridTone.BAR)')
 run('16-clear-content-keeps-time',clear)
 def axis(p):
  f=tfixture(p,bars=8);p.locator('#gridframe').scroll_into_view_if_needed();ev(p,'()=>{const v=GridTone.viewportFor(GridToneApp.materials.c.getSession(),GridToneApp.getProject().tracks.at(-1));v.zoomX=2;GridToneApp.render()}');p.locator('#gridframe').scroll_into_view_if_needed();before=p.locator('[data-ruler-pitch]').first.bounding_box();ev(p,"document.querySelector('.grid-scroll').scrollLeft=300");p.wait_for_timeout(80);after=p.locator('[data-ruler-pitch]').first.bounding_box();assert abs(after['x']-before['x'])<1,(before,after);return {'beforeX':before['x'],'afterX':after['x']}
 run('17-pitch-axis-stays-visible-horizontally',axis)
 def pitch_drag(p):
  f=fixture(p);p.locator('#gridframe').scroll_into_view_if_needed();before=raw(p);history=h(p);low=ev(p,'Number(document.querySelector("#note-grid").dataset.low)');el=p.locator('[data-ruler-pitch]').nth(3);box=el.bounding_box();p.mouse.move(box['x']+22,box['y']+9);p.mouse.down();p.mouse.move(box['x']+22,box['y']+89,steps=10);p.mouse.up();after=ev(p,'Number(document.querySelector("#note-grid").dataset.low)');assert after>low,(low,after);assert raw(p)==before and h(p)==history
 run('18-pitch-ruler-drag-only-changes-view',pitch_drag)
 def pan(p):
  f=fixture(p);p.locator('#gridframe').scroll_into_view_if_needed();act(p,'tool','[data-tool="pan"]');before=raw(p);low=ev(p,'Number(document.querySelector("#note-grid").dataset.low)');box=p.locator('#note-grid').bounding_box();x=box['x']+220;y=box['y']+140;p.mouse.move(x,y);p.mouse.down();p.mouse.move(x-40,y+80,steps=10);p.mouse.up();assert ev(p,'Number(document.querySelector("#note-grid").dataset.low)')>low;assert raw(p)==before
 run('19-pan-tool-browses-pitch-range',pan)
 def small(p):
  p.set_viewport_size({'width':1100,'height':700});fixture(p);act(p,'library-open');p.locator('[data-action="library-close"]').click();act(p,'open-sound');p.locator('#creation-dock [data-action="library-open"]').click();assert p.locator('[data-action="library-adopt"]').is_visible();p.screenshot(path=str(O/'short-sound.png'))
 run('20-short-window-major-controls-reachable',small)
 def download(p):
  tfixture(p);act(p,'export');
  with p.expect_download() as info:act(p,'export-project')
  out=O/'recovered.gridtone';info.value.save_as(out);data=json.loads(out.read_text());assert data['version']==3;assert data['bars']==16
 run('21-real-project-file-download',download)
 def candidate(p):
  fixture(p);gen(p);assert ev(p,'GridToneApp.creation.session.candidates.length')>0;old=raw(p);act(p,'creation-preview');p.wait_for_timeout(100);assert raw(p)==old
 run('22-generation-and-preview-regression',candidate)
 def listen(p):
  ev(p,'async()=>{await GridToneApp.playback.start("song");}');p.wait_for_timeout(180);assert ev(p,'GridToneApp.engine.playing');p.locator('[data-view="mix"]').click();assert ev(p,'GridToneApp.engine.playing');act(p,'stop');assert not ev(p,'GridToneApp.engine.playing')
 run('23-play-mix-stop-regression',listen)
 def reuse(p):
  fixture(p);lib(p);p.locator('#studio-search').fill('都市');old=raw(p);act(p,'library-close');act(p,'library-open');assert p.locator('#studio-search').input_value()=='都市';assert raw(p)==old
 run('24-library-restores-search-context',reuse)

 def range_history(p):
  tfixture(p);ev(p,'GridToneApp.playback.setRange([4*GridTone.BAR,12*GridTone.BAR])');act(p,'time-tools');p.locator('#time-from').fill('2');p.locator('#time-to').fill('3');act(p,'time-apply','[data-mode="delete"]');act(p,'confirm');assert ev(p,'GridToneApp.getPlayback().range')==[2*3840,10*3840];act(p,'undo');assert ev(p,'GridToneApp.getPlayback().range')==[4*3840,12*3840];act(p,'redo');assert ev(p,'GridToneApp.getPlayback().range')==[2*3840,10*3840]
 run('25-time-edit-undo-redo-restores-loop',range_history)
 def stale(p):
  tfixture(p);act(p,'time-tools');act(p,'time-apply','[data-mode="delete"]');ev(p,'()=>{const A=GridToneApp,d=A.getProject();d.title="新标题";A.materials.c.commit({project:d})}');old=raw(p);act(p,'confirm');assert raw(p)==old;assert '作品已经变化' in p.locator('#toast').inner_text()
 run('26-stale-time-confirmation-does-not-overwrite',stale)
 def deep_sound(p):
  f=fixture(p);act(p,'open-sound');p.locator('#creation-dock details summary').click();act(p,'sound-full');modal=p.locator('.modal');assert modal.locator('.sound-card,.sound-tabs,.sound-layout,[data-action="library-open"]').count()==0;assert modal.locator('input[type=range]').count()>=6;assert '调整当前声音' in modal.inner_text();before=ev(p,'GridToneApp.getProject()');old=h(p)
  slider=modal.locator('input[type=range]').first;slider.focus();p.keyboard.press('ArrowRight');slider.blur();p.wait_for_timeout(80);after=ev(p,'GridToneApp.getProject()');t=next(t for t in after['tracks'] if t['id']==f['trackId']);prev=next(t for t in before['tracks'] if t['id']==f['trackId']);assert t['patterns']==prev['patterns'];assert t['sound']!=prev['sound'];act(p,'close-modal');act(p,'undo');assert ev(p,'GridToneApp.getProject()')==before
 run('27-deep-sound-only-current-parameters-real-slider',deep_sound)
 def resources(p):
  fixture(p);act(p,'open-sound');p.locator('#creation-dock details summary').click();act(p,'sound-resources');assert p.locator('.modal [data-action="record"]').count()==1;assert p.locator('.modal .sound-card').count()==0;act(p,'close-modal');act(p,'library-open');act(p,'library-manage');assert '素材管理与导入' in p.locator('.modal').inner_text();assert p.locator('.modal .sound-card,.modal #catalog-cards').count()==0
 run('28-resource-manager-without-second-sound-chooser',resources)
 def collections(p):
  tfixture(p);before=raw(p);lib(p);assert len(p.locator('[data-action="library-collection"]').all_inner_texts())==5;id=ev(p,'GridToneApp.library.item().id');act(p,'library-pin');act(p,'library-star');act(p,'library-collection','[data-collection="tray"]');assert id in ev(p,'GridToneApp.library.familyList().flatMap(f=>f.members)');act(p,'library-collection','[data-collection="favorites"]');assert id in ev(p,'GridToneApp.library.familyList().flatMap(f=>f.members)');act(p,'library-close');act(p,'library-open');assert ev(p,'GridToneApp.library.browse')=='favorites';assert raw(p)==before
 run('29-collections-visible-pinned-favorites-and-reopen',collections)
 def recent_used(p):
  f=tfixture(p);lib(p);ev(p,"()=>{GridToneApp.library.role='melody';GridToneApp.library.render()}");id=ev(p,'GridToneApp.library.item().id');act(p,'library-take');p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click(force=True);act(p,'library-open');act(p,'library-collection','[data-collection="recent"]');assert id in ev(p,'GridToneApp.library.familyList().flatMap(f=>f.members)');act(p,'library-collection','[data-collection="used"]');assert id in ev(p,'GridToneApp.library.familyList().flatMap(f=>f.members)')
 run('30-applied-material-in-recent-and-currently-used',recent_used)
 def examples(p):
  fixture(p);before=raw(p);lib(p);act(p,'library-kind','[data-kind="example"]');assert ev(p,'GridToneApp.library.familyList().flatMap(f=>f.members).length')==5;assert p.locator('.library-family[draggable=true]').count()==0;assert p.locator('[data-action="library-take"],[data-action="library-mark"]').count()==0;assert p.locator('[data-action="library-example"]').count()==1;act(p,'library-preview');p.wait_for_timeout(100);assert ev(p,'GridToneApp.playback.auditionProject!==null');assert raw(p)==before
 run('31-all-five-examples-discoverable-with-safe-audition',examples)
 def example_copy(p):
  # Only persistence boundary is replaced, explicitly. Application switching path is production code.
  ev(p,"()=>{const store=new Map();window.testDocumentStore=store;GridTone.projects.save=async p=>{store.set(p.id,GridTone.clone(p));return p};GridTone.projects.activate=async id=>{};GridTone.projects.read=async (k,id)=>store.get(id)||null;}")
  f=fixture(p);ev(p,'GridToneApp.saveCurrent()');old=ev(p,'GridToneApp.getProject()');lib(p);act(p,'library-kind','[data-kind="example"]');source=ev(p,'GridToneApp.library.item().project.id');act(p,'library-example');p.wait_for_timeout(250);new=ev(p,'GridToneApp.getProject()');assert new['id'] not in [old['id'],source];assert ev(p,'id=>window.testDocumentStore.has(id)',old['id']);assert p.locator('#studio-library').count()==0
  return {'storage':'explicit in-memory adapter, not real IndexedDB validation','copied':True}
 run('32-example-independent-new-work-preserves-old-adapter',example_copy)
 def batch_setup(p,kind='series'):
  f=tfixture(p);lib(p);ev(p,"mode=>{const A=GridToneApp,items=A.shelf.all().filter(x=>x.type==='pattern'&&x.bars===4);const ms=items.filter(x=>x.kind==='melodic');A.library.multiIds=mode==='series'?[ms[0].id,ms[1].id]:[ms[0].id,items.find(x=>x.kind==='drum').id];A.library.batchMode=mode;A.library.render()}",kind);act(p,'library-batch',f'[data-mode="{kind}"]');return f
 def batch_series(p):
  f=batch_setup(p);old=raw(p);history=h(p);loc=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]');loc.scroll_into_view_if_needed();loc.hover(force=True);p.wait_for_timeout(80);assert p.locator('.batch-drop-ghost').count()==2;assert '第5—12小节' in p.locator('.batch-plan-summary').inner_text();loc.click(force=True);assert raw(p)==old and h(p)==history;plan=ev(p,'GridToneApp.library.batch.plan');act(p,'library-batch-preview');p.wait_for_timeout(120);assert raw(p)==old;scope=ev(p,'GridToneApp.engine.scope');assert scope['range']==[4*3840,12*3840];ids=ev(p,'GridToneApp.playback.auditionProject.tracks.flatMap(t=>t.clips.map(c=>c.id))');assert set(ids)==set(plan['clipIds']);act(p,'library-batch-apply');assert h(p)==history+1;assert set(plan['clipIds']).issubset(set(ev(p,'GridToneApp.getProject().tracks.flatMap(t=>t.clips.map(c=>c.id))')));act(p,'undo');assert raw(p)==old
 run('33-batch-series-hover-plan-audition-apply-one-undo',batch_series)
 def parallel_existing(p):
  f=batch_setup(p,'parallel');p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');proj=ev(p,'GridToneApp.getProject()');drum=next(t for t in proj['tracks'] if t['kind']=='drum');p.locator('[data-batch-field="target"][data-index="0"]').select_option(f['trackId']);p.locator('[data-batch-field="target"][data-index="1"]').select_option(drum['id']);assert p.locator('.batch-drop-ghost').count()==2;plan=ev(p,'GridToneApp.library.batch.plan');assert plan['newTrackCount']==0;act(p,'library-batch-preview-full');p.wait_for_timeout(120);assert len(ev(p,'GridToneApp.playback.auditionProject.tracks'))==len(proj['tracks']);act(p,'library-batch-apply');after=ev(p,'GridToneApp.getProject()');assert len(after['tracks'])==len(proj['tracks']);assert [t['preset'] for t in after['tracks']]==[t['preset'] for t in proj['tracks']]
 run('34-parallel-explicit-existing-tracks-preview-with-song',parallel_existing)
 def batch_cancel(p):
  f=batch_setup(p);before=raw(p);p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');act(p,'library-batch-preview');p.wait_for_timeout(100);p.keyboard.press('Escape');assert ev(p,'GridToneApp.library.visible');assert p.locator('#batch-plan-panel,.batch-drop-ghost').count()==0;assert not ev(p,'GridToneApp.playback.auditionProject');assert raw(p)==before
 run('35-batch-escape-cleans-audio-ghost-and-restores-library',batch_cancel)
 def batch_conflict(p):
  f=batch_setup(p);p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');ev(p,"id=>{const A=GridToneApp,d=A.getProject();d.tracks.find(t=>t.id===id).volume=.19;A.materials.c.commit({project:d})}",f['trackId']);assert p.locator('[data-action="library-batch-apply"]').is_disabled();assert '已变化' in p.locator('.batch-plan-summary').inner_text();act(p,'library-batch-recheck');assert not p.locator('[data-action="library-batch-apply"]').is_disabled();act(p,'library-batch-apply');assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).volume',f['trackId'])==.19
 run('36-batch-stale-related-edit-requires-recheck',batch_conflict)
 def batch_unrelated(p):
  f=batch_setup(p);p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');other=ev(p,'GridToneApp.getProject().tracks[0].id');ev(p,"id=>{const A=GridToneApp,d=A.getProject();d.tracks.find(t=>t.id===id).volume=.17;A.materials.c.commit({project:d})}",other);assert not p.locator('[data-action="library-batch-apply"]').is_disabled();act(p,'library-batch-apply');assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).volume',other)==.17
 run('37-batch-application-preserves-unrelated-edit',batch_unrelated)
 def reorder(p):
  batch_setup(p);before=ev(p,'GridToneApp.library.batch.templates.map(t=>t.id)');p.locator('[data-action="library-batch-down"][data-index="0"]').click();assert ev(p,'GridToneApp.library.batch.templates.map(t=>t.id)')==before[::-1];p.locator('[data-batch-field="seriesTrack"]').select_option('new-track');p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');assert p.locator('.batch-new-preview').count()==1;old=len(ev(p,'GridToneApp.getProject().tracks'));act(p,'library-batch-apply');assert len(ev(p,'GridToneApp.getProject().tracks'))==old+1
 run('38-batch-reorder-new-series-one-track',reorder)
 def native_batch(p):
  f=tfixture(p);lib(p);ev(p,"()=>{const A=GridToneApp;A.library.role='melody';A.library.render();const fs=A.library.familyList();A.library.multiIds=[fs[0].defaultId,fs[1].defaultId];A.library.batchMode='series';A.library.render()}");old=raw(p);before=h(p);source=p.locator('.library-family[data-library-material]').first;target=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]');x=source.bounding_box();y=target.bounding_box();p.mouse.move(x['x']+30,x['y']+35);p.mouse.down();p.mouse.move(x['x']+45,x['y']+48,steps=6);p.mouse.move(y['x']+y['width']/2,y['y']+y['height']/2,steps=15);p.mouse.move(y['x']+y['width']/2+2,y['y']+y['height']/2,steps=2);p.mouse.up();p.wait_for_timeout(160);assert p.locator('#batch-plan-panel').count()==1;assert p.locator('.batch-drop-ghost').count()==2;assert raw(p)==old;act(p,'library-batch-apply');assert h(p)==before+1
 run('39-real-native-multi-drag-stable-plan-before-apply',native_batch)
 def longfixture(p):
  f=fixture(p,bars=8,notes=False);ev(p,"f=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks.find(t=>t.id===f.trackId);d.tracks=[t];d.bars=8;t.patterns[0].notes=[G.newNote(60,4*G.BAR,4*G.BAR,.7)];t.pipeline={arp:'off',rate:G.STEP,transpose:0,humanize:0};const out=A.materials.c.commit({project:d});if(out?.ok===false)throw Error(out.error.message);}",f);return f
 def longclear(p):
  longfixture(p);old=raw(p);history=h(p);before=ev(p,'GridTone.compileSong(GridToneApp.getProject()).events.map(n=>[n.pitch,n.start,n.duration])');act(p,'time-tools');p.locator('#time-from').fill('1');p.locator('#time-to').fill('1');act(p,'time-apply','[data-mode="clear"]');act(p,'confirm');assert ev(p,'GridTone.compileSong(GridToneApp.getProject()).events.map(n=>[n.pitch,n.start,n.duration])')==before;assert h(p)==history;assert raw(p)==old
 run('40-clear-unrelated-first-bar-keeps-one-sustained-event',longclear)
 def odddelete(p):
  longfixture(p);act(p,'time-tools');p.locator('#time-from').fill('1');p.locator('#time-to').fill('1');act(p,'time-apply','[data-mode="delete"]');act(p,'confirm');assert ev(p,'GridToneApp.getProject().bars')==7;assert ev(p,'GridTone.compileSong(GridToneApp.getProject()).events.map(n=>[n.pitch,n.start,n.duration])')==[[60,3*3840,4*3840]];act(p,'export')
  with p.expect_download() as result:act(p,'export-project')
  path=O/'seven-bar-sustain.gridtone';result.value.save_as(path);parsed=json.loads(path.read_text());assert parsed['tracks'][0]['patterns'][0]['bars']==7;assert ev(p,'p=>!!GridTone.validateProject(p)',parsed)
 run('41-delete-time-exact-seven-bars-download-reopen-contract',odddelete)
 def short_batch(p):
  p.set_viewport_size({'width':1100,'height':700});batch_setup(p,'parallel');p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');button=p.locator('[data-action="library-batch-apply"]');assert button.is_visible();r=button.bounding_box();assert r['y']+r['height']<700;assert p.locator('#batch-plan-panel').count()==1
 run('42-short-window-batch-controls-reachable',short_batch)
 def readonlypreview(p):
  batch_setup(p);p.locator('[data-batch-field="bar"]').fill('5');p.locator('[data-batch-field="bar"]').press('Tab');old=raw(p);plan=ev(p,'GridToneApp.library.batch.plan');act(p,'library-batch-preview');p.wait_for_timeout(100);act(p,'export');p.locator('#export-scope').select_option('current')
  with p.expect_download() as result:act(p,'export-midi')
  path=O/'batch-preview.mid';result.value.save_as(path);assert len(path.read_bytes())>30;assert raw(p)==old;act(p,'close-modal');act(p,'library-batch-cancel')
  return {'plannedClips':len(plan['clipIds']),'midiBytes':path.stat().st_size,'originalUnchanged':True}
 run('43-batch-preview-export-keeps-unapplied-plan',readonlypreview)
 def domain(p):
  f=fixture(p);lib(p,'sound','studio.fm.tine',f['trackId']);act(p,'library-star');act(p,'library-collection','[data-collection="favorites"]');assert ev(p,"GridToneApp.library.familyList().every(f=>f.kind==='sound')");act(p,'library-close');lib(p,'all');act(p,'library-collection','[data-collection="favorites"]');assert ev(p,"GridToneApp.library.familyList().every(f=>f.kind!=='sound')")
 run('44-music-and-sound-collections-remain-separate',domain)
 def extension(p):
  f=batch_setup(p);before=raw(p);clip=p.locator('[data-clip]').first.bounding_box();p.locator('[data-batch-field="bar"]').fill('13');p.locator('[data-batch-field="bar"]').press('Tab');assert '延长至20小节' in p.locator('.batch-plan-summary').inner_text();assert p.locator('.batch-range-extension').count()==1;now=p.locator('[data-clip]').first.bounding_box();assert abs(now['width']-clip['width'])<1;assert abs(now['x']-clip['x'])<1;assert raw(p)==before;assert ev(p,'GridToneApp.library.batch.plan.project.bars')==20;p.screenshot(path=str(O/'batch-extension-plan.png'))
 run('45-long-batch-preview-extends-scroll-not-existing-geometry',extension)
 def missing_collection(p):
  fixture(p);lib(p);ev(p,"()=>{const l=GridToneApp.library;l.collections.pin('uninstalled.pack.demo');l.browse='tray';l.kind='all';l.render()}");assert '暂未载入' in p.locator('.library-missing-note').inner_text();assert ev(p,"GridToneApp.library.collections.tray.includes('uninstalled.pack.demo')")
 run('46-unavailable-saved-material-keeps-identity-and-explanation',missing_collection)
 def drum_manager(p):
  fixture(p);act(p,'library-open');act(p,'library-manage');act(p,'catalog-tab','[data-category="drumkits"]');assert p.locator('.modal [data-category="presets"],.modal [data-category="templates"]').count()==0;assert p.locator('.modal [data-action="catalog"]').count()==1;act(p,'catalog');assert '素材管理与导入' in p.locator('.modal').inner_text()
 run('47-resource-drums-no-hidden-template-or-preset-browser',drum_manager)

 summary={'version':'2.2.1','htmlSha256':hashlib.sha256(H.encode()).hexdigest(),'environment':'Linux Chromium, full production HTML via set_content; fixtures via public API','browser':b.version,'checks':checks,'passed':sum(x['status']=='PASS' for x in checks),'failed':sum(x['status']=='FAIL' for x in checks)}
 (O/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps({k:summary[k] for k in ['passed','failed']}));b.close()
raise SystemExit(1 if summary['failed'] else 0)
