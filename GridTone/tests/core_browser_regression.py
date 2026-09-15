"""Preserve the original writing/arranging flow using the v1.1 hierarchy.
Uses normal autoplay policy and real user gestures, native Web Audio, no mocked engine.
"""
import json,os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/verification';OUT.mkdir(exist_ok=True)
checks=[];errors=[];requests=[]
def check(name,ok):
 assert ok,name
 checks.append(name)
def pattern(p):
 return p.evaluate('(()=>{const s=GridToneApp.getState();return GridToneApp.getProject().tracks.find(t=>t.id===s.trackId).patterns.find(p=>p.id===s.patternId)})()')
def action(p,name):p.locator(f'[data-action="{name}"]').first.click()
def point(p,pitch,step):
 p.locator('#note-grid').scroll_into_view_if_needed()
 return p.evaluate('''({pitch,step})=>{const el=document.querySelector('#note-grid'),r=el.getBoundingClientRect(),row=el.querySelector('[data-ruler-pitch="'+pitch+'"]');const rows=[...el.querySelectorAll('[data-ruler-pitch]')],i=rows.indexOf(row);if(i<0)throw Error('missing pitch '+pitch);return {x:r.x+Number(el.dataset.left)+(step)*Number(el.dataset.cellWidth),y:r.y+30+(i+.5)*Number(el.dataset.rowHeight)}}''',{'pitch':pitch,'step':step})
