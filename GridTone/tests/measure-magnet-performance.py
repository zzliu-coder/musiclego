"""Comparable production interaction probes. Same host, sequential builds, no native-latency claim."""
import json,hashlib,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,fixture,gridpoint
O=R/'docs/magnet-2.1/evidence/performance';O.mkdir(parents=True,exist_ok=True)
inputs=[('baseline-2.0',Path(os.getenv('LEGOU_BASELINE',str(R/'tests/fixtures/v2.0/app.html')))),('warm-magnetic',R/'dist/index.html')];reports=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 for name,path in inputs:
  p=b.new_page(viewport={'width':1440,'height':900});html=path.read_text();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html);p.wait_for_function('GridToneApp');fixture(p,notes=False);act(p,'play');p.wait_for_function('GridToneApp.engine.playing');p.wait_for_timeout(400);xy=gridpoint(p,240,60)
  ev(p,'''()=>{window.probe={latencies:[],frames:[],longTasks:[]};window.monitor=true;let prev=performance.now();function step(){const now=performance.now();if(!monitor)return;probe.frames.push(now-prev);prev=now;requestAnimationFrame(step)}requestAnimationFrame(step);document.addEventListener('pointermove',()=>{if(!monitor)return;const at=performance.now();requestAnimationFrame(()=>probe.latencies.push(performance.now()-at));},true);try{new PerformanceObserver(list=>{if(monitor)probe.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})));}).observe({type:'longtask',buffered:false});}catch{}}''')
  p.mouse.move(xy['x'],xy['y']);p.mouse.down()
  for i in range(100):p.mouse.move(xy['x']+(i%25)*5,xy['y']);p.wait_for_timeout(16)
  p.mouse.up();p.wait_for_timeout(50);v=ev(p,'()=>{monitor=false;return probe}');act(p,'stop')
  def pct(xs,q):a=sorted(xs);return round(a[min(len(a)-1,int(len(a)*q))],3) if a else None
  report={'label':name,'sha256':hashlib.sha256(html.encode()).hexdigest(),'inputSamples':len(v['latencies']),'nextFrameP50':pct(v['latencies'],.5),'nextFrameP95':pct(v['latencies'],.95),'frameP95':pct(v['frames'],.95),'frameP99':pct(v['frames'],.99),'longTasks':v['longTasks'],'framesOver50':sum(x>50 for x in v['frames']),'samples':v,'errors':errors};reports.append(report);print({k:v for k,v in report.items() if k not in ['samples','longTasks']});p.close()
 b.close()
(O/'comparison.json').write_text(json.dumps({'metric':'Pointer DOM dispatch to next rAF callback measured using performance.now (not rAF frame timestamp). Frames from consecutive callbacks; real pointer movement while production audio plays. Sequential builds on same Linux host. No native device or audio-output latency claim.','targetP95ms':50,'status':'MEASURED','builds':reports},indent=2,ensure_ascii=False))
