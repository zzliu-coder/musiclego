"""Final-build screenshots; fixture setup is explicit and is not persistence evidence."""
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];O=R/'docs/workspace-1.8/evidence/visual';O.mkdir(parents=True,exist_ok=True);html=(R/'dist/index.html').read_text();images=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);p=b.new_page(viewport={'width':1600,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html);p.wait_for_function('window.GridToneApp');p.wait_for_timeout(200)
 def act(a,extra=''):p.locator('button[data-action="'+a+'"]'+extra).filter(visible=True).first.click()
 def shot(name,label):p.wait_for_timeout(80);p.screenshot(path=str(O/(name+'.png')));images.append({'file':name+'.png','label':label,'sha256':hashlib.sha256((O/(name+'.png')).read_bytes()).hexdigest()})
 shot('01-home','单一编排入口与共用编辑栏')
 p.evaluate('''()=>{const A=GridToneApp,G=GridTone,d=G.recipeProject('recipe.pop');d.id=A.getProject().id;d.bars=8;A.materials.c.commit({project:d});const t=d.tracks.at(-1);A.openPattern({trackId:t.id,clipId:t.clips[0].id,edit:true,activation:'notes'});}''')
 act('edit-tools');act('creation',':not([data-mode])');field=p.locator('[data-field="creation-sourceTrackId"]');
 if not field.input_value():field.select_option(index=1)
 act('creation-generate');p.locator('.candidate-bar').scroll_into_view_if_needed();p.evaluate('document.querySelector(".view-content").scrollTop=90');shot('02-candidate','片段内生成：画板与候选同屏，目标固定')
 act('creation-apply');ids=p.evaluate('GridToneApp.getProject().tracks.at(-1).patterns[0].notes.slice(0,3).map(n=>n.id)')
 for i,id in enumerate(ids):
  el=p.locator(f'#note-layer [data-note="{id}"] .note-body');el.scroll_into_view_if_needed();el.click(modifiers=['Shift'] if i else [])
 p.evaluate('document.querySelector(".view-content").scrollTop=0');shot('03-editor','统一音符操作：选中的音与上方音乐块的打开状态分开')
 act('edit-tools');p.evaluate('document.querySelector("#creation-dock").scrollTop=0');shot('04-edit-tools','分组的音符变形、时长和生成工具')
 act('open-sound');p.evaluate('document.querySelector("#creation-dock").scrollTop=0');shot('05-sound','本轨音色在右侧，画板保留')
 act('view','[data-view="mix"]');shot('06-mix','独立混音工作区')
 act('view','[data-view="arrange"]');act('appearance');act('choose-skin','[data-skin="pearl"]');act('close-modal');act('inspector-close');shot('07-pearl','暖白主题：同一组件几何和编辑目标')
 p.set_content((R/'components.html').read_text());p.locator('.components-page').evaluate('(el)=>el.scrollTop=500');shot('08-components','实际生产组件和五种编辑对象的样例')
 assert not errors,errors
 result={'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'viewport':[1600,1000],'screens':images,'pageErrors':errors,'scope':'Actual production HTML; scenario setup via public API and subsequent real button/pointer operations. The footer records unavailable origin storage honestly.'};(O/'screens.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
print('captured',len(images))
