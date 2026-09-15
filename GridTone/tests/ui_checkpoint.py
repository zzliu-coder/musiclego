from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/verification';OUT.mkdir(exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 p=b.new_page(viewport={'width':1440,'height':1000});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content((ROOT/'dist/index.html').read_text(),wait_until='load');p.wait_for_timeout(400)
 print(p.title(),p.locator('#toast').inner_text(),errors)
 assert p.locator('.view-tabs > [data-view]').count()==2
 assert p.locator('.arrange-track-head').count()==4
 assert p.locator('.track-list').count()==0
 p.locator('[data-action="toggle-sidebar"]').click();assert p.locator('.properties-sidebar').count()==1
 p.locator('[data-action="close-sidebar"]').click();assert p.locator('.properties-sidebar').count()==0
 p.screenshot(path=str(OUT/'02-arrange.png'))
 p.locator('[data-action="edit-clip"]').click();assert p.locator('#note-grid').count()==1
 p.locator('[data-tab="sound"]').click();assert p.locator('.sound-card').count()==18
 p.locator('[data-tab="pipeline"]').click();assert p.locator('.pipeline-editor').count()==1
 p.locator('[data-tab="notes"]').click();p.screenshot(path=str(OUT/'02-editor.png'))
 p.locator('.view-tabs [data-view="mix"]').click();assert p.locator('.mixer-channel').count()==4
 p.screenshot(path=str(OUT/'02-mix.png'))
 assert not errors, errors
 (OUT/'02-browser.json').write_text(json.dumps({'tests':9,'passed':9,'pageErrors':errors,'url':p.url},ensure_ascii=False,indent=2))
 b.close()
