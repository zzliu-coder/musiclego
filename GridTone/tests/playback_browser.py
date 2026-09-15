import asyncio,json,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'docs/verification').mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  page=await browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content((ROOT/'dist/index.html').read_text());await page.wait_for_function('!!window.GridToneApp');await page.wait_for_timeout(150)
  results=await page.evaluate('''async()=>{
    const A=GridToneApp,G=GridTone,checks=[];const ok=(name,v)=>{if(!v)throw Error(name);checks.push(name);};
    const p=A.getProject(),t=p.tracks[1];t.mute=true;A.loadProject(p);A.playback.toggleSolo(p.tracks[0].id);A.openPattern({trackId:t.id,patternId:t.patterns[0].id});
    await A.playback.start('pattern');ok('isolated notes and graph audible',A.engine.plan.events.length===t.patterns[0].notes.length&&A.engine.graph.buses.get(t.id).fader.gain.value>0);
    const t2=p.tracks[2];A.openPattern({trackId:t2.id,patternId:t2.patterns[0].id});await new Promise(r=>setTimeout(r,180));ok('local preview follows opened pattern',A.engine.scope.patternId===t2.patterns[0].id&&A.engine.plan.events.every(n=>n.trackId===t2.id));
    A.changeView('mix');ok('leaving local stops and resets full song',!A.engine.playing&&A.getPlayback().target==='song');await A.playback.start('song');A.changeView('arrange');ok('song remains playing through navigation',A.engine.playing);A.playback.stop();
    await A.engine.preview(t2,t2.kind==='drum'?36:60,p,.5);ok('preview starts graph',A.engine.previewGraphs.size===1);A.playback.stop();ok('global stop disposes preview and main',A.engine.previewGraphs.size===0&&A.engine.graph===null);
    const result=await A.engine.exportWav(p,{kind:'pattern',trackId:t.id,patternId:t.patterns[0].id});ok('muted track local WAV nonempty',result.blob.size>1000);const bytes=new DataView(await result.blob.arrayBuffer());let peak=0;for(let i=44;i<bytes.byteLength;i+=2)peak=Math.max(peak,Math.abs(bytes.getInt16(i,true)));ok('render contains actual PCM signal',peak>100);
    A.render();return {checks,peak,bytes:result.blob.size};
  }''')
  assert not errors,errors
  (ROOT/'docs/verification/03-browser.json').write_text(json.dumps({'results':results,'errors':errors,'mode':'source inlined; real Chromium WebAudio'},ensure_ascii=False,indent=2))
  print(json.dumps(results,ensure_ascii=False));await browser.close()
asyncio.run(main())
