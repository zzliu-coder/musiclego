"""Full production HTML regression. Inline mode does NOT prove origin persistence.
python tests/verify-repair-browser.py --inline
python tests/verify-repair-browser.py --url http://127.0.0.1:8765
"""
import argparse, hashlib, json, os, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--inline',action='store_true');ap.add_argument('--url');ap.add_argument('--browser',default=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'));args=ap.parse_args()
OUT=ROOT/os.environ.get('REPAIR_EVIDENCE_DIR','docs/reaudit-1.7.2/evidence');OUT.mkdir(parents=True,exist_ok=True)
(OUT/'screens').mkdir(exist_ok=True);(OUT/'downloads').mkdir(exist_ok=True)
html=(ROOT/'dist/index.html').read_text();results=[];errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
 page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
 if args.url:page.goto(args.url)
 else:page.set_content(html,wait_until='load')
 page.wait_for_function('window.GridToneApp && document.querySelector("#note-grid")');page.wait_for_timeout(500)
 def run(name,fn):
  start=time.time()
  try:
   value=fn();results.append({'id':name,'status':'PASS','seconds':round(time.time()-start,3),'detail':value})
   print('PASS',name,flush=True)
  except Exception as exc:
   results.append({'id':name,'status':'FAIL','error':str(exc),'trace':traceback.format_exc()})
   page.screenshot(path=str(OUT/'screens'/f'failure-{name}.png'))
   print('FAIL',name,str(exc),flush=True)
 def evaluate(code,arg=None):return page.evaluate(code,arg)
 def fixture(kind='blank',bars=8):
  page.set_viewport_size({'width':1440,'height':900})
  evaluate('''({kind,bars})=>{const A=GridToneApp,G=GridTone;A.playback.stop();A.shelf.cancel();A.creation.close();A.materials.c.closeModal();let p=kind==='recipe'?G.recipeProject('recipe.pop'):G.blankProject();p.id=A.getProject().id;p.bars=Math.max(bars,p.bars);if(kind!=='recipe')p.tracks[0].patterns[0].bars=bars;const t=kind==='recipe'?p.tracks.at(-1):p.tracks[0];const out=A.materials.c.commit({project:p,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});if(out?.ok===false)throw Error(out.error.message);A.shelf.collapsed=false;const s=A.materials.c.getSession();s.editorTab='notes';s.editorExpanded=false;s.snap=240;s.continuous=true;s.selected=[];s.cursor=0;s.tool='draw';A.changeView('edit');document.querySelector('.view-content').scrollTop=0;A.render();}''',{'kind':kind,'bars':bars})
  page.wait_for_timeout(50)
 def proj():return evaluate('GridToneApp.getProject()')
 def pattern():return evaluate('''()=>{const A=GridToneApp,p=A.getProject(),s=A.getState();return p.tracks.find(t=>t.id===s.trackId).patterns.find(p=>p.id===s.patternId)}''')
 def act(a):page.locator(f'[data-action="{a}"]').filter(visible=True).first.click()
 def close():
  if evaluate('!!GridToneApp.getState().modal'):page.locator('[data-action="close-modal"]').last.click()
 def click_key(tick,pitch=60):
  xy=evaluate('''({tick,pitch})=>{const svg=document.querySelector('#note-grid'),s=GridToneApp.materials.c.getSession(),p=GridToneApp.getProject(),t=p.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),rows=GridTone.visiblePitches(p,s,t,pat),w=GridTone.gridWindow(s,pat),r=svg.getBoundingClientRect(),left=+svg.dataset.left,cw=+svg.dataset.cellWidth,rh=+svg.dataset.rowHeight;return {x:r.x+left+(tick-w.offset)/240*cw+2,y:r.y+28+(rows.indexOf(pitch)+.5)*rh}}''',{'tick':tick,'pitch':pitch})
  page.mouse.click(xy['x'],xy['y'])
 def take(id):
  page.locator('[data-field="shelf-search"]').fill('')
  page.locator('[data-action="shelf-filter"][data-filter="all"]').click()
  page.locator(f'[data-action="shelf-pick"][data-id="{id}"]').click()
 def initial():
  assert page.locator('.workspace-tabs button').count()==3
  assert not errors
  return {'tracks':len(proj()['tracks']),'storage':evaluate('GridToneApp.getState().saveStatus')}
 run('B01-initial-full-application',initial)
 def resize():
  fixture(bars=1);evaluate('''()=>{const A=GridToneApp,p=A.getProject();p.bars=16;const s=A.getState();A.materials.c.commit({project:p,trackId:s.trackId,patternId:s.patternId,clipId:s.clipId});}''')
  act('editor-more');page.locator('[data-field="pattern-length"]').select_option('8');assert pattern()['bars']==8;close();act('undo');assert pattern()['bars']==1;act('redo');assert pattern()['bars']==8
 run('B02-length-transaction-undo',resize)
 def draw():
  fixture(bars=4)
  n=len(pattern()['notes']);click_key(240,60);assert len(pattern()['notes'])==n+1
  act('undo');assert len(pattern()['notes'])==n;act('redo');assert len(pattern()['notes'])==n+1
  page.locator('#gridframe').focus();page.keyboard.press('Control+a');page.keyboard.press('Control+c');evaluate('GridToneApp.materials.c.getSession().cursor=1920');page.keyboard.press('Control+v');assert len(pattern()['notes'])==2
  page.keyboard.press('Delete');assert len(pattern()['notes'])==1
 run('B03-draw-copy-delete-history',draw)
 def clipcopy():
  fixture(bars=4);evaluate('''()=>{const A=GridToneApp,p=A.getProject();p.bars=16;const s=A.getState();A.materials.c.commit({project:p,...s});}''')
  act('clip-menu');act('duplicate-clip');assert len(proj()['tracks'][0]['clips'])==2
  act('undo');assert len(proj()['tracks'][0]['clips'])==1;act('redo');assert len(proj()['tracks'][0]['clips'])==2
  act('clip-menu');act('unlink-clip');p=proj();assert p['tracks'][0]['clips'][0]['patternId']!=p['tracks'][0]['clips'][1]['patternId']
 run('B04-clip-reference-unlink',clipcopy)
 def harmony():
  fixture(bars=8)
  for tick in [0,4*3840]:
   evaluate('t=>GridToneApp.materials.c.getSession().cursor=t',tick);take('prism.chords.pop');act('shelf-current')
   page.wait_for_function('!GridToneApp.shelf.activePlacement')
  assert len(pattern()['harmony']['events'])==8
  p=proj();assert pattern()['notes'];act('undo');assert len(pattern()['harmony']['events'])==4;act('redo');assert len(pattern()['harmony']['events'])==8
  return {'events':8,'notes':len(pattern()['notes'])}
 run('B05-two-chord-blocks-complete-harmony',harmony)
 def fine():
  fixture(bars=8);page.locator('[data-field="snap"]').select_option('120');evaluate('GridToneApp.materials.c.getSession().cursor=120');take('prism.chords.pop');act('shelf-current');page.wait_for_function('!GridToneApp.shelf.activePlacement');assert min(n['start'] for n in pattern()['notes'])==120
 run('B06-fine-snap-click-placement',fine)
 def blur():
  fixture();take('prism.chords.pop');evaluate("window.dispatchEvent(new Event('blur'))");assert evaluate('GridToneApp.shelf.activePlacement') is None;assert evaluate('GridToneApp.shelf.selectedItem') is None
  take('prism.chords.pop');act('shelf-current');page.wait_for_function('!GridToneApp.shelf.activePlacement');assert pattern()['notes']
 run('B07-blur-cancel-repickup',blur)
 def foreigndrop():
  fixture();take('prism.chords.pop');act('shelf-current');page.wait_for_function('!GridToneApp.shelf.activePlacement');before=proj()
  evaluate('''()=>{const d=new DataTransfer();d.setData('text/plain','unrelated text');document.querySelector('.arrange-lane').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d}));}''');assert proj()==before;assert evaluate('GridToneApp.shelf.dragProject') is None
 run('B08-foreign-drop-after-success-ignored',foreigndrop)
 def native_drag():
  fixture(bars=8);page.locator('[data-view="arrange"]').click();take('prism.chords.pop');act('shelf-cancel')
  # Empty current eight-bar instance occupies whole timeline: use a second melodic track.
  evaluate('''()=>{const A=GridToneApp,G=GridTone,p=A.getProject(),t=G.newTrack();t.clips=[];p.tracks.push(t);A.materials.c.commit({project:p,...A.getState()});window.dropTrack=t.id;}''')
  card=page.locator('[data-shelf-id="prism.chords.pop"]');lane=page.locator('.arrange-lane').last
  card.scroll_into_view_if_needed();lane.scroll_into_view_if_needed();a=card.bounding_box();b=lane.bounding_box()
  page.mouse.move(a['x']+70,a['y']+25);page.mouse.down();page.mouse.move(a['x']+75,a['y']+28,steps=3);page.mouse.move(b['x']+12,b['y']+25,steps=15);page.wait_for_timeout(100);page.mouse.up();page.wait_for_timeout(250)
  assert len(proj()['tracks'][-1]['clips'])==1;assert evaluate('GridToneApp.shelf.activePlacement') is None
 run('B09-native-mouse-drag-to-arrangement',native_drag)
 def mode_switch():
  fixture('recipe');evaluate('''()=>{const A=GridToneApp,G=GridTone,p=A.getProject(),t=p.tracks.at(-1);t.patterns[0].notes=[G.newNote(60,0,240),G.newNote(65,14400,240)];A.materials.c.commit({project:p,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});}''')
  before=pattern()['notes'];act('creation');page.locator('#creation-options summary').click();page.locator('[data-field="creation-intent"]').select_option('ending');page.locator('[data-field="creation-mode"]').select_option('rhythm');assert page.locator('[data-field="creation-intent"]').count()==0;act('creation-generate');page.wait_for_function('GridToneApp.creation.session.candidates.length>0')
  cs=evaluate('''()=>{const x=GridToneApp.creation.session,c=x.candidates[0];return c.project.tracks.find(t=>t.id===c.trackId).patterns.find(p=>p.id===c.patternId).notes}''')
  assert [[x['id'],x['start'],x['duration']]for x in cs]==[[x['id'],x['start'],x['duration']]for x in before]
  page.locator('[data-field="creation-mode"]').select_option('generate');assert page.locator('[data-field="creation-intent"]').input_value()=='ending'
 run('B10-per-mode-drafts-and-rhythm-invariant',mode_switch)
 def candidate_invalid():
  fixture('recipe');act('creation');act('creation-generate');page.wait_for_function('GridToneApp.creation.session.candidates.length>0');page.locator('[data-field="creation-density"]').select_option('dense');assert page.locator('[data-action="creation-apply"]').count()==0;assert evaluate('GridToneApp.creation.session.candidates.length')==0
 run('B11-parameter-change-removes-old-candidate',candidate_invalid)
 def dependency():
  fixture('recipe');act('creation');page.locator('#creation-options summary').click();page.locator('[data-field="creation-color"]').select_option('diatonic');act('creation-generate');page.wait_for_function('GridToneApp.creation.session.candidates.length>0')
  evaluate('''()=>{const A=GridToneApp,p=A.getProject();p.key=6;A.materials.c.commit({project:p,...A.getState()});}''');assert evaluate('GridToneApp.creation.session.candidates.length')==0;assert page.locator('[data-action="creation-apply"]').count()==0
 run('B12-global-effective-input-invalidates',dependency)
 def parallel():
  fixture('recipe');act('creation');act('creation-generate');page.wait_for_function('GridToneApp.creation.session.candidates.length>0')
  evaluate('''()=>{const A=GridToneApp,p=A.getProject();p.tracks[1].volume=.13;A.materials.c.commit({project:p,...A.getState()});}''');assert evaluate('GridToneApp.creation.session.candidates.length')>0
  act('creation-apply');assert proj()['tracks'][1]['volume']==.13;assert pattern()['notes'];assert evaluate('GridToneApp.getState().view')=='edit'
 run('B13-candidate-preserves-parallel-edit',parallel)
 def role():
  fixture();page.locator('[data-view="arrange"]').click();act('add-track');page.locator('[data-action="create-track"][data-preset="roundbass"]').click();assert proj()['tracks'][-1]['role']=='bass'
 run('B14-track-creation-explicit-role',role)
 def scrolling():
  fixture('recipe',12);checks=[]
  for width,height in [(1440,900),(1280,720),(1152,600)]:
   page.set_viewport_size({'width':width,'height':height})
   for view in ['arrange','edit']:
    for dock in [False,True]:
     evaluate('''({view,dock})=>{const A=GridToneApp;A.creation.close();A.changeView(view);if(dock)A.creation.open();document.querySelector('.view-content').scrollTop=0;}''',{'view':view,'dock':dock})
     r=page.locator('.view-content').bounding_box();page.mouse.move(r['x']+4,r['y']+100)
     for i in range(4):page.mouse.wheel(0,1000);page.wait_for_timeout(50)
     out=evaluate('''view=>{const v=document.querySelector('.view-content'),el=document.querySelector(view==='arrange'?'.dock-footer .btn:last-child':'.arrange-bottom .btn:last-child'),r=el.getBoundingClientRect(),box=v.getBoundingClientRect();return {top:v.scrollTop,max:v.scrollHeight-v.clientHeight,visible:r.top>=box.top-1&&r.bottom<=box.bottom+1,fixed:document.querySelector('.topbar').getBoundingClientRect().top,footer:document.querySelector('.playback-footer').getBoundingClientRect().bottom}}''',view)
     assert abs(out['top']-out['max'])<3 and out['visible'];assert abs(out['fixed'])<2;assert abs(out['footer']-height)<2
     evaluate('GridToneApp.render()');assert abs(evaluate('document.querySelector(".view-content").scrollTop')-out['top'])<3
     evaluate('v=>GridToneApp.changeView(v)', 'edit'if view=='arrange'else'arrange');evaluate('v=>GridToneApp.changeView(v)',view);assert abs(evaluate('document.querySelector(".view-content").scrollTop')-out['top'])<3
     checks.append({'width':width,'height':height,'view':view,'dock':dock})
  return checks
 run('B15-twelve-layout-scroll-and-return',scrolling)
 def audio_play():
  fixture('recipe');act('play');page.wait_for_function('GridToneApp.engine.playing');page.wait_for_timeout(300);before=evaluate('GridToneApp.engine.position()');page.locator('[data-view="mix"]').click();assert evaluate('GridToneApp.engine.playing');page.wait_for_timeout(100);assert evaluate('GridToneApp.engine.position()')>before;act('stop');assert not evaluate('GridToneApp.engine.playing');assert evaluate('GridToneApp.engine.previewGraphs.size')==0
 run('B16-real-audio-play-view-change-stop',audio_play)
 def exports():
  fixture('recipe');act('creation');act('creation-generate');page.wait_for_function('GridToneApp.creation.session.candidates.length>0');act('creation-preview');page.wait_for_function('GridToneApp.engine.playing');act('stop');act('creation-apply');act('export')
  for action,extension in [('export-project','gridtone'),('export-midi','mid')]:
   with page.expect_download() as info:act(action)
   d=info.value;dest=OUT/'downloads'/('verified.'+extension);d.save_as(dest)
   if extension=='gridtone':
    data=json.loads(dest.read_text());assert data['version']==3 and data['tracks'][-1]['patterns'][0]['notes'];evaluate('p=>GridTone.validateProject(p)',data)
   else:assert dest.read_bytes()[:4]==b'MThd'
   if not page.locator('[data-action="export-midi"]').count():act('export')
  with page.expect_download(timeout=60000) as info:act('export-wav')
  info.value.save_as(OUT/'downloads'/'verified.wav');assert (OUT/'downloads'/'verified.wav').read_bytes()[:4]==b'RIFF'
  close();return {'wavBytes':(OUT/'downloads'/'verified.wav').stat().st_size}
 run('B17-ui-project-midi-wav-downloads',exports)
 def visual():
  fixture('recipe');paths=[]
  for skin in ['crystal','pearl']:
   evaluate('s=>GridTone.appearance.set({skin:s})',skin)
   for view in ['arrange','edit','mix']:
    page.locator(f'[data-view="{view}"]').click();page.wait_for_timeout(150);name=f'{skin}-{view}.png';page.screenshot(path=str(OUT/'screens'/name));paths.append(name)
   page.locator('[data-view="edit"]').click();act('creation');act('creation-generate');page.wait_for_timeout(150);name=f'{skin}-creation.png';page.screenshot(path=str(OUT/'screens'/name));paths.append(name);act('creation-close')
  return paths
 run('B18-final-page-screens',visual)
 run('B19-no-uncaught-page-errors',lambda: (_ for _ in ()).throw(AssertionError(errors)) if errors else {'errors':[]})
 result={'date':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':browser.version,'sourceMode':'url'if args.url else'inline-production-html','scope':'Full production runtime. Fixture insertion uses same-document public commit. Pointer and keyboard interactions are actual Chromium inputs; B07 blur and B08 foreign drop are synthetic. No IndexedDB persistence claims in inline mode.','checks':results,'pageErrors':errors,'counts':{s:sum(x['status']==s for x in results)for s in ['PASS','FAIL']}}
 (OUT/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
print(json.dumps(result['counts']));raise SystemExit(1 if result['counts']['FAIL'] else 0)