def draw(p,a,b=None):
 p.mouse.move(a['x'],a['y']);p.mouse.down()
 if b:p.mouse.move(b['x'],b['y'],steps=8)
 p.mouse.up();p.wait_for_timeout(40)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser'),headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':1200});p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
 p.set_content((ROOT/'dist/index.html').read_text());p.wait_for_function('!!window.GridToneApp');p.wait_for_timeout(300)
 p.evaluate('''()=>{const p=GridTone.blankProject();GridToneApp.loadProject(p);GridToneApp.openPattern({patternId:p.tracks[0].patterns[0].id});}''')
 draw(p,point(p,60,.5));check('single click creates one sixteenth note',len(pattern(p)['notes'])==1 and pattern(p)['notes'][0]['duration']==240)
 draw(p,point(p,62,2.4),point(p,62,5.4));check('drag paints one four-step sustained note',pattern(p)['notes'][-1]['duration']==960)
 draw(p,point(p,62,2.4),point(p,64,4.4));n=next(n for n in pattern(p)['notes'] if n['pitch']==64);check('moving note preserves duration and changes start and pitch',n['start']==960 and n['duration']==960)
 draw(p,point(p,64,7.91),point(p,64,10.91));check('right handle changes note duration',next(n for n in pattern(p)['notes'] if n['pitch']==64)['duration']==1680)
 action(p,'undo');check('one undo restores pre-resize duration',next(n for n in pattern(p)['notes'] if n['pitch']==64)['duration']==960)
 action(p,'redo');check('redo restores exact resized duration',next(n for n in pattern(p)['notes'] if n['pitch']==64)['duration']==1680)
 p.locator('[data-tool="chord"]').click();p.locator('[data-field="chord"]').select_option('minor');draw(p,point(p,55,11.5))
 check('minor chord is three independent ordinary notes',sorted(n['pitch'] for n in pattern(p)['notes'] if n['start']==2640)==[55,58,62])
 action(p,'copy-notes');action(p,'paste-notes');check('copy-paste gives fresh editable note identities',len(pattern(p)['notes'])==8 and len({n['id'] for n in pattern(p)['notes']})==8)
 action(p,'delete-notes');check('delete acts on selection only',len(pattern(p)['notes'])==5)
 action(p,'duplicate-pattern');check('A prime copies independently and places a clip',p.evaluate('GridToneApp.getProject().tracks[0].patterns.length===2&&GridToneApp.getProject().tracks[0].clips.length===2'))
 p.locator('[data-group="notes"]').click();before=pattern(p)['notes'];p.locator('[data-transform="reverse"]').click();p.locator('[data-transform="reverse"]').click();check('time reversal is reversible through UI',pattern(p)['notes']==before)
 p.locator('.view-tabs [data-view="arrange"]').click();clip=p.locator('.song-clip').nth(1);r=clip.bounding_box();draw(p,{'x':r['x']+20,'y':r['y']+25},{'x':r['x']+20+p.locator('.arrange-lane').first.evaluate('e=>e.clientWidth/Number(e.dataset.bars)'),'y':r['y']+25})
 check('clip drag snaps to song bar',p.evaluate('GridToneApp.getProject().tracks[0].clips[1].bar===2'))
 r=p.locator('.song-clip').nth(1).bounding_box();draw(p,{'x':r['x']+20,'y':r['y']+25},{'x':r['x']+20-2*p.locator('.arrange-lane').first.evaluate('e=>e.clientWidth/Number(e.dataset.bars)'),'y':r['y']+25})
 check('colliding clip does not overwrite existing music',p.evaluate('GridToneApp.getProject().tracks[0].clips[1].bar===2'))
 action(p,'unlink-clip');check('unlink assigns a separate pattern',p.evaluate('GridToneApp.getProject().tracks[0].patterns.length===3'))
 action(p,'add-track');p.locator('[data-preset="drums"]').click();check('adding drum track opens drum editor',p.evaluate('GridToneApp.getState().view==="edit"&&GridToneApp.getProject().tracks.at(-1).kind==="drum"'))
 draw(p,point(p,36,.5));check('drum click places a hit',len(pattern(p)['notes'])==1)
 draw(p,point(p,36,.5));check('drum click toggles existing hit off',len(pattern(p)['notes'])==0)
 draw(p,point(p,42,.4),point(p,42,15.4));check('drum brush fills each crossed step',len(pattern(p)['notes'])==16)
 first=p.evaluate('GridToneApp.getProject().tracks[0].id');p.locator('[data-field="editor-track"]').select_option(first);p.locator('[data-tab="sound"]').click();p.locator('[data-source="basic"]').click();p.locator('[data-action="preset"][data-id="bell"]').click();check('sound editing uses same track data',p.evaluate('GridToneApp.getProject().tracks[0].preset==="bell"'))
 p.locator('[data-tab="pipeline"]').click();p.locator('[data-field="arp"]').select_option('up');check('pipeline remains editable in nested editor',p.evaluate('GridToneApp.getProject().tracks[0].pipeline.arp==="up"'))
 p.locator('.view-tabs [data-view="mix"]').click();p.locator('.mixer-channel [data-action="solo"]').first.click();check('temporary solo is separate from saved project',p.evaluate('GridToneApp.getPlayback().soloIds.length===1&&!Object.hasOwn(GridToneApp.getProject().tracks[0],"solo")'))
 p.locator('.vertical-fader').first.evaluate('e=>{e.value=.4;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))}');check('mixer fader controls stored mix value',p.evaluate('GridToneApp.getProject().tracks[0].volume===.4'))
 action(p,'play');p.wait_for_timeout(750);check('normal user gesture starts native audio and sources',p.evaluate('GridToneApp.engine.playing&&GridToneApp.engine.ctx.state==="running"&&GridToneApp.engine.graph.sources.size>0'))
 action(p,'play');pos=p.evaluate('GridToneApp.engine.position()');p.wait_for_timeout(180);check('pause keeps a stable playhead',pos>0 and p.evaluate('GridToneApp.engine.position()')==pos)
 action(p,'play');p.wait_for_timeout(230);check('resume advances from paused position',p.evaluate('GridToneApp.engine.position()')>pos)
 action(p,'stop');check('global stop disposes graph and resets playhead',p.evaluate('!GridToneApp.engine.playing&&!GridToneApp.engine.graph&&GridToneApp.engine.position()===0'))
 check('standalone application requests no network resources',not requests)
 assert not errors,errors
 (OUT/'core-browser.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'externalRequests':requests,'autoplayPolicy':'normal browser policy; user clicks'},ensure_ascii=False,indent=2))
 print('PASS',len(checks),'core workflow UI checks under normal autoplay policy');b.close()
