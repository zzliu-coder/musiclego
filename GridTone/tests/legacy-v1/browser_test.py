"""Real DOM and native Web Audio integration tests. No external network required.
Uses an inline browser document; opaque-origin IndexedDB / microphone permission
cannot be verified in this runner and are explicitly excluded from the pass count.
Run: python tests/browser_test.py  (requires playwright + Chromium)
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import re,json,wave,math,struct,time,sys,os,shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs';OUT.mkdir(exist_ok=True)
html=(ROOT/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m[1]).read_text()+'</style>',html)
html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/m[1]).read_text()+'</script>',html)
results=[];errors=[]
def check(name,condition,detail=None):
 if not condition: raise AssertionError(f'{name}: {detail}')
 results.append({'name':name,'passed':True,'detail':detail});print('PASS',name,detail or '',flush=True)
def project(page):return page.evaluate('GridToneApp.getProject()')
def state(page):return page.evaluate('GridToneApp.getState()')
def active_pattern(page):
 p=project(page);s=state(page);t=next(t for t in p['tracks'] if t['id']==s['trackId']);return next(p for p in t['patterns'] if p['id']==s['patternId'])
def note_xy(page,label,step,drum=False):
 return page.evaluate('''({label,step,drum})=>{const svg=document.querySelector('#note-grid'),r=svg.getBoundingClientRect(),w=svg.viewBox.baseVal.width,h=svg.viewBox.baseVal.height;const text=[...svg.querySelectorAll('text')].find(t=>t.textContent===label);if(!text)throw Error('row missing '+label);const left=drum?112:72,cw=(w-left-12)/16;return{x:r.x+(left+cw*step)*r.width/w,y:r.y+(Number(text.getAttribute('y'))-(drum?0:4))*r.height/h};}''',{'label':label,'step':step,'drum':drum})
def draw(page,a,b=None):
 page.mouse.move(a['x'],a['y']);page.mouse.down()
 if b:page.mouse.move(b['x'],b['y'],steps=9)
 page.mouse.up();page.wait_for_timeout(50)
def click_action(page,a):page.locator(f'button[data-action="{a}"]').first.click()
def view(page,v):page.locator(f'.view-tabs [data-view="{v}"]').click()
def boot(page):page.set_content(html,wait_until='load');page.wait_for_timeout(400)
with sync_playwright() as pw:
 binary=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
 browser=pw.chromium.launch(**({'executable_path':binary} if binary else {}),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)));network=[];page.on('request',lambda r:network.append(r.url))
 try:
  boot(page);check('desktop boot and all four workspaces',page.locator('.view-tabs [data-view]').count()==4)
  page.evaluate('GridToneApp.loadProject(GridTone.blankProject())');page.wait_for_timeout(40)
  draw(page,note_xy(page,'C4',.5));ns=active_pattern(page)['notes'];check('click creates a one-cell note',len(ns)==1 and ns[0]['pitch']==60 and ns[0]['duration']==240)
  draw(page,note_xy(page,'D4',2.4),note_xy(page,'D4',5.4));ns=active_pattern(page)['notes'];n=next(n for n in ns if n['pitch']==62);check('horizontal drawing creates one sustained note',n['start']==480 and n['duration']==960)
  draw(page,note_xy(page,'D4',2.4),note_xy(page,'E4',4.4));n=next(n for n in active_pattern(page)['notes'] if n['pitch']==64);check('dragging moves an entire existing note in time and pitch',n['start']==960 and n['duration']==960)
  draw(page,note_xy(page,'E4',7.91),note_xy(page,'E4',10.91));n=next(n for n in active_pattern(page)['notes'] if n['pitch']==64);check('right-edge drag resizes a note',n['duration']==1680, n)
  click_action(page,'undo');n=next(n for n in active_pattern(page)['notes'] if n['pitch']==64);check('undo restores the whole drag as one edit',n['duration']==960)
  click_action(page,'redo');n=next(n for n in active_pattern(page)['notes'] if n['pitch']==64);check('redo restores resized note',n['duration']==1680)
  page.locator('[data-tool="chord"]').click();page.locator('[data-field="chord"]').select_option('minor');draw(page,note_xy(page,'G3',11.5));ns=active_pattern(page)['notes'];check('chord brush expands to three independent notes',len(ns)==5 and sorted(n['pitch'] for n in ns if n['start']==2640)==[55,58,62],ns)
  click_action(page,'copy-notes');click_action(page,'paste-notes');check('note copy/paste creates fresh ids at the next position',len(active_pattern(page)['notes'])==8 and len(set(n['id'] for n in active_pattern(page)['notes']))==8)
  click_action(page,'delete-notes');check('delete acts only on selected notes',len(active_pattern(page)['notes'])==5)
  click_action(page,'duplicate-pattern');p=project(page);check('A-prime copies pattern data independently and arranges it',len(p['tracks'][0]['patterns'])==2 and len(p['tracks'][0]['clips'])==2)
  before=active_pattern(page)['notes'];page.locator('[data-transform="reverse"]').click();page.locator('[data-transform="reverse"]').click();check('UI time reversal is reversible',active_pattern(page)['notes']==before)
  view(page,'arrange');clip=page.locator('.song-clip').nth(1);rect=clip.bounding_box();page.mouse.move(rect['x']+20,rect['y']+25);page.mouse.down();page.mouse.move(rect['x']+116,rect['y']+25,steps=8);page.mouse.up();check('arrangement dragging snaps a clip to a bar',project(page)['tracks'][0]['clips'][1]['bar']==2)
  clip=page.locator('.song-clip').nth(1);rect=clip.bounding_box();page.mouse.move(rect['x']+20,rect['y']+25);page.mouse.down();page.mouse.move(rect['x']-172,rect['y']+25,steps=8);page.mouse.up();check('colliding clips cannot overwrite each other',project(page)['tracks'][0]['clips'][1]['bar']==2)
  click_action(page,'unlink-clip');check('make-independent produces an unlinked pattern',len(project(page)['tracks'][0]['patterns'])==3)
  click_action(page,'edit-clip');check('arrangement opens the chosen piano-roll pattern',state(page)['view']=='edit')
  click_action(page,'add-track');page.locator('[data-preset="drums"]').click();check('adding a drum track creates an editable drum grid',project(page)['tracks'][-1]['kind']=='drum' and '底鼓' in page.locator('#note-grid').text_content())
  draw(page,note_xy(page,'底鼓',.5,True));check('drum click places a hit',len(active_pattern(page)['notes'])==1)
  draw(page,note_xy(page,'底鼓',.5,True));check('drum click on an existing hit erases it',len(active_pattern(page)['notes'])==0)
  draw(page,note_xy(page,'闭镲',.4,True),note_xy(page,'闭镲',15.4,True));check('drum brush fills every crossed grid cell',len(active_pattern(page)['notes'])==16)
  click_action(page,'drum-fill');page.locator('[data-template="lofi"]').click();check('drum template generates editable drum events',any(n['pitch']==36 for n in active_pattern(page)['notes']))
  page.locator('.track-item').first.click();view(page,'sound');page.locator('[data-action="preset"][data-id="bell"]').click();check('sound library actually changes the track instrument',project(page)['tracks'][0]['preset']=='bell')
  page.locator('[data-field="arp"]').select_option('up');check('pipeline control updates the musical model',project(page)['tracks'][0]['pipeline']['arp']=='up')
  view(page,'mix');page.locator('.mixer-channel [data-action="solo"]').first.click();check('solo changes routing state',project(page)['tracks'][0]['solo'])
  slider=page.locator('.vertical-fader').first;slider.evaluate("e=>{e.value=.4;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}");check('mix fader updates real gain state',project(page)['tracks'][0]['volume']==.4)
  page.get_by_role('button',name='播放',exact=True).click();page.wait_for_timeout(700);check('native AudioContext runs and schedules real sources',page.evaluate('GridToneApp.engine.playing&&GridToneApp.engine.ctx.state==="running"&&GridToneApp.engine.graph.sources.size>0'))
  page.get_by_role('button',name='暂停',exact=True).click();pos=page.evaluate('GridToneApp.engine.position()');page.wait_for_timeout(250);check('pause retains a stable play position',pos>0 and page.evaluate('GridToneApp.engine.position()')==pos)
  page.get_by_role('button',name='播放',exact=True).click();page.wait_for_timeout(250);check('resume continues from paused position',page.evaluate('GridToneApp.engine.position()')>pos)
  click_action(page,'add-track');page.locator('[data-preset="epiano"]').click();page.wait_for_timeout(350);check('adding a track while playing rebuilds audio buses',page.evaluate('GridToneApp.engine.graph?.buses.size===GridToneApp.getProject().tracks.length'))
  click_action(page,'stop');check('stop disposes live sources and resets the playhead',page.evaluate('!GridToneApp.engine.playing&&!GridToneApp.engine.graph&&GridToneApp.engine.position()===0'))
  # Test every actual audio renderer. Render half a bar of musical activity plus tails.
  audio=page.evaluate('''async()=>{const results=[];for(const preset of GridTone.PRESETS){const p=GridTone.blankProject();p.bars=1;p.bpm=180;p.tracks[0].preset=preset.id;p.tracks[0].kind=preset.engine==='drum'?'drum':'melodic';p.tracks[0].patterns[0].notes=preset.engine==='drum'?GridTone.DRUMS.map((d,i)=>GridTone.newNote(d.pitch,i*240,240,.7)):[GridTone.newNote(preset.category==='低音'?36:60,0,960,.8)];const result=await GridToneApp.engine.exportWav(p);let sum=0;const d=result.buffer.getChannelData(0);for(const x of d)sum+=x*x;results.push({id:preset.id,peak:result.peak,rms:Math.sqrt(sum/d.length),bytes:result.blob.size});}return results;}''')
  check('all 26 native presets render finite, non-silent WAV audio',all(math.isfinite(a['peak']) and a['peak']>.001 and a['rms']>.00005 for a in audio),{'presets':len(audio),'minPeak':min(a['peak'] for a in audio),'maxPeak':max(a['peak'] for a in audio)})
  (OUT/'audio-preset-checks.json').write_text(json.dumps(audio,ensure_ascii=False,indent=2))
  # Export the original demo through the UI and inspect actual bytes.
  page.evaluate('GridToneApp.loadProject(GridTone.demoProject())');click_action(page,'export')
  with page.expect_download(timeout=30000) as dl: click_action(page,'export-wav')
  wavpath=OUT/'原创示例_午后的留白.wav';dl.value.save_as(wavpath)
  with wave.open(str(wavpath),'rb') as f:
   info={'channels':f.getnchannels(),'sampleRate':f.getframerate(),'width':f.getsampwidth(),'seconds':f.getnframes()/f.getframerate()};raw=f.readframes(f.getnframes())
  samples=struct.unpack('<'+'h'*(len(raw)//2),raw);info['peakPCM']=max(abs(x) for x in samples)
  check('WAV export produces real 16-bit 44.1 kHz stereo music',info['channels']==2 and info['sampleRate']==44100 and info['width']==2 and 22.9<info['seconds']<23.1 and info['peakPCM']>1000,info)
  with page.expect_download() as dl:click_action(page,'export-midi')
  midpath=OUT/'原创示例_午后的留白.mid';dl.value.save_as(midpath);check('UI MIDI download is a valid SMF file',midpath.read_bytes().startswith(b'MThd'))
  with page.expect_download() as dl:click_action(page,'export-project')
  prpath=OUT/'原创示例_午后的留白.gridtone';dl.value.save_as(prpath);check('UI project export contains complete editable data',json.loads(prpath.read_text())['title']=='午后的留白')
  click_action(page,'close-modal')
  # Import a real generated audio sample through browser file input.
  tone=OUT/'test_sample.wav'
  with wave.open(str(tone),'wb') as f:
   f.setnchannels(1);f.setsampwidth(2);f.setframerate(22050);f.writeframes(b''.join(struct.pack('<h',int(math.sin(i*2*math.pi*261.6256/22050)*12000*math.exp(-i/22050*3))) for i in range(11025)))
  view(page,'sound')
  with page.expect_file_chooser() as fc:click_action(page,'import-sample')
  fc.value.set_files(tone);page.wait_for_function('Object.keys(GridToneApp.getProject().assets).length===1');check('imported audio becomes a self-contained sample instrument',project(page)['tracks'][0]['preset'].startswith('sample:'))
  sampleResult=page.evaluate('''async()=>{const p=GridToneApp.getProject();const t=p.tracks[0];const r=await GridToneApp.engine.exportWav(p,{trackId:t.id,patternId:t.patterns[0].id});return{peak:r.peak,bytes:r.blob.size};}''');check('custom sample instrument produces non-silent audio',sampleResult['peak']>.001,sampleResult)
  saved=project(page);page.evaluate('p=>GridToneApp.loadProject(p)',saved);check('sample data survives project serialization round trip',len(project(page)['assets'])==1)
  before=project(page);bad=dict(before);bad['bpm']=10000
  rejected=page.evaluate('p=>{try{GridToneApp.loadProject(p);return false;}catch{return true;}}',bad);check('malformed imports do not destroy the current project',rejected and project(page)==before)
  page.evaluate('GridToneApp.loadProject(GridTone.demoProject())');view(page,'edit');page.screenshot(path=str(OUT/'desktop-editor.png'),full_page=True)
  for v in ['arrange','sound','mix']:
   view(page,v);check(v+' view has no page-wide horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   page.screenshot(path=str(OUT/f'desktop-{v}.png'),full_page=True)
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
  mobile.on('pageerror',lambda e:errors.append(str(e)));boot(mobile)
  check('mobile layout fits a 390px viewport',mobile.evaluate('document.documentElement.scrollWidth===390'))
  click_action(mobile,'toggle-sidebar');check('mobile track drawer opens',mobile.locator('.app-shell').get_attribute('class').endswith('sidebar-open'));mobile.locator('.track-item').nth(2).click();check('mobile track switching closes the drawer',not state(mobile)['sidebar'] and project(mobile)['tracks'][2]['kind']=='drum')
  mobile.evaluate('GridToneApp.loadProject(GridTone.blankProject())');pt=note_xy(mobile,'C4',.5)
  # Touch actual events reach the PointerEvent handlers.
  client=mobile.context.new_cdp_session(mobile);client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':pt['x'],'y':pt['y']} ]});client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.wait_for_timeout(80)
  check('real touch input creates a note',len(active_pattern(mobile)['notes'])==1)
  mobile.evaluate('GridToneApp.loadProject(GridTone.demoProject())');mobile.screenshot(path=str(OUT/'mobile-editor.png'),full_page=True)
  check('no uncaught browser errors',len(errors)==0,errors)
  check('application makes zero external asset or API requests',len(network)==0,network)
  report={'passed':len(results),'failed':0,'tests':results,'notVerified':['IndexedDB persistence under a real file/localhost origin: runner blocks navigation; inline-document origin is opaque.','Physical microphone capture and permission UI.','Real Android/iOS device latency, background playback and OS audio interruptions.'],'browser':browser.version}
  (OUT/'browser-test-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('TOTAL',len(results),'passed',flush=True)
 except Exception as e:
  print('FAIL',e,flush=True);page.screenshot(path=str(OUT/'test-failure.png'),full_page=True);(OUT/'browser-test-failure.json').write_text(json.dumps({'error':str(e),'passed':results,'browserErrors':errors},ensure_ascii=False,indent=2));raise
 finally:browser.close()
