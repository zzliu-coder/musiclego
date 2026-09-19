"""Warm Magnetic design + real interaction checks against final production HTML.
Actual Chromium pointer/key events unless explicitly named a simulation. No native Mac claim.
"""
import os,json,hashlib,time,traceback,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import *
O=R/'docs/magnet-2.1/evidence/magnet-browser';(O/'screens').mkdir(parents=True,exist_ok=True)
html=(R/'dist/index.html').read_text();results=[]
def raw(p):return ev(p,'JSON.stringify(GridToneApp.getProject())')
def h(p):return ev(p,'GridToneApp.getHistory().undo')
def reveal(p,sel):
 l=p.locator(sel).first
 for d in l.locator('xpath=ancestor::details').all():
  if d.get_attribute('open') is None:d.locator(':scope > summary').click()
 return p.locator(sel).first

def geom(p):return p.locator('.topbar,#edit-command-bar,.template-shelf,.view-content,#creation-dock,.playback-footer,#note-grid').evaluate_all('(els)=>els.map(e=>[e.id||e.className,...["x","y","width","height"].map(k=>Math.round(e.getBoundingClientRect()[k]*100)/100)])')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def run(id,fn):
  c=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=c.new_page();p.set_default_timeout(7000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));ts=time.monotonic()
  try:
   p.set_content(html);p.wait_for_function('GridToneApp');p.wait_for_timeout(150);detail=fn(p);assert not errors,errors
   results.append({'id':id,'status':'PASS','seconds':round(time.monotonic()-ts,3),'detail':detail});print('PASS',id,flush=True)
  except Exception as e:
   results.append({'id':id,'status':'FAIL','error':str(e),'pageErrors':errors,'trace':traceback.format_exc()});print('FAIL',id,str(e)[:240],flush=True)
  finally:
   try:p.screenshot(path=str(O/'screens'/(id+'.png')))
   except:pass
   c.close()
 def base(p):
  assert p.locator('.workspace-tabs').all_text_contents()==['编排混音']
  assert ev(p,'getComputedStyle(document.body).backgroundColor')=='rgb(247, 247, 244)'
  assert p.locator('.top-transport').bounding_box()['height']<60
  assert ev(p,'getComputedStyle(document.body).backgroundImage')=='none'
  return {'version':ev(p,'GridToneApp.version'),'background':ev(p,'getComputedStyle(document.body).backgroundColor')}
 run('M01-approved-warm-tool-not-player',base)
 def themes(p):
  fixture(p);act(p,'open-sound');before=raw(p);history=h(p);first=geom(p);out=[]
  for name,skin,direction in [('A','crystal',''),('B','crystal','clear'),('C','pearl','')]:
   ev(p,'v=>{GridTone.appearance.set({skin:v.skin});document.documentElement.dataset.direction=v.direction;}',{'skin':skin,'direction':direction});p.wait_for_timeout(100)
   assert geom(p)==first,(name,geom(p),first);assert raw(p)==before and h(p)==history;out.append({'direction':name,'geometry':geom(p)})
  return out
 run('M02-ABC-same-layout-document-and-history',themes)
 def tile(p):
  fixture(p,open=False);act(p,'shelf-filter','[data-filter="chords"]');card=p.locator('.shelf-card').first
  before=card.bounding_box();data=raw(p);card.hover();p.wait_for_timeout(150)
  assert card.bounding_box()==before and raw(p)==data;assert not ev(p,'GridToneApp.engine.playing')
  style=card.evaluate('(e)=>{const s=getComputedStyle(e);return {radius:s.borderRadius,shadow:s.boxShadow,transform:s.transform,transition:s.transitionProperty}}')
  assert style['radius']=='10px' and style['shadow']!='none' and style['transform']=='none';return style
 run('M03-magnetic-surface-no-hover-motion-or-sound',tile)
 def drag(p):
  f=fixture(p,open=False);act(p,'shelf-filter','[data-filter="chords"]');card=p.locator('.shelf-card').first;sourceid=card.get_attribute('data-shelf-id');box=card.bounding_box();target=p.locator(f'.empty-bar[data-track="{f["trackId"]}"][data-bar="4"]').bounding_box();before=h(p)
  p.mouse.move(box['x']+40,box['y']+55);p.mouse.down();p.mouse.move(box['x']+60,box['y']+55,steps=3);p.mouse.move(target['x']+target['width']/2,target['y']+30,steps=18);p.wait_for_timeout(90)
  assert p.locator('[data-stage="projection"]').count()>0
  txt=p.locator('[data-stage="projection"]').inner_text();assert '5' in txt and '8' in txt
  assert ev(p,'getComputedStyle(document.querySelector(".shelf-drop-ghost")).transitionDuration')=='0s'
  p.mouse.up();p.wait_for_timeout(80);assert h(p)==before+1;assert ev(p,'GridToneApp.getProject().tracks.at(-1).clips.at(-1).bar')==4
  return {'sourceId':sourceid,'projectionText':txt}
 run('M04-real-template-drag-identity-range-and-immediate-commit',drag)
 def reduced(p):
  fixture(p);act(p,'appearance');p.locator('[data-field="reduce-motion"]').check();act(p,'close-modal');assert ev(p,'GridTone.motion.reduced()');act(p,'open-sound')
  assert p.locator('.btn').evaluate_all('(els)=>els.filter(e=>e.getClientRects().length).every(e=>getComputedStyle(e).transitionDuration==="0s")');ev(p,"GridTone.appearance.set({motion:'normal'})");p.emulate_media(reduced_motion='reduce');assert ev(p,'GridTone.motion.reduced()')
  assert p.locator('.btn').evaluate_all('(els)=>els.filter(e=>e.getClientRects().length).every(e=>getComputedStyle(e).transitionDuration==="0s")');return 'User switch and OS emulation independently disable nonessential surface motion.'
 run('M05-reduced-motion-user-and-OS-still-usable',reduced)
 def immediate(p):
  f=fixture(p,notes=False);p.add_style_tag(content='*{transition:none!important;animation:none!important}')
  xy=gridpoint(p,480,60);p.mouse.click(xy['x'],xy['y']);assert len(ns(p))==1;assert h(p)>0
  act(p,'play');p.wait_for_function('GridToneApp.engine.playing');act(p,'stop');assert not ev(p,'GridToneApp.engine.playing');assert ev(p,'GridToneApp.engine.previewGraphs.size')==0
  return {'notes':ns(p),'playing':ev(p,'GridToneApp.engine.playing')}
 run('M06-all-animation-disabled-draw-play-stop-immediate',immediate)
 def note_geom(p):
  f=fixture(p);note(p,f['noteIds'][0]);el=p.locator(f'[data-note="{f["noteIds"][0]}"] .note-body');a=el.bounding_box();el.hover();assert el.bounding_box()==a
  s=el.evaluate('(e)=>({animation:getComputedStyle(e).animationName,transition:getComputedStyle(e).transitionProperty,transform:getComputedStyle(e).transform})')
  assert s=={'animation':'none','transition':'none','transform':'none'};return s
 run('M07-real-note-geometry-never-eases',note_geom)
 def controls(p):
  fixture(p);a=p.locator('.shelf-card [data-action="shelf-preview"]').first
  def read(l):return l.evaluate('(e)=>{const s=getComputedStyle(e);return {size:e.dataset.size,font:s.fontSize,height:s.minHeight,line:s.lineHeight,padding:s.padding,borderRadius:s.borderRadius}}')
  one=read(a);act(p,'open-sound');two=read(p.locator('.sound-card-actions [data-action="preview-preset"]').first if p.locator('.sound-card-actions [data-action="preview-preset"]').count() else p.locator('.sound-card-actions .btn[data-size="small"]').first)
  assert one==two,(one,two);assert one['font']=='12px' and one['height']=='30px';return {'tray':one,'sound':two}
 run('M08-same-compact-control-computed-spec-everywhere',controls)
 def contrasts(p):
  fixture(p);gen(p);out=[]
  for skin in ['crystal','pearl']:
   ev(p,'s=>GridTone.appearance.set({skin:s})',skin)
   for selector in ['[data-action="creation-apply"]','.workspace-tabs [aria-pressed="true"]','input[type=search]']:
    l=p.locator(selector).filter(visible=True).first
    if not l.count():continue
    for state in ['normal','hover','focus']:
     p.mouse.move(0,0);p.evaluate('document.activeElement?.blur?.()');p.wait_for_timeout(100)
     if state=='hover':l.hover()
     if state=='focus':l.focus()
     p.wait_for_timeout(110)
     v=l.evaluate('''e=>{const s=getComputedStyle(e),hex=c=>'#'+c.match(/[\\d.]+/g).slice(0,3).map(v=>Math.round(+v).toString(16).padStart(2,'0')).join('');let bg=s.backgroundColor,par=e;while(bg==='rgba(0, 0, 0, 0)'&&par.parentElement){par=par.parentElement;bg=getComputedStyle(par).backgroundColor;}return {fg:s.color,bg,font:s.fontSize,ratio:GridTone.ui.colorContrast(hex(s.color),hex(bg))}}''')
     assert v['ratio']>=4.5,(skin,selector,state,v);out.append({'skin':skin,'selector':selector,'state':state,**v})
  return out
 run('M09-primary-text-states-measured-contrast',contrasts)
 def custom(p):
  f=fixture(p);r=[]
  for color in ['#ffffff','#000000','#ffff00','#ff00ff','#87ffca']:
   ev(p,'color=>{const A=GridToneApp,d=A.getProject();d.tracks.at(-1).color=color;A.materials.c.commit({project:d})}',color);before=raw(p);p.wait_for_timeout(20)
   el=p.locator('.arrange-row').last
   v=el.evaluate('(e)=>{const s=getComputedStyle(e);return {bg:s.getPropertyValue("--music-surface").trim(),fg:s.getPropertyValue("--music-ink").trim(),edge:s.getPropertyValue("--music-edge").trim()}}')
   ratios=ev(p,'v=>({text:GridTone.ui.colorContrast(v.fg,v.bg),edge:GridTone.ui.colorContrast(v.edge,v.bg)})',v);assert ratios['text']>=4.5 and ratios['edge']>=3
   ev(p,'GridTone.appearance.set({skin:"pearl"})');assert raw(p)==before;r.append({'color':color,**v,**ratios})
  return r
 run('M10-custom-track-colors-safe-without-changing-document',custom)
 def panel(p):
  fixture(p);act(p,'open-sound');ev(p,'document.querySelector("#creation-dock").scrollTop=800');before=ev(p,'document.querySelector("#creation-dock").scrollTop');act(p,'inspector-tab','[data-panel="properties"]');assert ev(p,'document.querySelector("#creation-dock").scrollTop')==0;act(p,'inspector-tab','[data-panel="sound"]');assert ev(p,'document.querySelector("#creation-dock").scrollTop')==before
  return {'restored':before}
 run('M11-pinned-tool-tabs-preserve-per-tool-scroll',panel)
 def libraryscroll(p):
  act(p,'library-open');act(p,'library-kind','[data-kind="sound"]');p.set_viewport_size({'width':1100,'height':700});ev(p,'GridToneApp.library.render()');ev(p,'document.querySelector(".library-family-grid").scrollTop=330');start=ev(p,'document.querySelector(".library-family-grid").scrollTop');assert start>0
  act(p,'library-star');after=ev(p,'document.querySelector(".library-family-grid").scrollTop');assert abs(start-after)<2,(start,after)
  act(p,'library-preview');p.wait_for_timeout(80);assert abs(ev(p,'document.querySelector(".library-family-grid").scrollTop')-start)<2;act(p,'stop');return {'before':start,'after':after}
 run('M12-wide-library-scroll-survives-favorite-and-preview',libraryscroll)
 def longtitle(p):
  fixture(p);ev(p,'()=>{const A=GridToneApp,d=A.getProject();d.title="午后开始写下的一段非常长的中文作品名字";d.tracks.at(-1).name="这一条是非常长的中文旋律声部名称，希望完整辨认";A.materials.c.commit({project:d});}');act(p,'open-sound');out=[]
  for w,hgt in [(1440,900),(1280,800),(1100,700)]:
   p.set_viewport_size({'width':w,'height':hgt});p.wait_for_timeout(80);assert ev(p,'document.documentElement.scrollWidth')<=w;footer=p.locator('.playback-footer').bounding_box();assert footer['y']>=0 and footer['y']+footer['height']<=hgt+1
   close=p.locator('[data-action="inspector-close"]');close.scroll_into_view_if_needed();assert close.evaluate('(e)=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e.contains(at)}')
   out.append({'width':w,'height':hgt,'rightWidth':p.locator('#creation-dock').bounding_box()['width']})
  return out
 run('M13-long-Chinese-labels-three-desktop-viewports',longtitle)
 def zoom(p):
  f=fixture(p);gen(p);out=[]
  for factor in [1.25,1.5,2]:
   p.set_viewport_size({'width':int(1440/factor),'height':int(900/factor)});p.wait_for_timeout(70)
   # This is the available content area equivalent, not real browser zoom.
   assert ev(p,'document.documentElement.scrollWidth')<=int(1440/factor)
   a=p.locator('[data-action="creation-apply"]');a.scroll_into_view_if_needed();assert a.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
   out.append({'scaleEquivalent':factor,'apply':a.bounding_box()})
  return {'mode':'Reduced viewport equivalent only; native browser zoom remains target-device check.','rows':out}
 run('M14-125-150-200-percent-equivalent-reflow-controls-reachable',zoom)
 def librarysmall(p):
  act(p,'library-open');p.set_viewport_size({'width':720,'height':450});ev(p,'GridToneApp.library.render()');a=p.locator('[data-action="library-adopt"]');a.scroll_into_view_if_needed();assert a.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}');assert ev(p,'document.documentElement.scrollWidth')<=720;return 'Wide catalog wraps rather than shrinking labels.'
 run('M15-expanded-library-small-effective-window',librarysmall)
 def error(p):
  fixture(p);ev(p,'()=>{const A=GridToneApp,d=A.getProject();for(const t of d.tracks)for(const p of t.patterns)delete p.harmony;A.materials.c.commit({project:d});}');act(p,'edit-tools');act(p,'creation',':not([data-mode])');assert p.locator('#creation-dock .inline-notice').is_visible();assert p.locator('[data-action="creation-generate"]').is_disabled();assert not ev(p,'GridToneApp.engine.playing')
  return p.locator('#creation-dock .inline-notice').inner_text()
 run('M16-missing-input-readable-before-click',error)
 def modal(p):
  fixture(p);act(p,'export');assert ev(p,'document.querySelector("#app").inert');assert p.locator('.modal').evaluate('(e)=>getComputedStyle(e).animationName')=='none';assert p.locator('.modal-backdrop').evaluate('(e)=>getComputedStyle(e).backdropFilter')=='none';p.keyboard.press('Tab');p.keyboard.press('Shift+Tab');assert ev(p,'!!document.activeElement.closest(".modal")');p.keyboard.press('Escape');assert not p.locator('.modal').count();return 'Modal opens immediately; Tab remains inside and Escape restores.'
 run('M17-dialog-focus-and-zero-entrance-wait',modal)
 def projection(p):
  f=fixture(p);original=raw(p);hist=h(p);gen(p);assert raw(p)==original and h(p)==hist;assert p.locator('#candidate-projection [data-note]').count()==0
  assert p.locator('#candidate-projection').evaluate('(e)=>getComputedStyle(e).pointerEvents')=='none';act(p,'creation-fit');p.locator('#gridframe').scroll_into_view_if_needed();return {'projectionNodes':p.locator('#candidate-projection rect').count(),'undo':h(p)}
 run('M18-candidate-projection-readonly-preserves-history',projection)
 def textkeys(p):
  f=fixture(p);note(p,f['noteIds'][0]);before=raw(p);q=p.locator('[data-field="shelf-search"]');q.fill('中文搜索');q.focus();p.keyboard.press('Backspace');assert q.input_value()=='中文搜';assert raw(p)==before
  q.dispatch_event('keydown',{'key':'b','code':'KeyB','isComposing':True});assert raw(p)==before;return 'Actual text delete plus explicitly simulated IME composition event.'
 run('M19-text-and-IME-do-not-edit-music',textkeys)
 def nofake(p):
  fixture(p);gen(p);assert p.locator('input[placeholder*="AI"],textarea[placeholder*="AI"]').count()==0
  animations=ev(p,'document.getAnimations().map(x=>x.animationName)');assert not animations;assert p.locator('[data-action="creation-apply"]').inner_text()=='用这版'
  return {'activeCSSAnimations':animations}
 run('M20-no-cosmetic-animation-or-invented-workflow',nofake)
 def stopbusy(p):
  fixture(p);gen(p);act(p,'creation-preview');act(p,'stop');p.wait_for_timeout(150);assert not ev(p,'GridToneApp.engine.playing');assert ev(p,'GridToneApp.engine.previewGraphs.size')==0;return ev(p,'GridToneApp.getPlayback()')
 run('M21-preview-stop-clears-audio-without-animation-events',stopbusy)
 def ui_semantics(p):
  fixture(p);act(p,'view','[data-view="mix"]');assert '居中' in p.locator('.mix-layout').inner_text();act(p,'view','[data-view="arrange"]');act(p,'workspace-menu');act(p,'keyboard-settings');assert '键盘' in p.locator('.modal').inner_text();act(p,'close-modal');act(p,'appearance');assert p.locator('.skin-card').all_text_contents()==['暖白磁贴安静暖白 · 浅厚度音乐块','奶油浅瓷微暖表面 · 同一套操作'];return 'Names and units match actual actions; native keymap implementation is unchanged.'
 run('M22-all-tool-areas-share-format-and-theme-names',ui_semantics)
 def perf(p):
  f=fixture(p,notes=False);xy=gridpoint(p,240,60);ev(p,'''()=>{window.paintProbes=[];window.frames=[];window.activeProbe=true;let prev=null;function loop(t){if(!activeProbe)return;if(prev!==null)frames.push(t-prev);prev=t;requestAnimationFrame(loop)}requestAnimationFrame(loop);document.addEventListener('pointermove',()=>{if(!activeProbe)return;const at=performance.now();requestAnimationFrame(()=>paintProbes.push(performance.now()-at))},true);}''')
  act(p,'play');p.locator('#gridframe').scroll_into_view_if_needed();xy=gridpoint(p,240,60);p.mouse.move(xy['x'],xy['y']);p.mouse.down()
  for k in range(60):p.mouse.move(xy['x']+(k%20)*6,xy['y']);p.wait_for_timeout(16)
  p.mouse.up();act(p,'stop');v=ev(p,'()=>{activeProbe=false;return {latencies:paintProbes,frames}}');a=sorted(x for x in v['latencies'] if x>=0);fr=sorted(x for x in v['frames'] if x>=0)
  assert len(a)>=50 and min(a)>=0
  return {'metric':'DOM pointer event to next requestAnimationFrame proxy. Not native end-to-end input/audio latency; concurrent test load recorded separately.','inputSamples':len(a),'inputP95ms':a[int(len(a)*.95)] if a else None,'frameP95ms':fr[int(len(fr)*.95)] if fr else None,'frameP99ms':fr[int(len(fr)*.99)] if fr else None,'framesOver50ms':sum(x>50 for x in fr),'raw':v}
 run('M23-pointer-feedback-and-frame-distribution-measurement',perf)
 def precise(p):
  f=fixture(p);note(p,f['noteIds'][0]);original=raw(p);act(p,'edit-tools');act(p,'note-inspector');out=[]
  for width in [1440,600]:
   p.set_viewport_size({'width':width,'height':800});p.wait_for_timeout(70)
   fields=p.locator('.precise-fields > label').evaluate_all('(xs)=>xs.map(x=>{const r=x.getBoundingClientRect(),i=x.querySelector("input").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,iy:i.y,iw:i.width}})')
   assert len(fields)==4 and all(x['iy']>x['y'] and x['iw']<=x['w']+1 for x in fields)
   assert p.locator('.modal').bounding_box()['width']<=width
   for a,x in enumerate(fields):
    for y in fields[a+1:]:assert x['x']+x['w']<=y['x']+1 or y['x']+y['w']<=x['x']+1 or x['y']+x['h']<=y['y']+1 or y['y']+y['h']<=x['y']+1
   out.append({'width':width,'fields':fields})
  act(p,'close-modal');assert raw(p)==original;return out
 run('M24-precision-fields-no-overlap-wide-and-short',precise)
 def chord_aux(p):
  f=fixture(p);original=raw(p);act(p,'tool','[data-tool="chord"]');assert p.locator('.tool-options').is_visible();x=p.locator('.tool-options').evaluate('(e)=>{const s=getComputedStyle(e);return{display:s.display,gap:s.gap}}');assert x['display']=='flex' and x['gap']=='12px';assert raw(p)==original;return x
 run('M25-chord-paint-options-have-clear-grouping-no-edit',chord_aux)
 b.close()
report={'version':json.loads((R/'package.json').read_text())['version'],'sha256':hashlib.sha256(html.encode()).hexdigest(),'mode':'Complete production HTML via set_content in Linux Chromium','checks':results,'summary':{k:sum(x['status']==k for x in results) for k in ['PASS','FAIL']}}
(O/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report['summary']);raise SystemExit(bool(report['summary']['FAIL']))
