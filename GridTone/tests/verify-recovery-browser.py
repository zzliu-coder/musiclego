"""Recovery build: production-page checks, fixture setup via public application API.
Runs in Linux Chromium. Inline origin is not physical Mac or persistent-origin validation.
"""
import json,time,hashlib,traceback,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import fixture,act,ev,gen,gridpoint
R=Path(__file__).resolve().parents[1];O=R/'docs/recovery-2.2/evidence/browser';O.mkdir(parents=True,exist_ok=True)
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
  assert ev(p,'GridToneApp.version')=='2.2.0';assert p.locator('.template-shelf').count()==0;assert p.locator('.workspace-tabs').inner_text().split()==['编排','混音'];assert p.locator('[data-action="time-tools"]').count()>0
 run('01-home-and-length-entry',home)
 def music(p):
  before=raw(p);act(p,'library-open');assert [x.strip() for x in p.locator('.library-tabs .btn').all_inner_texts()]==['组合模板','节奏与乐句'];assert p.locator('[data-kind="sound"]').count()==0;assert p.locator('.library-family[draggable=true]').count()>0;assert raw(p)==before
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
  f=tfixture(p);lib(p);ev(p,"()=>{const A=GridToneApp;A.library.role='melody';A.library.render();const fs=A.library.familyList();A.library.multiIds=[fs[0].members[0],fs[1].members[0]];A.library.render()}");old=raw(p);before=h(p);act(p,'library-batch','[data-mode="series"]');p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click(force=True);p.wait_for_timeout(100);assert h(p)==before+1,p.locator('#toast').inner_text();act(p,'undo');assert raw(p)==old
 run('11-ordered-batch-place-and-undo',batch)
 def parallel(p):
  f=tfixture(p);before=ev(p,'GridToneApp.getProject().tracks.length');lib(p);ev(p,"()=>{const A=GridToneApp,items=A.shelf.all().filter(x=>x.type==='pattern'&&x.bars<=4);A.library.multiIds=[items[0].id,items.find(x=>x.kind!==items[0].kind).id];A.library.render()}");act(p,'library-batch','[data-mode="parallel"]');p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click(force=True);p.wait_for_timeout(100);assert ev(p,'GridToneApp.getProject().tracks.length')==before+2,p.locator('#toast').inner_text()
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
  tfixture(p);act(p,'time-tools');p.locator('#time-from').fill('1');p.locator('#time-to').fill('2');act(p,'time-apply','[data-mode="clear"]');act(p,'confirm');assert ev(p,'GridToneApp.getProject().bars')==16;assert ev(p,'GridToneApp.getProject().tracks.every(t=>t.clips.every(c=>c.bar>=2))')
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
 summary={'version':'2.2.0','htmlSha256':hashlib.sha256(H.encode()).hexdigest(),'environment':'Linux Chromium, full production HTML via set_content; fixtures via public API','browser':b.version,'checks':checks,'passed':sum(x['status']=='PASS' for x in checks),'failed':sum(x['status']=='FAIL' for x in checks)}
 (O/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps({k:summary[k] for k in ['passed','failed']}));b.close()
raise SystemExit(1 if summary['failed'] else 0)
