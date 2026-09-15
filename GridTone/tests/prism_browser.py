"""Prism/recipe acceptance. Networking is explicitly a failure case or a WAV fixture,
not a claim that VSCO binaries were downloaded in this environment."""
import json,os,shutil,math
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/prism';OUT.mkdir(exist_ok=True);shots=OUT/'screens';shots.mkdir(exist_ok=True)
checks=[];errors=[];requests=[]
def check(name,value):
 assert value,name
 checks.append(name);print('PASS',name,flush=True)
def shot(p,name):
 p.wait_for_timeout(230);p.screenshot(path=str(shots/(name+'.png')))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def page(width=1440,touch=False):
  c=browser.new_context(viewport={'width':width,'height':960 if not touch else 844},has_touch=touch,is_mobile=touch,accept_downloads=True)
  p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content((ROOT/'dist/index.html').read_text());p.wait_for_function('!!window.GridToneApp');p.wait_for_timeout(150);return p
 p=page();p.on('request',lambda r:requests.append(r.url));shot(p,'01-arrange')
 check('new app opens an editable original four-track starter',p.evaluate('GridToneApp.getProject().title==="玻璃小夜曲"&&GridToneApp.getProject().tracks.every(t=>t.preset.startsWith("prism."))'))
 p.evaluate('window.original=JSON.stringify(GridToneApp.getProject());window.hist=GridToneApp.getHistory().undo')
 p.locator('[data-action=appearance]').click();p.locator('[data-skin=pearl]').click();p.wait_for_timeout(180)
 check('skin changes semantic palette without changing music or undo',p.evaluate('document.documentElement.dataset.skin==="pearl"&&JSON.stringify(GridToneApp.getProject())===original&&GridToneApp.getHistory().undo===hist'))
 shot(p,'02-pearl');p.locator('[data-field=reduce-transparency]').check()
 check('reduced transparency disables the glass blur',p.evaluate('getComputedStyle(document.querySelector(".transport")).backdropFilter.includes("blur(0px)")'))
 p.locator('[data-skin=crystal]').click();p.locator('[data-field=reduce-transparency]').uncheck();p.locator('[data-action=close-modal]').last.click()
 p.locator('[data-action=edit-clip]').click();shot(p,'03-editor')
 check('progression entry belongs to clip editing, beside single-chord tool',p.locator('[data-action=composer]').count()==1 and p.locator('[data-tool=chord]').count()==1)
 p.locator('[data-action=composer]').click();check('24 progression choices with actual chord names',p.locator('.progression-card').count()==24 and p.locator('.chord-pills').inner_text().replace('\n','').find('Am')>=0)
 shot(p,'04-progressions');p.evaluate('window.chordBefore=JSON.stringify(GridToneApp.getProject());window.chordHistory=GridToneApp.getHistory().undo')
 p.locator('[data-action=composer-preview]').click();p.wait_for_timeout(160)
 check('progression audition emits real voices without document writes',p.evaluate('GridToneApp.engine.playing&&GridToneApp.engine.graph.sources.size>0&&JSON.stringify(GridToneApp.getProject())===chordBefore'))
 p.locator('[data-field=composer-rhythm]').select_option('arp')
 check('changing candidate parameters ends outdated audition',p.evaluate('!GridToneApp.engine.playing'))
 p.locator('[data-field=composer-key]').select_option('2');p.locator('[data-field=composer-mode]').select_option('new-track');p.locator('[data-field=composer-bar]').fill('1');p.locator('[data-field=composer-bar]').press('Tab')
 p.locator('[data-action=composer-apply]').click();p.wait_for_timeout(160)
 check('applying creates 32 ordinary arpeggio notes and one history entry',p.evaluate('GridToneApp.getProject().tracks.length===5&&GridToneApp.getProject().tracks.at(-1).patterns[0].notes.length===32&&GridToneApp.getHistory().undo===chordHistory+1'))
 check('generating in D keeps project reference key unchanged',p.evaluate('GridToneApp.getProject().key===0&&GridToneApp.getProject().tracks.at(-1).patterns[0].notes[0].pitch%12===2'))
 p.evaluate('window.applied=JSON.stringify(GridToneApp.getProject())');p.locator('[data-action=undo]').click()
 check('one undo restores pre-progression document exactly',p.evaluate('JSON.stringify(GridToneApp.getProject())===chordBefore'))
 p.locator('[data-action=redo]').click();check('redo restores the exact generated pattern',p.evaluate('JSON.stringify(GridToneApp.getProject())===applied'))
 p.locator('[data-field=editor-track]').select_option(p.evaluate('GridToneApp.getProject().tracks.at(-1).id'));p.locator('[data-tab=sound]').click();shot(p,'05-sound')
 check('curated browser has eighteen melodic voices with separate audition and apply',p.locator('.sound-card').count()==18 and p.locator('[data-action=sound-audition]').count()==18 and p.locator('[data-action=preset]').count()==18)
 p.evaluate('window.soundBefore=JSON.stringify(GridToneApp.getProject())');p.locator('[data-action=sound-audition][data-id="prism.nylon"]').click();p.wait_for_timeout(120)
 check('sound comparison does not silently replace the instrument',p.evaluate('GridToneApp.engine.playing&&JSON.stringify(GridToneApp.getProject())===soundBefore'))
 p.locator('[data-action=stop]').first.click();check('stop clears audition sources',p.evaluate('!GridToneApp.engine.graph&&GridToneApp.engine.previewGraphs.size===0'))
 p.locator('[data-action=preset][data-id="prism.nylon"]').click();check('explicit use applies new string model to whole track',p.evaluate('GridToneApp.getProject().tracks.at(-1).preset==="prism.nylon"'))
 p.locator('[data-action=audition-key][data-pitch="60"]').click();p.wait_for_timeout(75)
 check('instrument keyboard plays the selected instrument',p.evaluate('GridToneApp.engine.previewGraphs.size>0'))
 p.locator('[data-action=stop]').first.click();p.locator('[data-action=sound-category][data-category="低音"]').click();check('sound role filter isolates two contrasting basses',p.locator('.sound-card').count()==2)
 p.locator('[data-source=basic]').click();check('legacy melodic presets remain visible as twenty-four basics',p.locator('.sound-card').count()==24)
 p.locator('[data-source=recorded]').click();shot(p,'06-recorded')
 check('six explicit online sample banks are separate from ready-to-play presets',p.locator('[data-action=load-sample-bank]').count()==6 and '首次联网载入' in p.locator('#sound-cards').inner_text())
 # The route intentionally fails. Verify network failure cannot edit music or create a phantom preset.
 p.route('https://raw.githubusercontent.com/**',lambda route:route.abort('failed'))
 p.evaluate('window.bankBefore=JSON.stringify(GridToneApp.getProject())');p.locator('[data-action=load-sample-bank]').first.click();p.wait_for_function('document.querySelector("#bank-status")?.textContent.includes("载入失败")')
 check('network failure is visible, with no partial sound installation or song mutation',p.evaluate('JSON.stringify(GridToneApp.getProject())===bankBefore&&GridTone.resolvePreset("vsco.piano").missing'))
 p.locator('[data-action=close-modal]').last.click();p.unroute('https://raw.githubusercontent.com/**')
 drumid=p.evaluate('GridToneApp.getProject().tracks.find(t=>t.kind==="drum").id');p.locator('[data-field=editor-track]').select_option(drumid)
 check('switching to a drum track clears incompatible melodic source/category filter',p.locator('.recorded-card').count()==0 and p.locator('.sound-card').count()==3)
 p.locator('[data-tab=notes]').click();shot(p,'07-drums');p.locator('.editor-tools [data-action=catalog]').click()
 check('drum editor opens templates filtered to drums',p.locator('.catalog-card').count()==19)
 p.locator('[data-action=catalog-role][data-role=melody]').click();check('melody role exposes twelve original starts and legacy answer',p.locator('.catalog-card').count()==13)
 p.locator('[data-field=catalog-search]').fill('短问');check('live template search preserves text focus',p.locator('.catalog-card').count()==1 and p.locator('[data-field=catalog-search]').evaluate('e=>e===document.activeElement'))
 p.locator('[data-field=catalog-search]').fill('');p.locator('[data-action=catalog-role][data-role=song]').click();shot(p,'08-starters')
 check('whole-song starters and legacy demo coexist',p.locator('.catalog-card').count()==5)
 p.locator('[data-action=catalog-select][data-id="prism.song.walk"]').click();p.evaluate('window.beforeSong=JSON.stringify(GridToneApp.getProject())');p.locator('[data-action=catalog-preview]').click();p.wait_for_timeout(150)
 check('starter audition preserves project while using all four voices',p.evaluate('GridToneApp.engine.plan.trackIds.length===4&&JSON.stringify(GridToneApp.getProject())===beforeSong'))
 p.locator('[data-action=catalog-apply]').click();check('starter applies as editable source with descriptive title',p.evaluate('GridToneApp.getProject().title==="轻快步伐"&&GridToneApp.getProject().tracks.length===4'))
 p.locator('.view-tabs [data-view=mix]').click();shot(p,'09-mix');p.locator('.mixer-channel [data-action=solo]').nth(0).click();p.locator('.mixer-channel [data-action=solo]').nth(2).click()
 check('two-track temporary solo does not leak into default export',p.evaluate('GridToneApp.getPlayback().soloIds.length===2&&GridTone.compileSong(GridToneApp.getProject(),GridToneApp.playback.exportScope()).trackIds.length===4'))
 # Actual exports of all four original starters; save the real default song WAV.
 render=p.evaluate('''async()=>{const out=[];for(const t of GridTone.catalogContents().templates.filter(t=>t.id.startsWith('prism.song.'))){const p=GridTone.applyTemplate(GridTone.blankProject(),t).project;const r=await GridToneApp.engine.exportWav(p);if(t.id==='prism.song.glass')window.demoWav=r.blob;out.push({id:t.id,title:p.title,peak:r.peak,bytes:r.blob.size,seconds:r.buffer.duration,finite:[...r.buffer.getChannelData(0)].every(Number.isFinite)});}return out;}''')
 check('four new complete starters render finite audible stereo WAV',len(render)==4 and all(x['finite'] and x['peak']>.005 and x['bytes']>100000 for x in render))
 with p.expect_download() as pending:p.evaluate('GridTone.downloadBlob(demoWav,"玻璃小夜曲.wav")')
 pending.value.save_as(str(OUT/'玻璃小夜曲.wav'))
 # Controlled WAV fixture exercises real decode, processing, pinning and multi-sample playback.
 # It makes NO live-network or original-recording-quality claim.
 result=p.evaluate('''async()=>{const G=GridTone;const fixture=atob(G.EXAMPLE_CATALOG.assets['example.clink'].data.split(',')[1]);const raw=Uint8Array.from(fixture,c=>c.charCodeAt(0)).buffer;const urls=[],progress=[];const pack=await G.downloadSampleBank('vsco.marimba',{fetcher:async url=>{urls.push(url);return raw.slice(0);},onProgress:x=>progress.push(x.done)});pack.presets[0].origin='TEST FIXTURE ONLY, NOT A VSCO RECORDING';G.installCatalog(pack);const song=G.blankProject();song.tracks[0].preset='vsco.marimba';song.tracks[0].patterns[0].notes=[G.newNote(60,0,960)];G.pinDocument(song);const audio=await GridToneApp.engine.exportWav(song);window.fixtureSong=song;return {zones:pack.presets[0].zones.length,assets:Object.keys(song.assets).length,progress,urls,peak:audio.peak,source:pack.presets[0].origin};}''')
 check('multi-sample download pipeline really decodes, transcodes and renders controlled WAV fixture',result['zones']==4 and result['assets']==4 and result['peak']>.001 and result['progress']==[0,1,2,3,4])
 fresh=page();fixture=p.evaluate('fixtureSong');fresh.evaluate('x=>GridToneApp.loadProject(x)',fixture)
 check('embedded multi-sample project opens in a clean runtime without the bank installed',fresh.evaluate('GridTone.missingResources(GridToneApp.getProject()).length===0&&GridTone.catalogContents().packs.length===0&&GridTone.neededAssets(GridToneApp.getProject()).size===4'))
 cp=fresh.evaluate('''async()=>{const r=await GridToneApp.engine.exportWav(GridToneApp.getProject());return r.peak;}''');check('clean runtime renders pinned multi-sample fixture',cp>.001)
 cancelled=p.evaluate('''async()=>{const c=new AbortController();let calls=0;try{await GridTone.downloadSampleBank('vsco.flute',{signal:c.signal,fetcher:async()=>{calls++;c.abort();return new ArrayBuffer(0);}});return false;}catch(e){return e.name==='AbortError'&&calls===1;}}''')
 check('cancelling a pending bank ends before decode/install',cancelled)
 # Fresh source has no external dependency at startup; optional fetch is the only request above.
 check('startup and offline operations make no external requests',all(u.startswith('https://raw.githubusercontent.com/') for u in requests))
 # Actual UI project export and import in a fresh runtime.
 p.locator('.top-actions [data-action=export]').click();shot(p,'10-export')
 with p.expect_download() as pending:p.locator('[data-action=export-project]').click()
 path=OUT/'完整流程.gridtone';pending.value.save_as(str(path));saved=json.loads(path.read_text());clean=page()
 clean.locator('[data-action=project-menu]').click()
 with clean.expect_file_chooser() as chooser:clean.locator('[data-action=open-project]').click()
 chooser.value.set_files(str(path));clean.wait_for_timeout(230)
 check('actual downloaded project reimports through browser file picker',clean.evaluate('GridToneApp.getProject().title')==saved['title'] and clean.evaluate('GridToneApp.getProject().tracks.length')==4)
 p.locator('[data-action=close-modal]').last.click()
 # Fixed per-row kit voices must not be confused with a track's fallback preset.
 kitpage=page();kitpage.evaluate("""()=>{const q=GridToneApp.getProject(),t=q.tracks.find(t=>t.kind==='drum');t.drumkitId='prism.kit.deep';GridToneApp.loadProject(q);GridToneApp.openPattern({trackId:t.id,edit:true});GridToneApp.changeView('sound');}""")
 check('fixed per-row drumkit sounds show their scope and an explicit whole-kit selector','8 个鼓件绑定独立声音' in kitpage.locator('.kit-scope-note').inner_text())
 kitpage.locator('.kit-scope-note [data-action=catalog-tab]').click()
 check('whole-kit selector opens all five configured kits',kitpage.locator('.catalog-card').count()==5)
 kitpage.context.close()
 # Responsive, same UI data; explicit touch targets and desktop compactness.
 sizes=[]
 for width in [320,390,768]:
  m=page(width,True);shot(m,f'mobile-{width}-arrange')
  def geometry():return m.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,add:document.querySelector('[data-action="add-track"]').getBoundingClientRect().height,play:document.querySelector('[data-action="play"]').getBoundingClientRect().height})''')
  z=geometry();sizes.append(z);check(f'{width}px touch arrangement fits viewport with >=44px primary actions',z['scroll']<=z['width'] and z['add']>=44 and z['play']>=44)
  m.locator('[data-action=edit-clip]').click();shot(m,f'mobile-{width}-editor');check(f'{width}px editor has no document-level horizontal overflow',m.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  m.locator('[data-action=composer]').click();shot(m,f'mobile-{width}-chords');check(f'{width}px chord panel fits and can reach Generate',m.evaluate('document.documentElement.scrollWidth<=innerWidth') and m.locator('[data-action=composer-apply]').is_enabled())
  if width<=390:check(f'{width}px chord audition and Generate stay visible above the fold',m.locator('[data-action=composer-apply]').bounding_box()['y']+m.locator('[data-action=composer-apply]').bounding_box()['height']<=844)
  m.locator('[data-action=composer-apply]').click();check(f'{width}px touch Generate commits editable ordinary notes',m.evaluate('GridToneApp.getProject().tracks[0].patterns.at(-1).notes.length===12&&GridToneApp.getProject().bars===12'))
  m.locator('[data-tab=sound]').click();shot(m,f'mobile-{width}-sound');check(f'{width}px sound browser fits and offers a visible keyboard',m.evaluate('document.documentElement.scrollWidth<=innerWidth') and m.locator('[data-action=audition-key]').count()==13 and m.locator('.audition-keys').bounding_box()['width']>200)
  check(f'{width}px transport controls do not overlap the audition target',m.evaluate('document.querySelector(".transport-controls").getBoundingClientRect().right<=document.querySelector(".target-field").getBoundingClientRect().left'))
  m.context.close()
 # Respect OS reduced motion and check readable semantic text on the opaque work surface.
 p.emulate_media(reduced_motion='reduce');p.locator('[data-action=appearance]').click()
 check('OS reduced-motion preference suppresses panel animation',p.locator('.modal').evaluate('e=>parseFloat(getComputedStyle(e).animationDuration)<=.001'))
 for _ in range(15):p.keyboard.press('Tab')
 check('dialog focus stays inside modal after fifteen actual Tab presses',p.evaluate('!!document.activeElement.closest(".modal")'))
 p.keyboard.press('Shift+Tab');check('reverse Tab retains dialog focus',p.evaluate('!!document.activeElement.closest(".modal")'))
 assert not errors,errors
 summary={'passed':len(checks),'checks':checks,'pageErrors':errors,'audioStarters':render,'responsive':sizes,'sampleFixture':result,'externalRequests':requests,'scope':'Actual Chromium DOM, user clicks, native audio decode/render, files and touch-size checks. VSCO download success uses injected WAV fixture; live-network success and physical devices NOT verified.'}
 (OUT/'acceptance.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print('ALL PASS',len(checks),flush=True);browser.close()
