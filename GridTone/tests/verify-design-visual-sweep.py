"""Final production visual sweep. Fixtures use existing API; screenshots are actual HTML."""
import sys,json,hashlib,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import fixture,act,gen,ev
R=Path(__file__).resolve().parents[1];O=R/'docs/design-1.9/evidence/final-visual';O.mkdir(parents=True,exist_ok=True)
def reveal(p,sel):
 loc=p.locator(sel).first
 for d in loc.locator('xpath=ancestor::details').all():
  if d.get_attribute('open') is None:d.locator(':scope > summary').click()
 return p.locator(sel).first
manifest=json.loads((R/'dist/manifest.json').read_text());records=[];errors=[]
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);c=b.new_context(viewport={'width':1440,'height':1000});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content((R/'dist/index.html').read_text(),wait_until='load');p.wait_for_function('window.GridToneApp');p.wait_for_timeout(250)
 def shot(name,note):
  p.wait_for_timeout(90);f=O/(name+'.png');p.screenshot(path=str(f));records.append({'id':name,'file':f.name,'note':note,'imageSha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 fixture(p);gen(p);act(p,'creation-fit');ev(p,"()=>{document.querySelector('.view-content').scrollTop=210;document.querySelector('#creation-dock').scrollTop=0}");shot('01-scheme-crystal','同一画板坐标中原稿与只读方案；右侧结果与采用。')
 ev(p,"()=>GridTone.appearance.set({skin:'pearl'})");shot('02-scheme-pearl','暖白皮肤使用相同控件几何。')
 ev(p,"()=>GridTone.appearance.set({skin:'crystal'})");fixture(p);act(p,'edit-tools');act(p,'creation',':not([data-mode])');reveal(p,'[data-action="harmony-editor"]').click();shot('03-harmony-fields','一基时间、可读和弦类型与确认参考。')
 act(p,'close-modal');act(p,'open-sound');ev(p,"()=>document.querySelector('#creation-dock').scrollTop=720");shot('04-sound-cards','音色卡片的试听与使用采用公开small变体；搜索单一边框。')
 act(p,'project-menu');p.wait_for_timeout(400);shot('05-projects','实际内联来源存储不可用，记录错误和备份入口，不伪造作品列表。');
 if p.locator('.modal').count():act(p,'close-modal')
 act(p,'appearance');shot('06-appearance','主题与动效实际设置面板。');act(p,'close-modal')
 fixture(p);ev(p,"()=>{const A=GridToneApp,p=A.getProject();p.tracks.forEach(t=>t.patterns.forEach(x=>delete x.harmony));A.materials.c.commit({project:p});}");genbtn=p.locator('[data-action="edit-tools"]');genbtn.click();act(p,'creation',':not([data-mode])');shot('07-missing-harmony','缺输入时就地解释并提供模板或参考入口。')
 fixture(p);gen(p);ev(p,"()=>{const A=GridToneApp,p=A.getProject();p.key=6;A.materials.c.commit({project:p});}")
 # The default mode is chord-only and need not invalidate a mere scale hint; edit actual target.
 ev(p,"()=>{const A=GridToneApp,p=A.getProject();p.tracks.at(-1).patterns[0].notes[0].pitch+=1;A.materials.c.commit({project:p});}");shot('08-stale-scheme','相关音乐改变后方案不可采用，持久说明原因。')
 p.set_content((R/'components.html').read_text(),wait_until='load');p.wait_for_timeout(100);p.locator('.gallery-sound').scroll_into_view_if_needed();shot('09-gallery-sound','独立生产组件页中的真实音色卡及琴键。')
 result={'sha256':manifest['sha256'],'browser':b.version,'method':'Actual full production HTML via set_content; API fixture setup, real controls. Not native Mac or new-user test.','status':'PASS' if not errors else'FAIL','screens':records,'pageErrors':errors};(O/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
