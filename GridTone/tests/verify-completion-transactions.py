"""Supplementary real production-controller transactions. Synthetic blur/drop are labelled."""
from pathlib import Path
import os,json,hashlib,time,traceback
from playwright.sync_api import sync_playwright
from design_harness import fixture
R=Path(__file__).resolve().parents[1];O=R/'docs/completion-2.2.1/evidence/transactions';O.mkdir(parents=True,exist_ok=True);H=(R/'dist/index.html').read_text();rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);p=b.new_page(viewport={'width':1440,'height':900});p.set_content(H);p.wait_for_function('window.GridToneApp');errors=[];p.on('pageerror',lambda e:errors.append(str(e)));fixture(p,open=False)
 setup="""()=>{const A=GridToneApp,l=A.library;A.playback.stop();l.open('rhythm');const items=A.shelf.all().filter(x=>x.type==='pattern'&&x.bars===4);l.multiIds=[items.find(x=>x.kind==='melodic').id,items.find(x=>x.kind==='drum').id];l.beginBatch('parallel');l.batch.bar=4;l.computeBatch();l.updateBatchPanel();return JSON.stringify(A.getProject());}"""
 for name,code in [('synthetic-window-blur-cancels',"""()=>{window.dispatchEvent(new Event('blur'));return !GridToneApp.library.batch&&GridToneApp.library.visible&&!document.querySelector('#batch-plan-panel');}"""),('external-and-mismatched-drop-never-commits',"""()=>{const l=GridToneApp.library,node=document.querySelector('.arrange-lane');l.batch.native=true;let d=new DataTransfer();d.setData('text/plain','external');node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d}));if(!l.batch)throw Error('External payload affected the batch');d=new DataTransfer();d.setData('application/x-legou-batch','expired-token');node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d}));return !l.batch&&l.visible;}""")]:
  before=p.evaluate(setup);ok=p.evaluate(code);assert ok and p.evaluate('JSON.stringify(GridToneApp.getProject())')==before;rows.append({'name':name,'status':'PASS','method':'synthetic window/DOM event with real production handlers; no OS event claim'})
 before=p.evaluate(setup);p.evaluate('GridToneApp.library.endBatch(false)');h=p.evaluate('GridToneApp.getHistory().undo');start=time.monotonic()
 for i in range(24):
  p.evaluate(setup);p.evaluate('GridToneApp.library.previewBatch()');p.wait_for_timeout(80);p.evaluate('GridToneApp.library.endBatch(false)');assert p.evaluate('GridToneApp.getHistory().undo')==h;assert p.evaluate('JSON.stringify(GridToneApp.getProject())')==before;assert p.evaluate('GridToneApp.engine.previewGraphs.size')==0
 rows.append({'name':'24-batch-audition-cancel-cycles','status':'PASS','method':'real controller + Web Audio, not physical user pointer benchmark','seconds':time.monotonic()-start,'cycles':24});assert not errors
 (O/'results.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(H.encode()).hexdigest(),'checks':rows,'pageErrors':errors,'status':'PASS','browser':b.version},indent=2));print('PASS',len(rows));b.close()
