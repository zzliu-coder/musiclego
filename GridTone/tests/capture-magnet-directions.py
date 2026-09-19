"""Same production document, same geometry: A/B/C surface-only comparison."""
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,fixture,gen
O=R/'docs/magnet-2.1/evidence/directions';O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/index.html').read_text();rows=[]
with sync_playwright() as w:
 b=w.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 c=b.new_context(viewport={'width':1440,'height':900});p=c.new_page();p.set_content(html);p.wait_for_function('GridToneApp');f=fixture(p,open=False)
 def caps(state):
  raw=ev(p,'JSON.stringify(GridToneApp.getProject())');gh=hashlib.sha256(raw.encode()).hexdigest();base=None
  for code,skin,direction in [('A','crystal',''),('B','crystal','clear'),('C','pearl','')]:
   ev(p,'x=>{GridTone.appearance.set({skin:x.skin});document.documentElement.dataset.direction=x.direction}',{'skin':skin,'direction':direction});p.wait_for_timeout(100)
   geom=p.locator('.topbar,#edit-command-bar,.view-content,.playback-footer,.studio-editor').evaluate_all('(xs)=>xs.map(e=>{const r=e.getBoundingClientRect();return[e.className,r.x,r.y,r.width,r.height]})')
   if base is None:base=geom
   assert geom==base and ev(p,'JSON.stringify(GridToneApp.getProject())')==raw
   file=f'{state}-{code}.png';p.screenshot(path=str(O/file));rows.append({'state':state,'direction':code,'documentHash':gh,'geometry':geom,'file':file,'sha256':hashlib.sha256((O/file).read_bytes()).hexdigest()})
 caps('01-arrange')
 ev(p,'f=>GridToneApp.openPattern({trackId:f.trackId,clipId:f.clipId,edit:true,activation:"notes"})',f);ev(p,'document.querySelector(".view-content").scrollTop=250');caps('02-editor')
 act(p,'close-editor');act(p,'shelf-filter','[data-filter="chords"]');tile=p.locator('.shelf-card').first.bounding_box();target=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').bounding_box();p.mouse.move(tile['x']+40,tile['y']+55);p.mouse.down();p.mouse.move(tile['x']+60,tile['y']+55,steps=3);p.mouse.move(target['x']+target['width']/2,target['y']+30,steps=18);p.wait_for_timeout(90);assert p.locator('[data-stage="projection"]').count();caps('03-placement');p.keyboard.press('Escape');p.mouse.up()
 f=fixture(p);gen(p);act(p,'creation-fit');ev(p,'document.querySelector(".view-content").scrollTop=280');p.wait_for_timeout(4000);caps('04-candidate')
 (O/'manifest.json').write_text(json.dumps({'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'screens':rows,'scope':'Same production document/state/geometry; B is only a comparison parameter, not a third production theme.'},ensure_ascii=False,indent=2));b.close()
