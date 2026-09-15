"""Capture every workspace in both desktop and narrow layouts; save evidence and geometry.
No screenshot changes the document or hides save errors. This is not WCAG certification.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil
R=Path(__file__).resolve().parents[1];O=R/'docs/prism/gallery';O.mkdir(exist_ok=True)
records=[];errors=[]
def luminance(rgb):
 s=[v/255 for v in rgb];l=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in s];return sum(v*w for v,w in zip(l,[.2126,.7152,.0722]))
def rgb(s):
 s=s.strip().lstrip('#');return [int(s[i:i+2],16) for i in [0,2,4]]
with sync_playwright() as w:
 b=w.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
 for width in [1440,1024,390]:
  c=b.new_context(viewport={'width':width,'height':900 if width>400 else 844},has_touch=width<400,is_mobile=width<400)
  p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content((R/'dist/index.html').read_text());p.wait_for_function('!!GridToneApp')
  def capture(name):
   p.wait_for_timeout(230);path=O/f'{width}-{name}.png';p.screenshot(path=str(path));v=p.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');assert v['scroll']<=v['w'],(name,v);records.append({'width':width,'view':name,'path':str(path.relative_to(R)),**v})
  capture('arrange');p.locator('[data-action=toggle-sidebar]').click();capture('properties');p.locator('[data-action=toggle-sidebar]').click()
  p.locator('[data-action=edit-clip]').click();capture('editor');p.locator('[data-action=composer]').click();capture('chords');p.locator('[data-action=close-modal]').last.click()
  p.locator('[data-tab=sound]').click();capture('sound');p.locator('[data-tab=pipeline]').click();capture('pipeline')
  p.locator('[data-field=editor-track]').select_option(p.evaluate('GridToneApp.getProject().tracks.find(x=>x.kind==="drum").id'));p.locator('[data-tab=notes]').click();capture('drums')
  p.locator('.view-tabs [data-view=mix]').click();capture('mix');p.locator('.workspace-actions [data-action=catalog]').click();capture('catalog');p.locator('[data-action=close-modal]').last.click()
  p.locator('[data-action=project-menu]').click();capture('project');p.locator('[data-action=close-modal]').last.click();p.locator('.top-actions [data-action=export]').click();capture('export');p.locator('[data-action=close-modal]').last.click()
  p.locator('[data-action=appearance]').click();capture('appearance');p.locator('[data-skin=pearl]').click();capture('pearl');p.locator('[data-action=close-modal]').last.click()
  if width==1440:
   contrasts=[]
   for skin in ['crystal','pearl']:
    p.evaluate('s=>GridTone.appearance.set({skin:s})',skin)
    cols=p.evaluate('Object.fromEntries(["--ink","--muted","--subtle","--surface","--grid-paper","--dark"].map(x=>[x,getComputedStyle(document.documentElement).getPropertyValue(x).trim()]))')
    rows=[]
    for text in ['--ink','--muted','--subtle']:
     a=luminance(rgb(cols[text]));z=luminance(rgb(cols['--surface']));ratio=(max(a,z)+.05)/(min(a,z)+.05);rows.append({'text':text,'background':'--surface','contrast':round(ratio,2)})
    assert all(x['contrast']>=4.5 for x in rows),rows
    contrasts.append({'skin':skin,'values':cols,'pairs':rows})
  c.close()
 assert not errors,errors
 (O/'review.json').write_text(json.dumps({'screens':records,'pageErrors':errors,'contrastPairs':contrasts,'scope':'Actual source screenshots and document overflow. Text contrast is only for listed semantic colors on an opaque surface, not every composited glass state. Not a whole-site WCAG audit.'},ensure_ascii=False,indent=2))
 print('PASS',len(records),'actual page captures; no document-level horizontal overflow');b.close()
