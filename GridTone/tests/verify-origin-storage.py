"""Real-origin persistence. Never replaced by inline/set_content validation."""
import argparse,hashlib,json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];O=R/os.environ.get('REPAIR_EVIDENCE_DIR','docs/workspace-1.8/evidence');a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8765');a.add_argument('--browser',default=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'));x=a.parse_args();r={'sha256':json.loads((R/'dist/manifest.json').read_text())['sha256'],'url':x.url,'status':'NOT_RUN','scope':'Actual browser-origin IndexedDB save/reload. No storage test double.'}
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=x.browser,headless=True,args=['--no-sandbox']);page=b.new_page();page.goto(x.url);page.wait_for_function('window.GridToneApp');page.wait_for_timeout(500)
  saved=page.evaluate('''async()=>{const G=GridTone,p=G.recipeProject('recipe.pop');p.title='真实来源保存核验';await GridToneApp.loadProject(p);await GridToneApp.flushSave();return GridToneApp.getProject()}''')
  page.reload();page.wait_for_function('window.GridToneApp');page.wait_for_function('GridToneApp.getProject().title==="真实来源保存核验"');got=page.evaluate('GridToneApp.getProject()');assert got==saved;r['status']='PASS';r['browser']=b.version;b.close()
except Exception as e:r.update(status='BLOCKED'if 'ERR_BLOCKED_BY_ADMINISTRATOR'in str(e)else'FAIL',reason=str(e))
(O/'origin-storage.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps(r,ensure_ascii=False));raise SystemExit(0 if r['status']=='PASS'else 2)
