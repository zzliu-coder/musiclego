"""Second-pass production page checks. DOM and Web Audio real; document fixtures via public commit.
Inline page origin does not validate persistent IndexedDB. --url can run on a real origin.
"""
import argparse, hashlib, json, os, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--out',default='docs/reaudit-1.7.2/evidence/reaudit-browser');ap.add_argument('--url');ap.add_argument('--browser',default=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'));args=ap.parse_args()
O=R/args.out;O.mkdir(parents=True,exist_ok=True);html=(R/'dist/index.html').read_text();checks=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def run(name,fn):
  ctx=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(7000);start=time.time()
  try:
   if args.url:page.goto(args.url)
   else:page.set_content(html,wait_until='load')
   page.wait_for_function('window.GridToneApp');page.wait_for_timeout(250)
   page.evaluate('''()=>{const A=GridToneApp,G=GridTone;A.playback.stop();let p=G.recipeProject('recipe.pop');p.id=A.getProject().id;p.bars=12;const t=p.tracks.at(-1);let r=A.materials.c.commit({project:p,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});if(r?.ok===false)throw Error(r.error.message);A.changeView('edit');}''')
   detail=fn(page);assert not errors,errors
   checks.append({'id':name,'status':'PASS','seconds':round(time.time()-start,3),'detail':detail});print('PASS',name,flush=True)
  except Exception as e:
   checks.append({'id':name,'status':'FAIL','error':str(e),'pageErrors':errors,'trace':traceback.format_exc()});print('FAIL',name,str(e)[:300],flush=True)
   try:page.screenshot(path=str(O/(name+'.png')))
   except:pass
  ctx.close()
 def ev(p,s,a=None):return p.evaluate(s,a)
 def action(p,a):p.locator('[data-action="'+a+'"]').filter(visible=True).first.click()
 def deltarget(p):return ev(p,'''()=>{const A=GridToneApp,p=A.getProject(),s=A.getState();p.tracks=p.tracks.filter(t=>t.id!==s.trackId);const t=p.tracks[0];return A.materials.c.commit({project:p,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});}''')
 def composer_removed(p):
  action(p,'composer');deltarget(p)
  assert ev(p,"document.querySelector('#creation-dock').hidden"),'Deleted target still owns chord panel'
  return {'closed':True}
 run('U01-chord-panel-target-deletion',composer_removed)
 def creation_removed(p):
  action(p,'creation');deltarget(p)
  assert ev(p,'GridToneApp.creation.session===null'),'Deleted target still owns generator'
  return {'closed':True}
 run('U02-generator-target-deletion',creation_removed)
 def global_no_anchor(p):
  p.locator('[data-view="mix"]').click();action(p,'creation');deltarget(p);action(p,'creation-generate')
  assert ev(p,'GridToneApp.creation.session.candidates.length')==1
  return {'globalCandidate':True}
 run('U03-global-mix-independent-of-old-selection',global_no_anchor)
 def count(p):
  n=ev(p,'()=>{GridTone.installCatalog(GridTone.EXAMPLE_CATALOG);GridToneApp.materials.listing();return GridTone.catalogContents().packs.length;}')
  text=p.locator('.catalog-footer').inner_text();assert f'已导入 {n} 个素材包' in text,text
  assert p.locator('[data-action="export-catalog"]').count()==1
  return {'count':n}
 run('U04-library-pack-count-and-backup',count)
 def kit(p):
  out=ev(p,'''()=>{const A=GridToneApp,G=GridTone,p=A.getProject(),t=p.tracks.find(t=>t.kind==='drum'),kit=G.clone(G.resolveKit(t.drumkitId,p));kit.id='reaudit.customkit';kit.rows.forEach(r=>{r.role=G.drumRole(r);r.pitch+=12});G.installCatalog({id:'reaudit.pack',name:'Test',format:'gridtone.catalog',version:1,drumkits:[kit]});A.openPattern({trackId:t.id});A.materials.select('drumkits',kit.id);const result=A.materials.buildCandidate(),out=result.project.tracks.find(v=>v.id===t.id);return {before:t.patterns[0].notes,after:out.patterns[0].notes}}''')
  assert [n['pitch']+12 for n in out['before']]==[n['pitch'] for n in out['after']],'Kit change did not preserve drum roles'
  assert [(n['id'],n['start'],n['duration'],n['velocity']) for n in out['before']]==[(n['id'],n['start'],n['duration'],n['velocity']) for n in out['after']]
  return {'notes':len(out['after'])}
 run('U05-kit-role-remap',kit)
 def recipe(p):
  out=ev(p,'''async()=>{const A=GridToneApp,G=GridTone,p=A.getProject();p.key=5;A.materials.c.commit({project:p,...A.getState()});await A.shelf.preview('recipe.pop');const preview=A.playback.auditionProject,first=preview.tracks.find(t=>t.role==='chords').patterns[0];A.playback.stop();A.shelf.choose('recipe.pop');const plan=A.shelf.place({bar:4}),after=plan.project.tracks.at(-5).patterns[0];return {previewKey:preview.key,preview:G.musicalNotes(first.notes),applied:G.musicalNotes(after.notes)}}''')
  assert out['previewKey']==5,out['previewKey'];assert out['preview']==out['applied']
  return {'key':out['previewKey'],'notes':len(out['applied'])}
 run('U06-recipe-preview-matches-target-key',recipe)
 def current_export(p):
  expected=ev(p,'''async()=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks.at(-1);t.patterns[0].notes=[G.newNote(100,0,240)];const scope={kind:'pattern',trackId:t.id,patternId:t.patterns[0].id,ignoreMute:true};await A.playback.audition(d,scope,'current preview');return Array.from(G.encodeMidi(d,scope))}''')
  action(p,'export');p.locator('#export-scope').select_option('current')
  with p.expect_download() as info:action(p,'export-midi')
  d=O/'current-preview.mid';info.value.save_as(d);assert list(d.read_bytes())==expected,'Current export differs from preview MIDI'
  return {'bytes':len(expected)}
 run('U07-export-current-preview-MIDI',current_export)
 def bake(p):
  out=ev(p,'''()=>{const A=GridToneApp,G=GridTone,p=A.getProject(),t=p.tracks[0];t.patterns[0].notes[0].pitch++;t.pipeline.transpose=2;A.materials.c.commit({project:p,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});return G.harmonyStatus(t.patterns[0])}''');assert out=='stale'
  p.locator('[data-tab="pipeline"]').click();action(p,'bake-pipeline');action(p,'confirm')
  assert ev(p,'GridTone.harmonyStatus(GridToneApp.getProject().tracks[0].patterns[0])')=='stale'
  action(p,'undo');assert ev(p,'GridToneApp.getProject().tracks[0].pipeline.transpose')==2
 run('U08-bake-stale-harmony-and-undo',bake)
 def current_wav(p):
  expected=ev(p,'''async()=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks.at(-1);t.patterns[0].notes=[G.newNote(76,G.BAR,480)];const scope={kind:'song',range:[G.BAR,2*G.BAR],soloIds:[t.id]};await A.playback.audition(d,scope,'One-bar preview');return Math.ceil((4*60/d.bpm+3)*44100)}''')
  action(p,'export');p.locator('#export-scope').select_option('current')
  with p.expect_download(timeout=60000) as info:action(p,'export-wav')
  out=O/'current-preview.wav';info.value.save_as(out)
  import wave
  with wave.open(str(out)) as w:assert w.getnframes()==expected,(w.getnframes(),expected);assert w.getframerate()==44100
  return {'frames':expected,'bytes':out.stat().st_size}
 run('U09-export-current-preview-WAV-range',current_wav)
 def paused_range(p):
  out=ev(p,'''async()=>{const A=GridToneApp,G=GridTone,d=A.getProject();await A.playback.audition(d,{kind:'song',range:[0,4*G.BAR]},'old preview');await A.playback.toggle();A.playback.setRange([4*G.BAR,8*G.BAR]);await A.playback.toggle();return {audition:A.playback.auditionProject!==null,range:A.engine.scope.range,target:A.getPlayback().target,playing:A.engine.playing}}''')
  assert not out['audition'] and out['range']==[4*3840,8*3840] and out['target']=='song' and out['playing'];return out
 run('U10-paused-audition-new-loop',paused_range)
 def panel_switch(p):
  action(p,'composer');action(p,'composer-preview');action(p,'creation');assert ev(p,'GridToneApp.composer.options===null');action(p,'creation-generate');action(p,'composer');assert ev(p,'GridToneApp.creation.session===null');action(p,'creation-close');assert ev(p,'GridToneApp.composer.options===null && GridToneApp.creation.session===null');assert ev(p,'document.querySelector("#creation-dock").hidden')
 run('U11-one-active-creation-owner',panel_switch)
 def drum_dependencies(p):
  ev(p,'''()=>{const A=GridToneApp,p=A.getProject(),t=p.tracks.find(t=>t.role==='bass');A.openPattern({trackId:t.id});}''');action(p,'creation')
  drum=ev(p,"GridToneApp.getProject().tracks.find(t=>t.kind==='drum').id")
  p.locator('[data-field="creation-referenceTrackId"]').select_option(drum);action(p,'creation-generate')
  assert ev(p,'GridToneApp.creation.session.candidates.length')==1
  ev(p,'''()=>{const A=GridToneApp,G=GridTone,p=A.getProject(),t=p.tracks.find(t=>t.kind==='drum'),kit=G.clone(G.resolveKit(t.drumkitId,p));kit.id='check.switch';kit.rows.forEach(r=>{r.role=G.drumRole(r);if(r.role==='kick')r.role='snare';else if(r.role==='snare')r.role='kick'});p.catalog??={presets:[],drumkits:[]};p.catalog.drumkits.push(kit);t.drumkitId=kit.id;A.materials.c.commit({project:p,...A.getState()});}''')
  assert ev(p,'GridToneApp.creation.session.candidates.length')==0;assert p.locator('[data-action="creation-apply"]').count()==0
 run('U12-source-drum-role-change-invalidates',drum_dependencies)
 def kit_atomic(p):
  out=ev(p,'''()=>{const A=GridToneApp,G=GridTone,p=A.getProject(),t=p.tracks.find(t=>t.kind==='drum'),kit=G.clone(G.resolveKit(t.drumkitId,p));kit.id='missing.kick';kit.rows=kit.rows.filter(r=>G.drumRole(r)!=='kick');G.installCatalog({id:'missing.pack',name:'Missing test',format:'gridtone.catalog',version:1,drumkits:[kit]});A.openPattern({trackId:t.id});const before=JSON.stringify(A.getProject());A.materials.select('drumkits',kit.id);let message;try{A.materials.buildCandidate()}catch(e){message=e.message}return {unchanged:before===JSON.stringify(A.getProject()),message}}''')
  assert out['unchanged'] and 'kick' in out['message'];return out
 run('U13-missing-drum-role-rejects-atomically',kit_atomic)
 def recipe_context(p):
  out=ev(p,'''async()=>{const A=GridToneApp,G=GridTone,d=A.getProject();d.key=9;d.bpm=63;d.swing=.21;d.master=.6;A.materials.c.commit({project:d,...A.getState()});await A.shelf.preview('recipe.dance');const preview=A.playback.auditionProject;A.playback.stop();A.shelf.choose('recipe.dance');const applied=A.shelf.place({bar:0}).project;const newIds=new Set(applied.tracks.slice(-5).map(t=>t.id));const events=q=>G.compileSong(q).events.map(n=>[n.pitch,n.start,n.duration,n.velocity]);return {timing:[preview.bpm,preview.swing,preview.master],preview:events(preview),applied:G.compileSong(applied,{kind:'tracks',trackIds:[...newIds]}).events.map(n=>[n.pitch,n.start,n.duration,n.velocity])}}''')
  assert out['timing']==[63,.21,.6];assert out['preview']==out['applied'];return {'timing':out['timing'],'events':len(out['preview'])}
 run('U14-recipe-preview-effective-tempo-swing',recipe_context)
 def bake_equivalence(p):
  before=ev(p,'''()=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks[0];t.pipeline.transpose=2;t.pipeline.humanize=13;t.pipeline.arp='up';d.swing=.17;A.materials.c.commit({project:d,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});return G.compileSong(A.getProject(),{kind:'tracks',trackIds:[t.id]}).events.map(n=>[n.pitch,n.start,n.duration,n.velocity])}''')
  p.locator('[data-tab="pipeline"]').click();action(p,'bake-pipeline');action(p,'confirm')
  after=ev(p,'''()=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks[0];return {status:G.harmonyStatus(t.patterns[0]),events:G.compileSong(d,{kind:'tracks',trackIds:[t.id]}).events.map(n=>[n.pitch,n.start,n.duration,n.velocity])}}''')
  assert after['status']=='confirmed';assert after['events']==before
 run('U15-confirmed-bake-preserves-performed-music',bake_equivalence)
 def kit_apply_history(p):
  out=ev(p,'''()=>{const A=GridToneApp,G=GridTone,d=A.getProject(),t=d.tracks.find(t=>t.kind==='drum'),kit=G.clone(G.resolveKit(t.drumkitId,d));kit.id='history.kit';kit.rows.forEach(r=>{r.role=G.drumRole(r);r.pitch+=12});G.installCatalog({id:'history.pack',name:'history',format:'gridtone.catalog',version:1,drumkits:[kit]});A.openPattern({trackId:t.id});A.materials.select('drumkits',kit.id);return {original:t.patterns[0].notes.map(n=>n.pitch),history:A.getHistory().undo,trackId:t.id}}''')
  action(p,'catalog-apply');p.wait_for_timeout(80)
  assert ev(p,'GridToneApp.getHistory().undo')==out['history']+1
  got=ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).patterns[0].notes.map(n=>n.pitch)',out['trackId']);assert got==[n+12 for n in out['original']]
  action(p,'undo');assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).patterns[0].notes.map(n=>n.pitch)',out['trackId'])==out['original'];action(p,'redo');assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).patterns[0].notes.map(n=>n.pitch)',out['trackId'])==got
 run('U16-kit-apply-single-undo-redo',kit_apply_history)
 result={'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'mode':'origin' if args.url else 'inline production HTML','checks':checks,'counts':{s:sum(r['status']==s for r in checks)for s in ['PASS','FAIL']},'scope':'Actual production HTML. Same-document fixtures use public commit. Export and buttons real; no origin persistence claim.'}
 (O/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
print(result['counts']);raise SystemExit(1 if result['counts']['FAIL'] else 0)
