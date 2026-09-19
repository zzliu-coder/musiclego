"""Short final-build native audio render checks. No perceptual sound rating."""
from pathlib import Path
import hashlib,json,time,os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];O=R/'docs/recovery-2.2/evidence/audio-smoke';O.mkdir(parents=True,exist_ok=True)
H=(R/'dist/index.html').read_text();out=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);p=b.new_page();p.set_content(H);p.wait_for_function('window.GridToneApp');start=time.monotonic()
 ids=p.evaluate("[GridTone.PRESETS[0].id,'studio.va.round','studio.fm.tine','drums','softdrums','prism.marimba']")
 # Resolve the existing modal preset by engine, avoiding assumptions about its ID.
 ids[-1]=p.evaluate("GridTone.projectPresets(GridToneApp.getProject()).find(p=>p.engine==='prism-modal').id")
 for id in ids:
  row=p.evaluate('''async id=>{const G=GridTone,p=G.blankProject(),pr=G.resolvePreset(id,p),t=G.newTrack(pr.engine==='drum'?'drum':'melodic',0,id);p.tracks=[t];p.bars=1;p.bpm=120;t.patterns[0].bars=1;t.fx={reverb:0,delay:0,drive:0};t.patterns[0].notes=(t.kind==='drum'?[36,38,42,46]:[48,55,60,64]).map((pitch,i)=>G.newNote(pitch,i*G.PPQ,G.PPQ/2,.65));G.pinDocument(p);const r=await new G.AudioEngine().exportWav(p,{kind:'song'});let sum=0,peak=0,n=0;for(let c=0;c<r.buffer.numberOfChannels;c++)for(const x of r.buffer.getChannelData(c)){if(!Number.isFinite(x))throw Error('Nonfinite audio');sum+=x*x;peak=Math.max(peak,Math.abs(x));n++;}return {id,frames:r.buffer.length,channels:r.buffer.numberOfChannels,sampleRate:r.buffer.sampleRate,peak,rms:Math.sqrt(sum/n),bytes:r.blob.size}}''',id)
  assert row['rms']>1e-6 and row['peak']<=1.01,row
  row['status']='PASS';out.append(row);print('PASS',id,flush=True)
 result={'version':'2.2.0','htmlSha256':hashlib.sha256(H.encode()).hexdigest(),'environment':'Linux Chromium native OfflineAudioContext; no listening or real Mac assertion','status':'PASS','checks':out,'seconds':round(time.monotonic()-start,2),'browser':b.version}
 (O/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
