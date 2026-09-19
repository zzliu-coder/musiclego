"""Detail-page completion: actual controls, existing document fixtures; no fabricated storage view."""
import json,hashlib
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,fixture,gen,note
O=R/'docs/magnet-2.1/evidence/detail-visual';O.mkdir(parents=True,exist_ok=True);html=(R/'dist/index.html').read_text();rows=[]
with sync_playwright() as w:
 b=w.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 for skin in ['crystal','pearl']:
  p=b.new_page(viewport={'width':1440,'height':900});p.set_default_timeout(6000);errs=[];p.on('pageerror',lambda e:errs.append(str(e)));p.set_content(html);p.wait_for_function('GridToneApp');ev(p,'s=>GridTone.appearance.set({skin:s})',skin)
  def shot(n):
   p.wait_for_timeout(100);f=O/(skin+'-'+n+'.png');p.screenshot(path=str(f));rows.append({'file':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'pageErrors':list(errs),'scope':'Actual detail controls and rendered state, fixtures by public API.'});print(f.name,flush=True)
  f=fixture(p);act(p,'open-sound');act(p,'inspector-tab','[data-panel="properties"]');shot('01-properties')
  act(p,'canvas-settings');shot('02-display-and-reference')
  note(p,f['noteIds'][0]);act(p,'edit-tools');shot('03-note-transforms')
  act(p,'note-inspector');shot('04-precise-comparison');act(p,'close-modal')
  act(p,'edit-tools');act(p,'transpose-dialog');shot('05-transpose');act(p,'close-modal')
  fixture(p,open=False);p.locator('[data-clip]').first.click();act(p,'edit-tools');shot('06-linked-clip-tools')
  act(p,'structure-tools');shot('07-arrangement-tools')
  fixture(p);act(p,'edit-tools');act(p,'creation',':not([data-mode])');
  l=p.locator('[data-action="harmony-editor"]').first
  for d in l.locator('xpath=ancestor::details').all():
   if d.get_attribute('open') is None:d.locator(':scope > summary').click()
  l.click();shot('08-harmony-checked-fields')
  l=p.locator('[data-harmony="start"]').first;l.fill('0.1');l.press('Tab');shot('09-harmony-error');act(p,'close-modal')
  act(p,'catalog');shot('10-catalog-management');act(p,'close-modal');p.close()
 (O/'manifest.json').write_text(json.dumps({'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'screens':rows},ensure_ascii=False,indent=2));b.close()
