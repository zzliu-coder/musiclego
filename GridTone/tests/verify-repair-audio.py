"""Actual OfflineAudioContext rendering; acoustic measurement is not human listening."""
import argparse,base64,hashlib,json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/os.environ.get('REPAIR_EVIDENCE_DIR','docs/workspace-1.8/evidence');(OUT/'audio').mkdir(parents=True,exist_ok=True)
ap=argparse.ArgumentParser();ap.add_argument('--browser',default=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'));a=ap.parse_args();html=(ROOT/'dist/index.html').read_text();rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);page=b.new_page();page.set_content(html);page.wait_for_function('window.GridToneApp');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 presets=page.evaluate('GridTone.PRESETS.map(p=>({id:p.id,name:p.name,engine:p.engine}))')
 for preset in presets:
  result=page.evaluate('''async preset=>{const G=GridTone,p=G.blankProject(),t=G.newTrack(preset.engine==='drum'?'drum':'melodic',0,preset.id);p.tracks=[t];p.bars=1;p.bpm=120;t.patterns[0].notes=(t.kind==='drum'?[36,38,42,46]:preset.id.includes('bass')?[36,43,40,48]:[60,64,67,72]).map((n,i)=>G.newNote(n,i*960,600,.7));G.pinDocument(p);const r=await new G.AudioEngine().exportWav(G.validateProject(p),{kind:'song'});let energy=0,n=0;for(let c=0;c<r.buffer.numberOfChannels;c++)for(const x of r.buffer.getChannelData(c)){if(!Number.isFinite(x))throw Error('non-finite');energy+=x*x;n++;}return {peak:r.peak,rms:Math.sqrt(energy/n),seconds:r.buffer.duration,bytes:r.blob.size};}''',preset)
  assert result['rms']>1e-6,preset;rows.append({'type':'preset',**preset,**result,'status':'PASS'});print('PASS sound',preset['id'],flush=True)
 recipes=page.evaluate('GridTone.RECIPES.map(r=>({id:r.id,name:r.name}))')
 for i,recipe in enumerate(recipes):
  result=page.evaluate('''async id=>{const G=GridTone,p=G.recipeProject(id),r=await new G.AudioEngine().exportWav(p,{kind:'song'});let e=0,n=0;for(const x of r.buffer.getChannelData(0)){e+=x*x;n++;}const data=new Uint8Array(await r.blob.arrayBuffer());let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode(...data.subarray(i,i+32768));return {data:btoa(binary),peak:r.peak,rms:Math.sqrt(e/n),seconds:r.buffer.duration,project:p,events:G.compileSong(p).events.length};}''',recipe['id'])
  raw=base64.b64decode(result.pop('data'));(OUT/'audio'/f'{recipe["id"]}.wav').write_bytes(raw);project=result.pop('project');(OUT/'audio'/f'{recipe["id"]}.gridtone').write_text(json.dumps(project,ensure_ascii=False));assert raw[:4]==b'RIFF' and result['rms']>1e-6
  rows.append({'type':'recipe',**recipe,**result,'file':f'audio/{recipe["id"]}.wav','audioSha256':hashlib.sha256(raw).hexdigest(),'status':'PASS','listening':'NOT_RUN'});print('PASS recipe',recipe['id'],flush=True)
 assert not errors
 browser=b.version;b.close()
report={'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':browser,'scope':'Actual Chromium OfflineAudioContext. No physical audio output, listening review, external real-sample download, or Safari claim.','status':'PASS','checks':rows,'counts':{'presets':len(presets),'recipes':len(recipes)},'manualListening':'NOT_RUN'};(OUT/'audio.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('Audio measured:',len(rows))
