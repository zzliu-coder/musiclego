"""Actual production screens and computed geometry inventory for final visual review."""
import json,hashlib,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,fixture,gen
O=R/'docs/magnet-2.1/evidence/final-visual';O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/index.html').read_text();rows=[]
def reveal(p,sel):
 l=p.locator(sel).first
 for d in l.locator('xpath=ancestor::details').all():
  if d.get_attribute('open') is None:d.locator(':scope > summary').click()
 return p.locator(sel).first
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 for skin in ['crystal','pearl']:
  c=b.new_context(viewport={'width':1440,'height':900});p=c.new_page();p.set_default_timeout(7000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html);p.wait_for_function('GridToneApp');ev(p,'skin=>GridTone.appearance.set({skin})',skin)
  def cap(name,scope='Real production controllers; fixtures via existing public API.'):
   p.wait_for_timeout(110);path=f'{skin}-{name}.png';p.screenshot(path=str(O/path));rows.append({'id':skin+'-'+name,'file':path,'size':p.viewport_size,'scope':scope,'pageErrors':list(errors),'sha256':hashlib.sha256((O/path).read_bytes()).hexdigest()});print('CAP',path,flush=True)
  try:
   cap('01-home');act(p,'shelf-filter','[data-filter="chords"]');cap('02-tiles')
   ev(p,'GridToneApp.library.open("combo","studio.combo.city")');cap('03-library-combination');act(p,'library-view');cap('04-library-list')
   ev(p,'GridToneApp.library.open("rhythm","studio.rhythm.hand-soul.1")');p.locator('.library-advanced summary').click();cap('05-rhythm-source')
   ev(p,'GridToneApp.library.open("sound","studio.fm.tine")');cap('06-library-sounds');p.locator('.library-advanced summary').click();act(p,'library-tweak');cap('07-advanced-sound');act(p,'close-modal')
   p.locator('#studio-search').fill('不存在的声音');cap('08-empty-search');act(p,'library-reset');ev(p,'GridToneApp.library.open("combo","studio.combo.warm")');p.locator('[data-library-field="bar"]').fill('253');p.locator('[data-library-field="bar"]').press('Tab');act(p,'library-adopt');cap('09-placement-error');act(p,'library-close')
   f=fixture(p);ev(p,'document.querySelector(".view-content").scrollTop=275');cap('10-note-editor');gen(p);act(p,'creation-fit');ev(p,'()=>{document.querySelector(".view-content").scrollTop=270;document.querySelector("#creation-dock").scrollTop=0}');cap('11-ready')
   ev(p,"()=>{const A=GridToneApp,d=A.getProject();d.tracks.at(-1).patterns[0].notes[0].pitch++;A.materials.c.commit({project:d});}");cap('12-stale')
   fixture(p);ev(p,'()=>{const A=GridToneApp,d=A.getProject();for(const t of d.tracks)for(const p of t.patterns)delete p.harmony;A.materials.c.commit({project:d});}');act(p,'edit-tools');act(p,'creation',':not([data-mode])');cap('13-missing-harmony')
   fixture(p);act(p,'edit-tools');act(p,'composer');cap('14-chord-progression');act(p,'open-sound');ev(p,'document.querySelector(".view-content").scrollTop=290');cap('15-sound-keyboard');ev(p,'document.querySelector("#creation-dock").scrollTop=850');cap('16-sound-presets');act(p,'inspector-tab','[data-panel="pipeline"]');cap('17-performance')
   did=ev(p,'GridToneApp.getProject().tracks.find(t=>t.kind==="drum").id');ev(p,'id=>GridToneApp.openPattern({trackId:id,edit:true,activation:"notes"})',did);act(p,'inspector-close');ev(p,'document.querySelector(".view-content").scrollTop=270');cap('18-drums')
   act(p,'view','[data-view="mix"]');cap('19-mix');act(p,'appearance');cap('20-appearance');act(p,'close-modal');act(p,'workspace-menu');act(p,'keyboard-settings');cap('21-keymap');act(p,'close-modal');act(p,'export');cap('22-export');act(p,'close-modal');act(p,'help');cap('23-help');act(p,'close-modal')
   act(p,'project-menu');p.wait_for_timeout(250);cap('24-storage-unavailable','Real origin restriction, persistent status and actual error; not a fabricated project list.');
   if p.locator('.modal').count():act(p,'close-modal')
   f=fixture(p);act(p,'open-sound');act(p,'record');cap('25-recording-permission','Real capture/permission UI without physical input-device claim.');
   if p.locator('.modal').count():act(p,'close-modal')
   f=fixture(p);gen(p);act(p,'creation-fit');p.set_viewport_size({'width':1100,'height':700});p.locator('[data-action="creation-apply"]').scroll_into_view_if_needed();cap('26-short-candidate');
   ev(p,'GridToneApp.library.open("sound","studio.va.silk")');cap('27-short-library');p.set_viewport_size({'width':720,'height':450});ev(p,'GridToneApp.library.render()');p.locator('[data-action="library-adopt"]').scroll_into_view_if_needed();cap('28-reflow-library','Viewport equivalent to 200% at1440; not native Chrome zoom.')
  except Exception as e:
   cap('99-sweep-error',str(e));raise
  finally:c.close()
 # Production component samples; A,B,C have one document and fixed geometry.
 p=b.new_page(viewport={'width':1440,'height':900});p.set_content((R/'components.html').read_text());p.wait_for_timeout(120)
 for selector,name in [('.gallery-heading','gallery-overview'),('.gallery-materials','gallery-materials'),('#gallery-result','gallery-candidate'),('.gallery-sound','gallery-sound'),('.gallery-notices','gallery-notices')]:
  p.locator(selector).scroll_into_view_if_needed();path=name+'.png';p.screenshot(path=str(O/path));rows.append({'id':name,'file':path,'scope':'Actual production components, isolated demo project; no audio or storage connected.'})
 (O/'manifest.json').write_text(json.dumps({'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'mode':'Full actual production HTML inline','screens':rows},ensure_ascii=False,indent=2));b.close()
