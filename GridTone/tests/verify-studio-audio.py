"""Native OfflineAudioContext regression, instrument features and combination exports.
No auditory/listener judgment is implied by these signal measurements.
"""
from pathlib import Path
import json,os,base64,hashlib,math,time
import numpy as np
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];O=R/os.getenv('AUDIO_EVIDENCE_DIR','docs/content-2.0/evidence/audio');O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/index.html').read_text();legacy=Path(os.getenv('LEGOU_LEGACY_HTML',str(R/'tests/fixtures/v1.9/app.html')));rows=[]
render=r'''async ({id,mode='preset',save=false})=>{
const G=GridTone;let p;
if(mode==='combo'||mode==='recipe')p=G.recipeProject(id);
else{p=G.blankProject();const preset=G.resolvePreset(id,p),drum=preset.engine==='drum',t=G.newTrack(drum?'drum':'melodic',0,id);p.tracks=[t];p.bpm=120;p.bars=4;p.swing=0;t.volume=.65;t.fx={reverb:.08,delay:0,drive:0};p.master=.8;t.patterns[0].bars=4;
const pitches=drum?[36,38,42,46,36,38,42,46]:preset.category==='低音'?[36,36,43,48,36,43,40,36]:[60,60,64,67,60,64,67,72];
t.patterns[0].notes=pitches.map((n,i)=>({...G.newNote(n,i*1680,i%3===0?1440:600,[.35,.7,.95,.6][i%4]),id:'probe_'+i}));G.pinDocument(p);}
const result=await new G.AudioEngine().exportWav(G.validateProject(p),{kind:'song'});let energy=0,dc=0,peak=0,frames=0;const vector=[];
for(let c=0;c<result.buffer.numberOfChannels;c++){const data=result.buffer.getChannelData(c);for(const x of data){if(!Number.isFinite(x))throw Error('nonfinite');energy+=x*x;dc+=x;peak=Math.max(peak,Math.abs(x));frames++;}}
const step=256,data=result.buffer.getChannelData(0);for(let offset=0;offset<data.length;offset+=step){let a=0;for(let i=offset;i<Math.min(data.length,offset+step);i++)a+=data[i]*data[i];vector.push(Math.sqrt(a/step));}
const blobdata=new Uint8Array(await result.blob.arrayBuffer());let bin='';for(let n=0;n<blobdata.length;n+=32768)bin+=String.fromCharCode(...blobdata.subarray(n,n+32768));
return {id,data:btoa(bin),project:p,peak,rms:Math.sqrt(energy/frames),dc:dc/frames,seconds:result.buffer.duration,frames,bytes:result.blob.size,envelope:vector};}'''
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);p=b.new_page();p.set_content(html);p.wait_for_function('window.GridToneApp');errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 old=None
 if legacy.exists():old=b.new_page();old.set_content(legacy.read_text());old.wait_for_function('window.GridToneApp')
 ids=p.evaluate('GridTone.projectPresets(GridToneApp.getProject()).map(p=>({id:p.id,name:p.name,engine:p.engine}))')
 features={};start=time.monotonic()
 for item in ids:
  result=p.evaluate(render,{'id':item['id']});raw=base64.b64decode(result.pop('data'));project=result.pop('project');envelope=np.asarray(result.pop('envelope'))
  assert result['rms']>1e-6 and abs(result['dc'])<.03,result
  pcm=np.frombuffer(raw[44:],dtype='<i2').reshape(-1,2).astype(float)/32768
  spectrum=np.abs(np.fft.rfft(pcm[:min(len(pcm),44100*6),0]));freq=np.linspace(0,22050,len(spectrum));energy=spectrum**2
  centroid=float(np.sum(freq*energy)/max(energy.sum(),1e-12));bands=[float(energy[(freq>=a)&(freq<z)].sum()/max(energy.sum(),1e-12))for a,z in [(0,150),(150,600),(600,2000),(2000,6000),(6000,22051)]]
  result.update(**item,sha256=hashlib.sha256(raw).hexdigest(),status='PASS',spectralCentroidHz=centroid,bandEnergy=bands,listening='NOT_RUN')
  features[item['id']]={'envelope':envelope.tolist(),'bands':bands,'centroid':centroid}
  if item['id'].startswith('studio.'):
   filename=item['id']+'.wav';(O/filename).write_bytes(raw);result['file']=filename
  elif old:
   oldresult=old.evaluate(render,{'id':item['id']});oldraw=base64.b64decode(oldresult['data']);result['legacyAudioSame']=oldraw==raw;delta=np.frombuffer(raw[44:],dtype='<i2').astype(float)-np.frombuffer(oldraw[44:],dtype='<i2').astype(float);result['legacyDelta']={'maxLSB':float(np.abs(delta).max()),'rmsLSB':float(np.sqrt(np.mean(delta**2))),'changedSamples':int(np.count_nonzero(delta))};result['legacyAudioEquivalent']=result['legacyDelta']['maxLSB']<=1 and result['legacyDelta']['rmsLSB']<.1;assert result['legacyAudioEquivalent'],{'id':item['id'],'reason':'Legacy audio changed beyond measured quantization variation','delta':result['legacyDelta']}
  rows.append(result);print('PASS preset',item['id'],round(result['rms'],5),flush=True)
 combos=p.evaluate('[...GridTone.STUDIO_COMBOS,...GridTone.RECIPES].map(p=>({id:p.id,name:p.name}))')
 for c in combos:
  result=p.evaluate(render,{'id':c['id'],'mode':'combo'});raw=base64.b64decode(result.pop('data'));project=result.pop('project');result.pop('envelope');assert result['rms']>1e-6
  path=c['id']+'.wav';(O/path).write_bytes(raw);(O/(c['id']+'.gridtone')).write_text(json.dumps(project,ensure_ascii=False));result.update(**c,status='PASS',file=path,sha256=hashlib.sha256(raw).hexdigest(),listening='NOT_RUN',type='combination')
  # Old eight recipe hashes have source-generated IDs; compare measured sound.
  if c['id'].startswith('recipe.') and old:
   check=old.evaluate(render,{'id':c['id'],'mode':'recipe'});oldraw=base64.b64decode(check['data']);result['legacyAudioSame']=oldraw==raw;delta=np.frombuffer(raw[44:],dtype='<i2').astype(float)-np.frombuffer(oldraw[44:],dtype='<i2').astype(float);result['legacyDelta']={'maxLSB':float(np.abs(delta).max()),'rmsLSB':float(np.sqrt(np.mean(delta**2))),'changedSamples':int(np.count_nonzero(delta))};result['legacyAudioEquivalent']=result['legacyDelta']['maxLSB']<=1 and result['legacyDelta']['rmsLSB']<.1;assert result['legacyAudioEquivalent'],{'id':c['id'],'delta':result['legacyDelta']}
  rows.append(result);print('PASS combination',c['id'],round(result['rms'],5),flush=True)
 assert not errors
 # Similarity is a review aid, not an objective "good sound" score. No IDs are removed.
 pairs=[];names=list(features)
 for i,a in enumerate(names):
  for z in names[i+1:]:
   fa,fz=features[a],features[z];ea,ez=np.array(fa['envelope']),np.array(fz['envelope']);ea/=max(np.linalg.norm(ea),1e-12);ez/=max(np.linalg.norm(ez),1e-12)
   shape=float(ea@ez);band=float(np.linalg.norm(np.array(fa['bands'])-np.array(fz['bands'])));score=shape*.65+(1-min(1,band))*.35
   pairs.append({'a':a,'b':z,'score':round(score,5),'envelopeCosine':round(shape,5),'bandDistance':round(band,5)})
 pairs.sort(key=lambda x:-x['score']);(O/'similarity-review.json').write_text(json.dumps({'method':'Same within-role test phrase, amplitude-normalized envelope + coarse spectral bands. Suggests comparisons; does NOT certify perceived identity or listening approval. Families are explicit metadata; old preset IDs stay playable.','pairs':pairs[:160],'features':features},ensure_ascii=False,indent=2))
 result={'version':json.loads((R/'package.json').read_text())['version'],'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'wallSeconds':round(time.monotonic()-start,2),'status':'PASS','counts':{'presets':len(ids),'combinations':len(combos),'legacyExact':sum(r.get('legacyAudioSame',False)for r in rows),'legacyWithinQuantization':sum(r.get('legacyAudioEquivalent',False)for r in rows)},'checks':rows,'pageErrors':errors,'manualListening':'NOT_RUN','platform':'Linux Chromium OfflineAudioContext; not physical Mac Chrome or listening'}
 (O/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(result['counts']);b.close()
