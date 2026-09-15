"""End-to-end success path, data-only catalog and real exported audio.
This environment uses set_content; no claim of IndexedDB persistence from an opaque origin.
"""
import asyncio,json,struct,math,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/verification';OUT.mkdir(parents=True,exist_ok=True)
DOWNLOADS=OUT/'downloads';DOWNLOADS.mkdir(exist_ok=True)
async def main():
 checks=[];errors=[];audio=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  async def newpage(mobile=False):
   context=await browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1080},has_touch=mobile,is_mobile=mobile,accept_downloads=True)
   page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));await page.set_content((ROOT/'dist/index.html').read_text());await page.wait_for_function('!!globalThis.GridToneApp');await page.wait_for_timeout(200);return page
  p=await newpage()
  async def check(name,expression,page=None):
   value=await (page or p).evaluate(expression)
   assert value,name;checks.append(name)
  async def download(page,selector,name):
   async with page.expect_download(timeout=60000) as pending:await page.locator(selector).click()
   d=await pending.value;path=DOWNLOADS/name;await d.save_as(str(path));assert not await d.failure();assert path.stat().st_size>0;return path
  # Start from a whole-song template, preview safely, then apply.
  await p.locator('.workspace-actions [data-action="catalog"]').click()
  await p.locator('[data-action="catalog-select"][data-id="builtin.song.afternoon"]').click()
  await p.evaluate('window.original=JSON.stringify(GridToneApp.getProject())')
  await p.locator('[data-action="catalog-preview"]').click();await p.wait_for_timeout(160)
  await check('whole-song template preview leaves current document intact','JSON.stringify(GridToneApp.getProject())===original&&GridToneApp.engine.playing&&!!GridToneApp.getPlayback().audition')
  await p.locator('[data-action="catalog-apply"]').click()
  await check('whole-song template applies as editable four-track arrangement','GridToneApp.getState().view==="arrange"&&document.querySelectorAll(".arrange-track-head").length===4&&document.querySelectorAll(".track-list").length===0&&GridToneApp.getProject().version===2')
  await p.evaluate('window.appliedSong=JSON.stringify(GridToneApp.getProject())')
  await p.locator('[data-action="undo"]').click()
  await check('whole-song replacement can be restored by one undo','JSON.stringify(GridToneApp.getProject())===original')
  await p.locator('[data-action="redo"]').click()
  await check('redo restores the exact applied song and pinned content','JSON.stringify(GridToneApp.getProject())===appliedSong')
  await p.locator('[data-action="play"]').click();await p.wait_for_timeout(100)
  # Enter via focused clip, not via stale selected clip.
  clip=p.locator('[data-clip]').first;await clip.focus();await clip.press('Enter')
  await check('keyboard opens focused clip without interrupting song','GridToneApp.getState().view==="edit"&&GridToneApp.engine.playing&&GridToneApp.getPlayback().target==="song"')
  await check('shared-reference context visible','document.querySelector(".shared-context").textContent.includes("2 次")')
  await p.locator('[data-action="stop"]').click()
  await p.evaluate('window.musicBefore=JSON.stringify(GridTone.compileSong(GridToneApp.getProject()));window.undoBefore=GridToneApp.getHistory().undo;window.lowBefore=Number(document.querySelector("#note-grid").dataset.low)')
  ruler=p.locator('[data-ruler-pitch]').nth(2);await ruler.scroll_into_view_if_needed();r=await ruler.bounding_box();x=r['x']+20;y=r['y']+8
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x,y+75,steps=6);await p.mouse.up()
  await check('pitch browsing preserves music and undo history','JSON.stringify(GridTone.compileSong(GridToneApp.getProject()))===musicBefore&&GridToneApp.getHistory().undo===undoBefore&&Number(document.querySelector("#note-grid").dataset.low)>lowBefore')
  await p.locator('[data-action="fit-notes"]').click()
  grid=p.locator('#note-grid');await grid.scroll_into_view_if_needed();geo=await grid.evaluate('(el)=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,...el.dataset})')
  await p.evaluate('window.noteCount=GridToneApp.getProject().tracks[0].patterns[0].notes.length')
  x=geo['x']+float(geo['left'])+4.5*float(geo['cellWidth']);y=geo['y']+30+float(geo['rowHeight'])*.5
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+3*float(geo['cellWidth']),y,steps=8);await p.mouse.up()
  await check('drawing creates editable four-step note','GridToneApp.getProject().tracks[0].patterns[0].notes.length===noteCount+1&&GridToneApp.getProject().tracks[0].patterns[0].notes.at(-1).duration===960')
  await p.locator('[data-action="listen-pattern"]').click();await p.wait_for_timeout(100)
  await check('explicit current-pattern audition resolves edited target','GridToneApp.engine.scope.kind==="pattern"&&GridToneApp.engine.scope.patternId===GridToneApp.getState().patternId')
  await p.evaluate('window.patternA=GridToneApp.getState().patternId;window.sourceA=JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)')
  await p.locator('[data-action="duplicate-pattern"]').click();await p.wait_for_timeout(140)
  await check('A prime is independent and local audition follows it','GridToneApp.getState().patternId!==patternA&&GridToneApp.engine.scope.patternId===GridToneApp.getState().patternId&&JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)===sourceA')
  await p.screenshot(path=str(OUT/'02-editor.png'))
  await p.locator('.editor-breadcrumb [data-action="view"]').click()
  await check('return to arrangement ends local audition','!GridToneApp.engine.playing&&GridToneApp.getPlayback().target==="song"')
  new_id=await p.evaluate('GridToneApp.getState().clipId');newclip=p.locator(f'[data-clip="{new_id}"]');await newclip.scroll_into_view_if_needed();r=await newclip.bounding_box();x=r['x']+15;y=r['y']+22
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+2*await p.locator('.arrange-lane').first.evaluate('e=>e.clientWidth/Number(e.dataset.bars)'),y,steps=10);await p.mouse.up()
  await check('independent clip can be placed later in song','GridToneApp.getProject().tracks[0].clips.find(c=>c.id===GridToneApp.getState().clipId).bar===10')
  for idx in [1,2]:await p.locator('[data-field="monitor-track"]').nth(idx).check()
  await p.locator('[data-action="listen-tracks"]').click();await p.wait_for_timeout(120)
  await check('two selected tracks have explicit isolated plan','GridToneApp.engine.scope.kind==="tracks"&&GridToneApp.engine.plan.trackIds.length===2&&document.querySelector("#playback-label").textContent.includes("2 轨")')
  await p.locator('.view-tabs [data-view="mix"]').click()
  await check('selected-track playback continues into mix','GridToneApp.engine.playing&&GridToneApp.engine.plan.trackIds.length===2')
  bass=await p.evaluate('GridToneApp.getProject().tracks[1].id')
  fader=p.locator(f'input.vertical-fader[data-track="{bass}"]');await fader.focus();await fader.press('ArrowDown')
  await check('keyboard fader movement changes saved mix','Math.abs(GridToneApp.getProject().tracks[1].volume-.55)<.0001')
  await p.locator('[data-action="clear-solo"]').click();await p.wait_for_timeout(130)
  await check('restore whole song restores all active tracks','GridToneApp.getPlayback().target==="song"&&GridToneApp.engine.plan.trackIds.length===4')
  await p.screenshot(path=str(OUT/'03-mix.png'));await p.locator('[data-action="stop"]').click()
  # Default exports must ignore temporary solo.
  await p.locator('.mixer-channel [data-action="solo"]').first.click()
  await check('temporary solo never enters project data','GridToneApp.getPlayback().soloIds.length===1&&GridToneApp.getProject().tracks.every(t=>!("solo" in t)&&!("octave" in t))')
  await p.locator('.top-actions [data-action="export"]').click()
  project_path=await download(p,'[data-action="export-project"]','成功路径.gridtone')
  expected_events=await p.evaluate('GridTone.compileSong(GridToneApp.getProject(),{kind:"song",soloIds:[]}).events.length')
  midi_path=await download(p,'[data-action="export-midi"]','成功路径.mid')
  wav_path=await download(p,'[data-action="export-wav"]','成功路径.wav')
  data=midi_path.read_bytes();assert data[:4]==b'MThd';assert int.from_bytes(data[10:12],'big')==5;checks.append('MIDI export contains conductor and four musical tracks despite temporary solo')
  import wave,array
  with wave.open(str(wav_path),'rb') as w:
   assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(2,2,44100);pcm=array.array('h',w.readframes(w.getnframes()));peak=max(abs(x) for x in pcm);assert peak>100;audio.append({'file':'成功路径.wav','frames':len(pcm)//2,'peakInt16':peak})
  checks.append('whole-song WAV exported through UI has actual stereo PCM audio')
  saved=json.loads(project_path.read_text());assert saved['version']==2;assert len(saved['tracks'])==4
  await p.locator('[data-action="close-modal"]').last.click()
  # Reopen through actual file input in a fresh runtime.
  clean=await newpage();await clean.locator('[data-action="project-menu"]').click()
  async with clean.expect_file_chooser() as fc:await clean.locator('[data-action="open-project"]').click()
  await (await fc.value).set_files(str(project_path));await clean.wait_for_timeout(300)
  await check('downloaded project reopens with exact document in clean runtime','JSON.stringify(GridToneApp.getProject())===JSON.stringify('+json.dumps(saved,ensure_ascii=False)+')',clean)
  await check('temporary audition state starts clean after reimport','GridToneApp.getPlayback().soloIds.length===0&&GridToneApp.getPlayback().target==="song"',clean)
  # Import the expandable catalog via UI.
  await p.evaluate('GridToneApp.loadProject(GridTone.blankProject())')
  await p.locator('.workspace-actions [data-action="catalog"]').click()
  async with p.expect_file_chooser() as fc:await p.locator('#overlay [data-action="import-catalog"]').click()
  await (await fc.value).set_files(str(ROOT/'examples/声格示例包.gridtonepack'));await p.wait_for_timeout(350)
  await check('imported catalog appears without adding UI cases','GridTone.catalogContents().packs.length===1&&document.querySelectorAll(".catalog-card").length===74')
  await p.screenshot(path=str(OUT/'04-catalog.png'))
  await p.locator('[data-action="catalog-select"][data-id="example.beat"]').click()
  await p.evaluate('window.beforeTemplate=JSON.stringify(GridToneApp.getProject())')
  await p.locator('[data-action="catalog-preview"]').click();await p.wait_for_timeout(170)
  await check('sample-kit template preview decodes real audio without applying','JSON.stringify(GridToneApp.getProject())===beforeTemplate&&GridToneApp.engine.assets.has("example.clink")&&GridToneApp.engine.playing')
  await p.locator('[data-action="catalog-apply"]').click()
  await check('sample kit application creates nine editable lanes and pins asset','document.querySelectorAll("[data-ruler-pitch]").length===9&&!!GridToneApp.getProject().assets["example.clink"]&&GridToneApp.getProject().catalog.drumkits.length===1')
  await p.screenshot(path=str(OUT/'05-drumkit.png'))
  await p.locator('.workspace-actions [data-action="catalog"]').click();await p.locator('[data-action="catalog-select"][data-id="example.answer"]').click();await p.locator('[data-action="catalog-apply"]').click()
  await check('imported melodic preset is pinned to its own new track','GridToneApp.getProject().tracks.length===3&&GridToneApp.getProject().catalog.presets.some(p=>p.id==="example.glass")')
  await p.locator('[data-tab="sound"]').click();await p.locator('[data-source="all"]').click()
  await check('sound browser renders imported preset and custom category','Array.from(document.querySelectorAll("[data-action=preset]")).some(b=>b.dataset.id==="example.glass")&&Array.from(document.querySelectorAll("[data-action=sound-category]")).some(b=>b.textContent==="我的音色")')
  await p.locator('.top-actions [data-action="export"]').click();custom_path=await download(p,'[data-action="export-project"]','自定义音色与鼓组.gridtone');await p.locator('[data-action="close-modal"]').last.click()
  custom=json.loads(custom_path.read_text());await clean.evaluate('(p)=>GridToneApp.loadProject(p)',custom)
  await check('custom project works in runtime with no imported pack','GridTone.catalogContents().packs.length===0&&GridTone.missingResources(GridToneApp.getProject()).length===0',clean)
  rendered=await clean.evaluate('''async()=>{const p=GridToneApp.getProject(),r=await GridToneApp.engine.exportWav(p);return {peak:r.peak,bytes:r.blob.size,tracks:p.tracks.length};}''');assert rendered['peak']>0.001;audio.append({'file':'embedded-custom-project',**rendered});checks.append('pinned synth and sample drum kit render without catalog installation')
  # Missing resource is visible and must require explicit substitution.
  await clean.evaluate('''()=>{const p=GridTone.blankProject();p.tracks[0].preset='missing.example';GridToneApp.loadProject(p);}''')
  await check('unknown sound is visible as missing rather than disguised default','document.querySelector(".missing-banner").textContent.includes("missing.example")',clean)
  await clean.locator('[data-action="play"]').click();await clean.wait_for_timeout(100)
  await check('missing sound blocks playback with explicit error','!GridToneApp.engine.playing&&document.querySelector("#toast").textContent.includes("missing.example")',clean)
  await clean.locator('.missing-banner [data-action="open-sound"]').click();await clean.locator('[data-source="basic"]').click();await clean.locator('[data-action="preset"][data-id="epiano"]').click()
  await check('manual sound replacement repairs document explicitly','GridToneApp.getProject().tracks[0].preset==="epiano"&&!document.querySelector(".missing-banner")',clean)
  # Render every built-in sound using the final engine.
  preset_results=await clean.evaluate('''async()=>{const out=[];for(const preset of GridTone.PRESETS){const p=GridTone.blankProject();p.bars=1;const t=GridTone.newTrack(preset.engine==='drum'?'drum':'melodic',0,preset.id);t.preset=preset.id;p.tracks=[t];t.patterns[0].notes=t.kind==='drum'?GridTone.DRUMS.map((d,i)=>GridTone.newNote(d.pitch,i*240,240,.7)):[GridTone.newNote(preset.category==='低音'?36:60,0,960,.7),GridTone.newNote(preset.category==='低音'?43:67,1440,960,.7)];const r=await GridToneApp.engine.exportWav(p);if(!Number.isFinite(r.peak)||r.peak<=.0001)throw Error(preset.id+' no finite audio');out.push({id:preset.id,peak:r.peak,bytes:r.blob.size});}return out;}''')
  assert len(preset_results)==47;checks.extend(['real finite non-silent WAV: '+x['id'] for x in preset_results]);audio+=preset_results
  # Malformed catalog must leave current library and project unchanged.
  await p.locator('.workspace-actions [data-action="catalog"]').click();await p.evaluate('window.beforeBad=JSON.stringify(GridToneApp.getProject());window.catalogBeforeBad=JSON.stringify(GridTone.catalogContents())')
  bad=copy_pack=json.loads((ROOT/'catalog/example.json').read_text());bad['id']='invalid.example';bad['presets'][0]['engine']='execute-javascript';bad_path=DOWNLOADS/'invalid-test-only.json';bad_path.write_text(json.dumps(bad))
  async with p.expect_file_chooser() as fc:await p.locator('#overlay [data-action="import-catalog"]').click()
  await (await fc.value).set_files(str(bad_path));await p.wait_for_timeout(140)
  await check('invalid imported engine cannot partially alter library or project','JSON.stringify(GridToneApp.getProject())===beforeBad&&JSON.stringify(GridTone.catalogContents())===catalogBeforeBad&&document.querySelector("#toast").textContent.includes("没有导入")')
  await p.locator('[data-action="close-modal"]').last.click()
  # Real browser-generated touch pointer events, using viewport-only ruler gestures.
  mobile=await newpage(True);await mobile.evaluate('''()=>{const p=GridTone.blankProject();GridToneApp.loadProject(p);GridToneApp.openPattern({patternId:p.tracks[0].patterns[0].id});}''')
  ruler=mobile.locator('[data-ruler-pitch]').nth(1);await ruler.scroll_into_view_if_needed();rect=await ruler.bounding_box();x=rect['x']+20;y=rect['y']+8
  await mobile.evaluate('window.touchBefore=JSON.stringify(GridToneApp.getProject());window.touchUndo=GridToneApp.getHistory().undo;window.touchLow=Number(document.querySelector("#note-grid").dataset.low)')
  cdp=await mobile.context.new_cdp_session(mobile)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+65}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await mobile.wait_for_timeout(100)
  await check('touch ruler pan changes only view with no note or undo mutation','JSON.stringify(GridToneApp.getProject())===touchBefore&&GridToneApp.getHistory().undo===touchUndo&&Number(document.querySelector("#note-grid").dataset.low)>touchLow',mobile)
  await check('narrow-screen viewport has no whole-page overflow','document.documentElement.scrollWidth<=innerWidth',mobile)
  await mobile.locator('[data-action="toggle-sidebar"]').click();await check('sidebar remains explicitly collapsible on touch device','!!document.querySelector(".properties-sidebar")',mobile);await mobile.locator('[data-action="close-sidebar"]').click()
  await mobile.screenshot(path=str(OUT/'06-mobile.png'))
  # File-origin verification scope is intentionally documented, not simulated as persistence.
  assert not errors,errors
  result={'passed':len(checks),'checks':checks,'pageErrors':errors,'audio':audio,'expectedSongEvents':expected_events,'scope':'Headless Chromium with actual WebAudio, offline PCM, UI downloads, fresh-runtime file reimport and touch pointer events. set_content opaque origin; real IndexedDB refresh persistence and physical audio hardware not tested.'}
  (OUT/'acceptance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('PASS',len(checks),'browser acceptance checks; 47 preset renders; no page errors')
  await browser.close()
asyncio.run(main())
