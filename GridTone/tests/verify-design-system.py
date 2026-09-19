"""1.9 interaction system: real Chromium DOM, pointer/key actions, actual music assertions.
Fixtures use the existing public API; all controls use production controllers.
No sub-agent, native Safari, physical-device or first-time-human claim.
"""
import os,json,hashlib,time,traceback,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import *
from design_harness import gen as generate_without_fit
def gen(p):
 generate_without_fit(p);act(p,'creation-fit')
O=R/os.environ.get('DESIGN_EVIDENCE_DIR','docs/design-1.9/evidence/design-browser');(O/'screens').mkdir(parents=True,exist_ok=True)
html=(R/'dist/index.html').read_text();checks=[]
def reveal(p,sel):
 loc=p.locator(sel).first
 for d in loc.locator('xpath=ancestor::details').all():
  if d.get_attribute('open') is None:d.locator(':scope > summary').click()
 return p.locator(sel).first

def field(p,key,val):
 l=reveal(p,f'[data-field="creation-{key}"]')
 if l.evaluate('(el)=>el.tagName')=='SELECT':l.select_option(str(val))
 else:l.fill(str(val));l.press('Tab')

def bare(p):return ev(p,'JSON.stringify(GridToneApp.getProject())')
def history(p):return ev(p,'GridToneApp.getHistory().undo')
def candidate(p):return ev(p,'GridToneApp.creation.session.candidates[GridToneApp.creation.session.chosen]')
def compare_recipe_music(p):return ev(p,'JSON.stringify(GridTone.compileSong(GridToneApp.getProject()).events.map(n=>[n.pitch,n.start,n.duration,n.velocity,n.trackId]))')

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def run(name,fn):
  c=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=c.new_page();p.set_default_timeout(8000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));start=time.monotonic()
  try:
   p.set_content(html,wait_until='load');p.wait_for_function('window.GridToneApp');p.wait_for_timeout(160)
   detail=fn(p);assert not errors,errors;checks.append({'id':name,'status':'PASS','seconds':round(time.monotonic()-start,3),'detail':detail});print('PASS',name,flush=True)
  except Exception as e:
   checks.append({'id':name,'status':'FAIL','message':str(e),'trace':traceback.format_exc(),'pageErrors':errors});print('FAIL',name,str(e)[:500],flush=True)
  finally:
   p.screenshot(path=str(O/'screens'/f'{name}.png'));c.close()
 def home(p):
  assert p.locator('.workspace-tabs button').all_text_contents()==['编排','混音'];assert not p.locator('#candidate-overlay-status').is_visible();assert 0<p.locator('.music-block[data-stage="shelf"]').count()<=12 # 2.0: bounded session tray replaces the entire catalog
  assert not p.locator('.shelf-card').first.get_attribute('data-material-type')=='song'
  return {'firstMaterial':p.locator('.shelf-card').first.inner_text()}
 run('DB01-workbench-home-and-hidden-projection',home)
 def blocks(p):
  d=bare(p);act(p,'shelf-filter','[data-filter="recipe"]');assert p.locator('.shelf-card').count()==12 # 2.0: first page includes old eight + new families; complete browser exposes all
  counts=p.locator('.block-composition').all_text_contents();assert all('5 轨' in x for x in counts)
  act(p,'shelf-filter','[data-filter="song"]');assert all(x=='false' for x in p.locator('.shelf-card').evaluate_all('(els)=>els.map(e=>e.getAttribute("draggable"))'))
  act(p,'shelf-open-song');assert p.locator('.modal').count()==1;assert '新建' in p.locator('.modal').inner_text();act(p,'close-modal');assert bare(p)==d
  return counts
 run('DB02-combinations-real-lanes-examples-separate',blocks)
 def favorite(p):
  f=fixture(p,open=False);before=bare(p);id=p.locator('.shelf-card').first.get_attribute('data-shelf-id');act(p,'shelf-favorite',f'[data-id="{id}"]');act(p,'shelf-browse','[data-browse="favorites"]');assert p.locator('.shelf-card').count()==1;act(p,'shelf-browse','[data-browse="tray"]') # 2.0: return to the compact tray
  p.locator('[data-field="shelf-search"]').fill('没有这个材料xxxxxxxx');assert p.locator('.shelf-card').count()==0;assert '匹配' in p.locator('.shelf-cards').inner_text();assert bare(p)==before
 run('DB03-browse-favorites-search-no-music-write',favorite)
 def pick(p):
  f=fixture(p,open=False);before=bare(p);id=p.locator('.shelf-card').first.get_attribute('data-shelf-id');act(p,'shelf-pick',f'[data-id="{id}"]');assert p.locator('.is-picked').count()==1;assert bare(p)==before;p.keyboard.press('Escape');assert p.locator('.is-picked').count()==0;assert bare(p)==before
 run('DB04-pick-and-cancel-state-separate-from-source',pick)
 def shelf_listen(p):
  fixture(p,open=False);before=bare(p);id=p.locator('.shelf-card').first.get_attribute('data-shelf-id');act(p,'shelf-preview',f'[data-id="{id}"]');p.wait_for_timeout(250);assert ev(p,'GridToneApp.engine.playing');assert p.locator(f'.shelf-card[data-shelf-id="{id}"]').get_attribute('class').find('is-auditioning')>=0;assert p.locator(f'[data-action="shelf-preview"][data-id="{id}"]').get_attribute('aria-label').startswith('停止试听');assert bare(p)==before;act(p,'stop');p.wait_for_timeout(350);assert p.locator('.is-auditioning').count()==0;assert bare(p)==before
 run('DB05-template-preview-playing-state-and-stop',shelf_listen)
 def click_place(p):
  f=fixture(p,open=False);act(p,'shelf-filter','[data-filter="melody"]');card=p.locator('.shelf-card').first;name=card.locator('.block-name').inner_text();card.locator('[data-action="shelf-pick"]').click();before=history(p);p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').click();assert history(p)==before+1;d=ev(p,'GridToneApp.getProject().tracks.at(-1)');assert len(d['clips'])==2;pat=next(x for x in d['patterns'] if x['id']==d['clips'][-1]['patternId']);assert pat['name']==name;assert d['clips'][-1]['bar']==4;act(p,'undo');assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.length')==1
 run('DB06-click-placement-continuous-name-and-single-undo',click_place)
 def drag(p):
  f=fixture(p,open=False);act(p,'shelf-filter','[data-filter="melody"]');card=p.locator('.shelf-card').first;source=card.locator('.shelf-card-pick');target=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]');source.scroll_into_view_if_needed();target.scroll_into_view_if_needed();a=source.bounding_box();z=target.bounding_box();before=history(p);p.mouse.move(a['x']+30,a['y']+30);p.mouse.down();p.mouse.move(a['x']+50,a['y']+35,steps=5);p.mouse.move(z['x']+z['width']/2,z['y']+25,steps=18);p.wait_for_timeout(120);p.screenshot(path=str(O/'screens'/'drag-real-ghost.png'));assert p.locator('.shelf-drop-ghost').count()>0;assert '小节' in p.locator('.shelf-drop-ghost').first.inner_text();p.mouse.up();p.wait_for_timeout(160);assert history(p)==before+1;assert p.locator('.block-in-hand').count()==0;assert p.locator('.shelf-drop-ghost').count()==0
 run('DB07-native-mouse-drag-real-range-ghost',drag)
 def invalid_drop(p):
  f=fixture(p,open=False);before=bare(p);act(p,'shelf-filter','[data-filter="melody"]');id=p.locator('.shelf-card').first.get_attribute('data-shelf-id');act(p,'shelf-pick',f'[data-id="{id}"]');p.locator(f'.empty-bar[data-track="{f["sourceTrackId"]}"][data-bar="0"]').dispatch_event('drop',{'dataTransfer':None});assert bare(p)==before;p.evaluate('window.dispatchEvent(new Event("blur"))');assert ev(p,'GridToneApp.shelf.activePlacement') is None;assert bare(p)==before
 run('DB08-synthetic-external-drop-blur-no-write',invalid_drop)
 def missing(p):
  f=fixture(p);ev(p,'()=>{const A=GridToneApp,d=A.getProject();for(const t of d.tracks)for(const pat of t.patterns)delete pat.harmony;A.materials.c.commit({project:d});}');act(p,'edit-tools');act(p,'creation',':not([data-mode])');before=bare(p);assert p.locator('[data-action="creation-generate"]').is_disabled();assert p.locator('[data-action="creation-pick-chords"]').is_visible();act(p,'creation-pick-chords');assert ev(p,'GridToneApp.shelf.filter')=='chords';assert bare(p)==before
 run('DB09-missing-harmony-preflight-and-direct-next-action',missing)
 def prepare(p):
  fixture(p);act(p,'edit-tools');act(p,'creation',':not([data-mode])');assert p.locator('.task-choice').count()==3;assert not p.locator('[data-field="creation-low"]').is_visible();assert not p.locator('[data-field="creation-seed"]').is_visible();assert p.locator('[data-action="creation-generate"]').inner_text()=='做几版';assert '跟随和弦' in p.locator('.context-card').inner_text()
 run('DB10-task-first-advanced-collapsed',prepare)
 def result(p):
  fixture(p);before=bare(p);h=history(p);gen(p);assert bare(p)==before and history(p)==h;assert p.locator('[data-action="creation-apply"]').get_attribute('data-variant')=='primary';assert p.locator('[data-action="creation-generate"]').get_attribute('data-variant')=='quiet';assert ev(p,'document.querySelector(".candidate-bar").getBoundingClientRect().top<document.querySelector("#creation-tuning").getBoundingClientRect().top');assert p.locator('#candidate-projection rect').count()>0;assert p.locator('#candidate-projection [data-note],#candidate-projection [data-resize]').count()==0;assert p.locator('#candidate-overlay-status').is_visible()
 run('DB11-results-first-primary-adopt-and-readonly-overlay',result)
 def comparison(p):
  fixture(p);gen(p);before=bare(p);n=p.locator('.candidate-bar [data-action="creation-choose"]').count();assert 1<=n<=3
  stats=[]
  for i in range(n):act(p,'creation-choose',f'[data-index="{i}"]');stats.append(p.locator('.candidate-stats').inner_text());assert p.locator('#candidate-projection rect').count()>0
  act(p,'creation-overlay','[data-overlay="original"]');assert p.locator('#candidate-projection rect').count()==0;act(p,'creation-overlay','[data-overlay="candidate"]');assert p.locator('#candidate-projection rect').count()>0;act(p,'creation-fit');assert bare(p)==before;return stats
 run('DB12-change-variants-stable-coordinate-and-view-only-fit',comparison)
 def preview_adopt(p):
  fixture(p);before=bare(p);gen(p);r=candidate(p);act(p,'creation-preview');p.wait_for_timeout(180);assert ev(p,'GridToneApp.playback.auditionScope.range')==r['outputRange'];assert bare(p)==before;act(p,'creation-preview-original');p.wait_for_timeout(180);assert ev(p,'GridToneApp.playback.auditionScope.range')==r['outputRange'];assert ev(p,'GridToneApp.playback.auditionProject.tracks.at(-1).patterns[0].notes')==json.loads(before)['tracks'][-1]['patterns'][0]['notes'];act(p,'stop');h=history(p);act(p,'creation-apply');assert history(p)==h+1;assert p.locator('#candidate-projection rect').count()==0;act(p,'undo');assert bare(p)==before
 run('DB13-original-candidate-audio-range-apply-once',preview_adopt)
 def stale(p):
  f=fixture(p);gen(p);field(p,'color','diatonic');act(p,'creation-generate');assert p.locator('#candidate-projection rect').count()>0;ev(p,'()=>{const A=GridToneApp,d=A.getProject();d.key=(d.key+1)%12;A.materials.c.commit({project:d});}');assert p.locator('[data-action="creation-apply"]').count()==0;assert p.locator('#candidate-projection rect').count()==0;assert ev(p,'GridToneApp.creation.session.flow.state')=='stale';assert '变化' in p.locator('.inline-notice').inner_text()
 run('DB14-relevant-change-persistent-stale-no-old-apply',stale)
 def target(p):
  f=fixture(p);gen(p);cid=candidate(p)['candidateId'];p.locator(f'[data-clip="{f["sourceClipId"]}"]').click();assert p.locator('[data-action="creation-apply"]').is_disabled();assert p.locator('#candidate-projection rect').count()==0;act(p,'creation-return');assert candidate(p)['candidateId']==cid;assert not p.locator('[data-action="creation-apply"]').is_disabled();assert p.locator('#candidate-projection rect').count()>0
 run('DB15-target-return-recovers-same-candidate',target)
 def keeps(p):
  f=fixture(p);note(p,f['noteIds'][0]);gen(p);act(p,'creation-keep','[data-keep="all"]');assert p.locator('[data-action="creation-apply"]').count()==0;act(p,'creation-generate');assert p.locator('#candidate-projection [data-state="retained"]').count()>0;assert '保留 1 音' in p.locator('.context-card').inner_text();orig=ev(p,'GridToneApp.getProject().tracks.at(-1).patterns[0].notes[0]');pat=candidate(p)['project']['tracks'][-1]['patterns'][-1];assert any(n['id']==orig['id'] and n==orig for n in pat['notes'])
 run('DB16-retain-selected-with-distinct-projection-mark',keeps)
 def mode(p):
  fixture(p);gen(p);field(p,'intent','ending');reveal(p,'[data-action="creation-mode-choice"][data-mode="rhythm"]').click();act(p,'creation-generate');r=candidate(p);original=ev(p,'GridToneApp.getProject().tracks.at(-1).patterns[0].notes');tr=next(t for t in r['project']['tracks'] if t['id']==r['trackId']);pat=next(pat for pat in tr['patterns'] if pat['id']==r['patternId']);assert sorted((n['start'],n['duration']) for n in original)==sorted((n['start'],n['duration']) for n in pat['notes'])
 run('DB17-mode-switch-no-hidden-intent-mutation',mode)
 def time_input(p):
  fixture(p);gen(p);field(p,'start','0.1');assert p.locator('[data-action="creation-generate"]').is_disabled();assert p.locator('[data-action="creation-open-options"]').is_visible();assert p.locator('[data-action="creation-apply"]').count()==0;field(p,'start','1.1');assert not p.locator('[data-action="creation-generate"]').is_disabled();field(p,'end','4.1');assert p.locator('[data-action="creation-generate"]').is_disabled();assert '连续 4 或 8' in p.locator('.inline-notice').inner_text()
 run('DB18-human-range-roundtrip-invalid-states',time_input)
 def harmony(p):
  fixture(p);act(p,'edit-tools');act(p,'creation',':not([data-mode])');reveal(p,'[data-action="harmony-editor"]').click();assert p.locator('.modal').count();assert p.locator('.harmony-events label:not(.form-label)').count()==0;assert p.locator('.harmony-events .form-label').first.evaluate('e=>getComputedStyle(e).flexDirection')=='column';select=p.locator('[data-harmony="quality"]').first;assert not any(x in ['major','min7','halfDim'] for x in select.locator('option').all_text_contents());start=p.locator('[data-harmony="start"]').first;assert start.input_value()=='1.1';before=bare(p);start.fill('0.1');start.press('Tab');assert p.locator('[data-action="harmony-confirm"]').is_disabled();select.select_option('major');assert p.locator('[data-action="harmony-confirm"]').is_disabled();assert bare(p)==before;start.fill('1.1');start.press('Tab');assert not p.locator('[data-action="harmony-confirm"]').is_disabled();act(p,'close-modal');assert bare(p)==before
 run('DB19-harmony-human-quality-and-multi-invalid-guard',harmony)
 def chord_adopt(p):
  fixture(p);act(p,'edit-tools');act(p,'composer');label=p.locator('[data-action="composer-apply"]').inner_text();assert label.startswith('放入') or label.startswith('替换');assert not label.startswith('生成');assert '尚未' in p.locator('#creation-dock').inner_text() or '试听' in p.locator('#creation-dock').inner_text()
 run('DB20-composer-verb-distinguishes-calculation-commit',chord_adopt)
 def pan(p):
  f=fixture(p);p.locator(f'.arrange-track-name[data-id="{f["trackId"]}"]').click();l=p.locator('#creation-dock input[data-range="track.pan"]');assert '居中' in l.locator('xpath=..').inner_text();l.focus();l.press('ArrowRight');assert '右 ' in l.locator('xpath=..').inner_text()
 run('DB21-pan-initial-and-live-use-same-formatter',pan)
 def styles(p):
  f=fixture(p);sel=p.locator('[data-action="shelf-preview"]').first;a=sel.evaluate('(e)=>{const s=getComputedStyle(e);return [s.fontSize,s.minHeight,s.paddingTop,s.paddingRight,s.lineHeight,s.borderRadius]}');act(p,'open-sound');l=p.locator('#creation-dock [data-action="sound-audition"]').first;b_=l.evaluate('(e)=>{const s=getComputedStyle(e);return [s.fontSize,s.minHeight,s.paddingTop,s.paddingRight,s.lineHeight,s.borderRadius]}');assert a==b_,[a,b_];act(p,'edit-tools');act(p,'creation',':not([data-mode])');act(p,'creation-generate');c_=p.locator('[data-action="creation-preview-solo"]').evaluate('(e)=>{const s=getComputedStyle(e);return [s.fontSize,s.minHeight,s.paddingTop,s.paddingRight,s.lineHeight,s.borderRadius]}');assert a==c_,[a,c_];return {'shelf':a,'sound':b_,'candidate':c_}
 run('DB22-same-small-preview-components-measure-identical',styles)
 def contrast(p):
  fixture(p);act(p,'edit-tools');act(p,'creation',':not([data-mode])');samples=[]
  js='''e=>{const ctx=document.createElement('canvas').getContext('2d');function rgba(v){ctx.clearRect(0,0,1,1);ctx.fillStyle=v;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);}function blend(a,b){const alpha=a[3]/255;return [0,1,2].map(i=>a[i]*alpha+b[i]*(1-alpha)).concat(255);}const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);let bg=[255,255,255,255];for(const n of chain)bg=blend(rgba(getComputedStyle(n).backgroundColor),bg);const fg=blend(rgba(getComputedStyle(e).color),bg);function L(rgb){return rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}const a=L(fg),b=L(bg);return {text:e.innerText,fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),font:getComputedStyle(e).fontSize};}'''
  for skin in ['crystal','pearl']:
   ev(p,'skin=>GridTone.appearance.set({skin})',skin)
   for selector in ['[data-action="creation-generate"]','.workspace-tabs .active','.task-choice[aria-pressed="true"]']:
    loc=p.locator(selector).first;loc.scroll_into_view_if_needed()
    for state in ['normal','hover','focus']:
     if state=='hover':loc.hover()
     elif state=='focus':loc.focus()
     else:p.mouse.move(5,5)
     v=loc.evaluate(js);assert v['ratio']>=4.5,(skin,state,selector,v);samples.append({'skin':skin,'state':state,'selector':selector,**v})
  return samples
 run('DB23-two-theme-normal-hover-focus-text-contrast',contrast)
 def keyboard(p):
  f=fixture(p);note(p,f['noteIds'][0]);before=bare(p);l=p.locator('[data-field="shelf-search"]');l.fill('测试');l.press('Control+a');l.press('Backspace');assert bare(p)==before;p.locator('#edit-command-bar [data-command="copy"]').focus();p.keyboard.press('Enter');assert bare(p)==before;assert ev(p,'GridToneApp.getState().editClipboard.kind')=='notes'
 run('DB24-keyboard-focus-does-not-steal-edit-target',keyboard)
 def reduce(p):
  f=fixture(p);gen(p);before=bare(p);ev(p,'GridTone.appearance.set({motion:"reduced"})');v=p.locator('[data-action="creation-apply"]').evaluate('e=>({duration:getComputedStyle(e).transitionDuration,anim:getComputedStyle(e).animationName})');assert v['duration']=='0s' and v['anim']=='none';assert p.locator('#candidate-projection rect').count()>0;assert bare(p)==before;return v
 run('DB25-reduced-motion-retains-meaningful-state',reduce)
 def saves(p):
  fixture(p);p.wait_for_timeout(700);assert p.locator('#storage-status').is_visible();assert '失败' in p.locator('#storage-status').inner_text() or '不可用' in p.locator('#storage-status').inner_text();assert p.locator('#save-status-actions').is_visible();assert p.locator('#save-status-actions [data-action="export-project"]').count()==1;act(p,'project-menu');p.wait_for_timeout(150);assert '本机存储' in p.locator('#toast').inner_text();assert 'IDBFactory' not in p.locator('#toast').inner_text()
 run('DB26-inline-origin-save-failure-has-persistent-recovery',saves)
 def compatibility(p):
  fixture(p);before=compare_recipe_music(p);act(p,'appearance');act(p,'choose-skin','[data-skin="pearl"]');act(p,'close-modal');act(p,'view','[data-view="mix"]');act(p,'view','[data-view="arrange"]');act(p,'shelf-toggle');act(p,'open-sound');act(p,'inspector-close');assert compare_recipe_music(p)==before;assert ev(p,'GridTone.validateProject(GridToneApp.getProject()).version')==3
 run('DB27-theme-panel-layout-preserves-musical-events',compatibility)
 def short(p):
  f=fixture(p);gen(p);rows=[]
  for w,h in [(1440,900),(1280,720),(1100,670),(1920,1080)]:
   for skin in ['crystal','pearl']:
    p.set_viewport_size({'width':w,'height':h});ev(p,'skin=>GridTone.appearance.set({skin})',skin);p.wait_for_timeout(130);act(p,'creation-fit');loc=p.locator('[data-action="creation-apply"]');loc.scroll_into_view_if_needed();bb=loc.bounding_box();got=loc.evaluate('(e)=>{const r=e.getBoundingClientRect(),n=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return n===e||e.contains(n)}');assert got;assert ev(p,'document.documentElement.scrollWidth')<=w;assert 0<=p.locator('.topbar').bounding_box()['y']<=12;p.screenshot(path=str(O/'screens'/f'composition-{w}-{h}-{skin}.png'));rows.append({'width':w,'height':h,'skin':skin,'apply':bb})
  return rows
 run('DB28-eight-final-candidate-combinations-short-window',short)
 def gallery(p):
  p.set_content((R/'components.html').read_text());assert p.locator('[id^="example-command-"]').count()==5;assert p.locator('#gallery-prepare .task-choice').count()==3;assert p.locator('#gallery-result .candidate-bar').count()==1;p.locator('[data-gallery-skin="pearl"]').click();assert ev(p,'document.documentElement.dataset.skin')=='pearl';p.locator('#gallery-result').scroll_into_view_if_needed();p.screenshot(path=str(O/'screens'/'gallery-compositions.png'))
 run('DB29-production-gallery-actual-creation-and-targets',gallery)
 def projection_edit(p):
  f=fixture(p);gen(p);# A real edit to original invalidates projection, never edits a projected object.
  loc=p.locator(f'#note-layer [data-note="{f["noteIds"][0]}"] .note-body');loc.scroll_into_view_if_needed();loc.click();p.locator('#gridframe').press('ArrowUp');assert ev(p,'GridToneApp.getProject().tracks.at(-1).patterns[0].notes[0].pitch')==61;assert p.locator('[data-action="creation-apply"]').count()==0;assert p.locator('#candidate-projection rect').count()==0
 run('DB30-readonly-projection-still-allows-explicit-original-edit',projection_edit)
 def extra_panels(p):
  fixture(p);act(p,'edit-tools');act(p,'composer');reveal(p,'[data-field="composer-rhythm"]').select_option('arp');p.screenshot(path=str(O/'screens'/'composer-ready.png'));act(p,'open-sound');p.screenshot(path=str(O/'screens'/'sound-ready.png'));act(p,'inspector-tab','[data-panel="pipeline"]');p.screenshot(path=str(O/'screens'/'performance-ready.png'));act(p,'view','[data-view="mix"]');p.screenshot(path=str(O/'screens'/'mix-ready.png'));act(p,'export');assert '作品文件' in p.locator('.modal').inner_text();p.screenshot(path=str(O/'screens'/'export-ready.png'));act(p,'close-modal');return '实际生产视图'
 run('DB31-whole-product-panel-copy-and-composition',extra_panels)
 def search_component(p):
  fixture(p);act(p,'open-sound');l=p.locator('#sound-search');r=l.locator('xpath=..');values=r.evaluate('(el)=>({display:getComputedStyle(el).display,inputBorder:getComputedStyle(el.querySelector("input")).borderTopWidth})');assert values=={'display':'flex','inputBorder':'0px'};before=bare(p);l.fill('钟');assert bare(p)==before;return values
 run('DB32-search-component-is-one-control-in-tool-slot',search_component)
 def sticky_context(p):
  fixture(p);gen(p);reveal(p,'[data-field="creation-low"]');p.locator('[data-field="creation-low"]').scroll_into_view_if_needed();head=p.locator('.creation-dock-heading');assert '块内 第 1—4 小节' in head.inner_text();r=head.bounding_box();dock=p.locator('#creation-dock').bounding_box();assert r['y']>=dock['y']-2 and r['y']<dock['y']+20
 run('DB33-tool-context-remains-visible-when-scrolled',sticky_context)
 def combo_preview(p):
  fixture(p);ev(p,'()=>GridToneApp.creation.open("recipe")');ev(p,'()=>{GridToneApp.materials.c.getSession().rightPanel="creation";GridToneApp.render();}');act(p,'creation-generate');assert '5 条音轨' in p.locator('.candidate-stats').inner_text();assert p.locator('.candidate-preview .block-score').count()==1;before=bare(p);act(p,'creation-preview-original');p.wait_for_timeout(120);assert bare(p)==before;act(p,'stop')
 run('DB34-combination-candidate-real-multitrack-preview',combo_preview)
 result={'version':json.loads((R/'package.json').read_text())['version'],'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'mode':'Production HTML via set_content; public API fixtures, real button/keyboard/mouse paths; DB08 synthetic blur/drop explicitly labelled.','checks':checks,'counts':{k:sum(c['status']==k for c in checks)for k in ['PASS','FAIL']},'subagents':'NOT_AVAILABLE; these processes are automated tests, not independent AI agents','external':'No native macOS Safari, first-time human, physical mic, real-origin persistence or listening certification'}
 (O/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(result['counts'],flush=True);b.close()
raise SystemExit(1 if any(c['status']=='FAIL'for c in checks)else 0)
