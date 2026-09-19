"""Capture real production combinations for human/design review. No music mutation by CSS."""
import os,json,hashlib,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,fixture,gen
O=R/'docs/content-2.0/evidence/visual';O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/index.html').read_text();rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 for skin in ['crystal','pearl']:
  c=b.new_context(viewport={'width':1440,'height':900});p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content(html);p.wait_for_function('window.GridToneApp');p.wait_for_timeout(250);ev(p,'skin=>{GridTone.appearance.set({skin});GridToneApp.render()}',skin)
  def cap(name):
   p.wait_for_timeout(180);path=skin+'-'+name+'.png';p.screenshot(path=str(O/path));rows.append({'name':skin+'-'+name,'file':path,'width':p.viewport_size['width'],'height':p.viewport_size['height'],'pageErrors':list(errors)});print('CAP',path,flush=True)
  cap('home')
  ev(p,'GridToneApp.library.open("combo","studio.combo.city")');cap('combination')
  act(p,'library-variant','[data-id="studio.combo.city.ending"]');cap('combination-ending')
  ev(p,'GridToneApp.library.open("rhythm","studio.rhythm.hand-soul.1")');p.locator('.library-advanced summary').click();cap('human-rhythm-source')
  ev(p,'GridToneApp.library.open("sound","studio.fm.tine")');cap('fm-presets')
  p.locator('.library-advanced summary').click();cap('advanced-entry')
  act(p,'library-tweak');cap('advanced-voice');act(p,'close-modal');act(p,'library-close')
  act(p,'shelf-browse','[data-browse="used"]');cap('in-use-tray')
  fixture(p);act(p,'open-sound');cap('sound-adjustment-closed')
  # Native new sound underneath existing local generation and preview.
  ev(p,'''()=>{const A=GridToneApp,d=A.getProject(),s=A.materials.c.getSession(),t=d.tracks.find(t=>t.id===s.trackId);t.preset='studio.fm.harp';G=GridTone;G.pinDocument(d);A.materials.c.commit({project:d});}''');gen(p);cap('generation-projection')
  act(p,'view','[data-view="mix"]');cap('mix')
  act(p,'workspace-menu');act(p,'keyboard-settings');p.locator('[data-field="keymap-platform"]').select_option('mac');cap('keyboard');act(p,'close-modal');act(p,'view','[data-view="arrange"]')
  ev(p,'GridToneApp.library.open("sound","studio.va.silk")');p.set_viewport_size({'width':1024,'height':680});p.wait_for_timeout(250);ev(p,'GridToneApp.library.render()');cap('short-library')
  p.set_viewport_size({'width':900,'height':600});p.wait_for_timeout(250);ev(p,'GridToneApp.library.render()');cap('compact-library')
  p.set_viewport_size({'width':1440,'height':900});p.wait_for_timeout(250);ev(p,'GridToneApp.library.render()');p.locator('#studio-search').fill('不存在的声音');cap('empty-search')
  act(p,'library-reset');ev(p,'GridToneApp.library.open("combo","studio.combo.warm")');p.locator('[data-library-field="bar"]').fill('253');p.locator('[data-library-field="bar"]').press('Tab');act(p,'library-adopt');cap('range-error')
  c.close()
 report={'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'mode':'Real production HTML inline, seeded/public-API fixture; design review, not first-time-user certification.','captures':rows}
 (O/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
