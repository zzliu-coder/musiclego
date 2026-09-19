"""Final production screenshots of newly unified flows. No visual mockups or replaced DOM."""
from pathlib import Path
import os,json,hashlib,traceback
from playwright.sync_api import sync_playwright
from design_harness import fixture,act,ev,gen
R=Path(__file__).resolve().parents[1];O=R/'docs/completion-2.2.1/evidence/visual';O.mkdir(parents=True,exist_ok=True);H=(R/'dist/index.html').read_text();checks=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def shot(name,fn,skin='crystal',size=(1440,900)):
  ctx=b.new_context(viewport=dict(width=size[0],height=size[1]));p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_default_timeout(8000)
  try:
   p.set_content(H);p.wait_for_function('window.GridToneApp');ev(p,'skin=>GridTone.appearance.set({skin})',skin);p.wait_for_timeout(180);fn(p);p.wait_for_timeout(90);assert not errors,errors;p.screenshot(path=str(O/(name+'.png')));checks.append(dict(name=name,status='CAPTURED',skin=skin,size=size,pageErrors=errors));print('CAPTURED',name,flush=True)
  except Exception as e:checks.append(dict(name=name,status='FAIL',error=str(e),trace=traceback.format_exc()));p.screenshot(path=str(O/(name+'-failure.png')));print('FAIL',name,str(e)[:160],flush=True)
  ctx.close()
 def lib(p,kind='all'):
  fixture(p,open=False);act(p,'library-open');act(p,'library-kind',f'[data-kind="{kind}"]')
 def current_params(p):
  fixture(p);act(p,'open-sound');p.locator('#creation-dock details summary').click();act(p,'sound-full')
 def sounds(p):
  fixture(p);act(p,'open-sound');p.locator('#creation-dock [data-kind="sound"]').click()
 def resources(p):
  fixture(p);act(p,'open-sound');p.locator('#creation-dock details summary').click();act(p,'sound-resources')
 def batch(p,mode='parallel',invalid=False):
  f=fixture(p,open=False);ev(p,"f=>{const A=GridToneApp,d=A.getProject();d.bars=16;A.materials.c.commit({project:d});A.materials.c.getSession().arrangeCursor={trackId:f.trackId,tick:4*GridTone.BAR};A.render()}",f)
  act(p,'library-open');ev(p,"mode=>{const A=GridToneApp,items=A.shelf.all().filter(x=>x.type==='pattern'&&x.bars===4),ms=items.filter(x=>x.kind==='melodic');A.library.multiIds=mode==='parallel'?[ms[0].id,items.find(x=>x.kind==='drum').id]:[ms[0].id,ms[1].id];A.library.render()}",mode);act(p,'library-batch',f'[data-mode="{mode}"]');p.locator('[data-batch-field="bar"]').fill('5' if not invalid else '1');p.locator('[data-batch-field="bar"]').press('Tab');
  if mode=='parallel':
   d=ev(p,'GridToneApp.getProject()');drum=next(t for t in d['tracks'] if t['kind']=='drum');p.locator('[data-batch-field="target"][data-index="0"]').select_option(f['trackId']);p.locator('[data-batch-field="target"][data-index="1"]').select_option(drum['id'])
 def examples(p):lib(p,'example')
 def collection(p,kind):lib(p);act(p,'library-collection',f'[data-collection="{kind}"]')
 def seven(p):
  f=fixture(p,bars=8);ev(p,"f=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks.find(t=>t.id===f.trackId);d.tracks=[t];d.bars=8;t.patterns[0].notes=[G.newNote(60,4*G.BAR,4*G.BAR)];A.materials.c.commit({project:d});const r=G.editSongTime(A.getProject(),{startBar:0,endBar:1,kind:'delete'});A.materials.c.commit(r);A.openPattern({trackId:t.id,clipId:t.clips[0].id,edit:true,activation:'notes'});}",f);p.locator('#gridframe').scroll_into_view_if_needed()
 shot('01-workspace',lambda p:fixture(p,open=False))
 shot('02-complete-template-library',lambda p:lib(p))
 shot('03-pending-collection',lambda p:collection(p,'tray'))
 shot('04-five-original-examples',examples)
 shot('05-only-sound-chooser',sounds)
 shot('06-current-sound-parameters',current_params)
 shot('07-sound-resources',resources)
 shot('08-parallel-existing-targets',lambda p:batch(p))
 shot('09-series-plan',lambda p:batch(p,'series'))
 shot('10-batch-conflict',lambda p:batch(p,'parallel',True))
 shot('11-short-parallel-plan',lambda p:batch(p),'pearl',(1100,700))
 shot('12-seven-bar-continuous-note',seven)
 shot('13-generation-comparison',lambda p:(fixture(p),gen(p)))
 shot('14-mixing-preserved',lambda p:(fixture(p,open=False),p.locator('[data-view="mix"]').click()))
 shot('15-pearl-template-library',lambda p:lib(p),'pearl')
 shot('16-short-library',lambda p:lib(p),'crystal',(1100,700))
 shot('17-short-parameters',current_params,'pearl',(1280,800))
 result=dict(version='2.2.1',htmlSha256=hashlib.sha256(H.encode()).hexdigest(),browser=b.version,environment='Linux Chromium, full production HTML set_content',checks=checks);(O/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
raise SystemExit(any(c['status']=='FAIL' for c in checks))
