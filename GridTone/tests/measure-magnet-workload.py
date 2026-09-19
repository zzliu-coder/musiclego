"""Same dense music fixture on baseline/current, with both motion settings. No native latency claim."""
from pathlib import Path
import json,hashlib,os
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,gridpoint
O=R/'docs/magnet-2.1/evidence/performance';O.mkdir(parents=True,exist_ok=True);rows=[]
setup='''()=>{const A=GridToneApp,G=GridTone;A.playback.stop();let d=G.recipeProject('studio.combo.warm');d.id=A.getProject().id;d.bars=32;const copyIds=d.tracks.slice(0,3).map(t=>t.id);for(const id of copyIds)d=G.duplicateTrack(d,id).project;for(const t of d.tracks){const base=t.clips[0];t.clips=Array.from({length:4},(_,i)=>({...base,id:G.uid('clip'),bar:i*8}));t.volume*=.55;}const t=d.tracks.at(-1),p=t.patterns[0];p.notes=[G.newNote(60,0,960,.6)];A.materials.c.commit({project:d,trackId:t.id,clipId:t.clips[0].id,patternId:p.id});A.openPattern({trackId:t.id,clipId:t.clips[0].id,edit:true,activation:'notes'});return {tracks:d.tracks.length,bars:d.bars,events:G.compileSong(d).events.length}}'''
with sync_playwright() as w:
 b=w.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 for name,path,reduced in [('baseline-2.0',R/'tests/fixtures/v2.0/app.html',False),('warm-magnetic',R/'dist/index.html',False),('warm-no-motion',R/'dist/index.html',True)]:
  p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));html=path.read_text();p.set_content(html);p.wait_for_function('GridToneApp');fixture=ev(p,setup)
  if reduced:ev(p,"GridTone.appearance.set({motion:'reduced'})")
  act(p,'play');p.wait_for_function('GridToneApp.engine.playing');xy=gridpoint(p,1440,60);p.wait_for_timeout(500)
  ev(p,'''()=>{window.probe={latencies:[],frames:[],longTasks:[]};window.monitor=true;let prev=null;function tick(){const n=performance.now();if(!monitor)return;if(prev!==null)probe.frames.push(n-prev);prev=n;requestAnimationFrame(tick)}requestAnimationFrame(tick);document.addEventListener('pointermove',()=>{if(monitor){const at=performance.now();requestAnimationFrame(()=>probe.latencies.push(performance.now()-at))}},true);try{new PerformanceObserver(xs=>{if(monitor)probe.longTasks.push(...xs.getEntries().map(e=>({start:e.startTime,duration:e.duration})))}).observe({type:'longtask',buffered:false})}catch{}}''')
  p.mouse.move(xy['x'],xy['y']);p.mouse.down()
  for n in range(180):p.mouse.move(xy['x']+(n%25)*4,xy['y']);p.wait_for_timeout(16)
  p.mouse.up();p.wait_for_timeout(60);q=ev(p,'()=>{monitor=false;return probe}');act(p,'stop')
  def pct(a,k):a=sorted(a);return round(a[min(len(a)-1,int(len(a)*k))],3)
  row={'label':name,'sha256':hashlib.sha256(html.encode()).hexdigest(),'fixture':fixture,'motionReduced':reduced,'inputSamples':len(q['latencies']),'nextFrameP95':pct(q['latencies'],.95),'frameP95':pct(q['frames'],.95),'frameP99':pct(q['frames'],.99),'over50':sum(x>50 for x in q['frames']),'longTasks':q['longTasks'],'raw':q,'pageErrors':errors};assert not errors and row['inputSamples']>=175;rows.append(row);print({k:v for k,v in row.items() if k not in ['raw','longTasks']},flush=True);p.close()
 (O/'workload.json').write_text(json.dumps({'status':'MEASURED','scope':'Three sequential production runs, eight tracks ×32 bars, actual playback and pointer input; dispatch→next rAF proxy, not input-to-photon/audio output latency. Shared Linux host, other long-running soak may be active.','browser':b.version,'rows':rows},ensure_ascii=False,indent=2));b.close()
