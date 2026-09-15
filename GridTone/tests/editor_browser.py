import asyncio,json,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'docs/verification').mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  page=await browser.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content((ROOT/'dist/index.html').read_text());await page.wait_for_function('!!window.GridToneApp');await page.wait_for_timeout(150)
  await page.evaluate('''()=>{const G=GridTone,p=G.blankProject();p.tracks[0].patterns[0].notes=[G.newNote(60,0),G.newNote(64,240),G.newNote(67,480),G.newNote(61,720)];GridToneApp.loadProject(p);GridToneApp.openPattern({patternId:p.tracks[0].patterns[0].id});}''')
  checks=[]
  async def check(name,expr):
   assert await page.evaluate(expr),name;checks.append(name)
  await page.evaluate('window.beforeNotes=JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes);window.beforeUndo=GridToneApp.getHistory().undo;window.beforeLow=Number(document.querySelector("#note-grid").dataset.low);')
  # Ruler pan must alter only viewport, with no immediate preview.
  ruler=page.locator('[data-ruler-pitch]').nth(3);await ruler.scroll_into_view_if_needed();box=await ruler.bounding_box();x=box['x']+20;y=box['y']+10
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+95,steps=8);await page.mouse.up()
  await check('ruler drag changes viewport only','Number(document.querySelector("#note-grid").dataset.low)>beforeLow&&GridToneApp.getHistory().undo===beforeUndo&&JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)===beforeNotes')
  await check('ruler drag emits no note audition','GridToneApp.engine.previewGraphs.size===0')
  # Tap same type of key -> preview, global stop -> silence.
  await page.locator('[data-ruler-pitch]').nth(3).click();await page.wait_for_timeout(100)
  await check('ruler short tap previews sound','GridToneApp.engine.previewGraphs.size===1');await page.locator('[data-action="stop"]').click()
  await page.locator('[data-action="fit-notes"]').click();await page.locator('[data-action="scale-lock"]').click()
  await check('out-of-scale note remains accessible',"!!document.querySelector('[data-ruler-pitch=\"61\"]')")
  await page.locator('[data-action="zoom-in"]').click()
  await check('zoom is view-only','GridToneApp.getHistory().undo===beforeUndo&&JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)===beforeNotes')
  await page.locator('[data-group="aids"]').click();await page.locator('[data-field="key"]').select_option('2')
  await check('reference key keeps existing absolute pitches','JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)===beforeNotes')
  await page.locator('[data-group="notes"]').click();await page.locator('[data-action="transpose-dialog"]').click();await page.locator('#transpose-amount').fill('2');await page.locator('[data-action="preview-pitch"]').click();await page.wait_for_timeout(150)
  await check('transpose preview preserves original document','JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)===beforeNotes&&GridToneApp.getPlayback().audition.includes("移调")')
  await page.locator('[data-action="apply-pitch"]').click()
  await check('apply commits actual pitches and closes candidate','GridToneApp.getProject().tracks[0].patterns[0].notes.map(n=>n.pitch).join(",")==="62,66,69,63"&&!GridToneApp.getPlayback().audition')
  await page.locator('[data-action="undo"]').click()
  await check('one undo restores exact original notes','JSON.stringify(GridToneApp.getProject().tracks[0].patterns[0].notes)===beforeNotes')
  # Draw a long note on empty high row and verify one history operation.
  await page.locator('[data-group="view"]').click();await page.locator('[data-action="fit-notes"]').click()
  await page.evaluate('window.drawUndo=GridToneApp.getHistory().undo;window.drawCount=GridToneApp.getProject().tracks[0].patterns[0].notes.length;')
  grid=page.locator('#note-grid');await grid.scroll_into_view_if_needed();g=await grid.evaluate('(el)=>({rect:{x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y},...el.dataset})')
  x=g['rect']['x']+float(g['left'])+6.5*float(g['cellWidth']);y=g['rect']['y']+30+float(g['rowHeight'])*1.5
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+3*float(g['cellWidth']),y,steps=10);await page.mouse.up()
  await check('drag draws four-step long note as one undo command','GridToneApp.getProject().tracks[0].patterns[0].notes.length===drawCount+1&&GridToneApp.getProject().tracks[0].patterns[0].notes.at(-1).duration===GridTone.STEP*4&&GridToneApp.getHistory().undo===drawUndo+1')
  await page.screenshot(path=str(ROOT/'docs/verification/04-editor.png'))
  await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(200)
  await check('390px layout no page overflow','document.documentElement.scrollWidth<=window.innerWidth')
  await page.screenshot(path=str(ROOT/'docs/verification/04-narrow.png'))
  assert not errors,errors
  (ROOT/'docs/verification/04-browser.json').write_text(json.dumps({'checks':checks,'errors':errors,'method':'Chromium pointer and UI actions, source inlined'},ensure_ascii=False,indent=2))
  print('PASS',len(checks),checks);await browser.close()
asyncio.run(main())
