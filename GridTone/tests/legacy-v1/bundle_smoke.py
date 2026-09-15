from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 binary=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
 browser=p.chromium.launch(**({'executable_path':binary} if binary else {}),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050});errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.set_content((root/'dist/index.html').read_text(),wait_until='load');page.wait_for_timeout(500)
 assert page.locator('.view-tabs [data-view]').count()==4
 page.get_by_role('button',name='播放',exact=True).click();page.wait_for_timeout(800)
 assert page.evaluate('GridToneApp.engine.ctx.state==="running"&&GridToneApp.engine.playing')
 page.locator('button[data-action="stop"]').click()
 assert page.evaluate('GridToneApp.engine.position()===0')
 page.screenshot(path=str(root/'docs/desktop-editor.png'),full_page=True)
 for v in ['arrange','sound','mix']:
  page.locator(f'.view-tabs [data-view="{v}"]').click();page.screenshot(path=str(root/f'docs/desktop-{v}.png'),full_page=True)
 mobile=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 mobile.set_content((root/'dist/index.html').read_text(),wait_until='load');mobile.wait_for_timeout(500)
 assert mobile.evaluate('document.documentElement.scrollWidth===390')
 mobile.screenshot(path=str(root/'docs/mobile-editor.png'),full_page=True)
 assert not errors and not requests
 result={'compiledHTML':True,'boot':True,'playWithNormalGesturePolicy':True,'stop':True,'mobileWidth':390,'uncaughtErrors':errors,'externalRequests':requests}
 (root/'docs/bundle-smoke-results.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result));browser.close()
