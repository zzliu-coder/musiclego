"""2.0 production browser: catalog, families, native sounds, tray and platform keys.
Setup uses public app API. OS clipboard test doubles are explicitly labeled.
The page contains the complete real application. This is not physical macOS certification.
"""
import os,json,hashlib,time,traceback,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
from design_harness import R,ev,act,fixture,ns,note,setcursor,gen
O=R/os.getenv('STUDIO_EVIDENCE_DIR','docs/content-2.0/evidence/studio-browser');(O/'screens').mkdir(parents=True,exist_ok=True);(O/'downloads').mkdir(exist_ok=True)
html=(R/'dist/index.html').read_text();checks=[]
def raw(p):return ev(p,'JSON.stringify(GridToneApp.getProject())')
def history(p):return ev(p,'GridToneApp.getHistory().undo')
def library(p,kind='combo',id=None):
 if id:ev(p,'({kind,id})=>GridToneApp.library.open(kind,id)',{'kind':kind,'id':id})
 else:
  act(p,'library-open',':not([data-id])')
  act(p,'library-kind',f'[data-kind="{kind}"]')
 p.wait_for_timeout(60)
def close(p):act(p,'library-close')
def set_target(p,tid):p.locator('[data-library-field="target"]').select_option(tid)
def selectf(p,id):
 loc=p.locator(f'[data-action="library-family"][data-family="{id}"]')
 if loc.count()==0:
  p.locator('[data-action="library-next"]').click()
 p.locator(f'[data-action="library-family"][data-family="{id}"]').click()
def same_notes(p,tid,before):assert ev(p,'tid=>GridToneApp.getProject().tracks.find(t=>t.id===tid).patterns',tid)==before
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 def run(id,fn):
  c=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=c.new_page();p.set_default_timeout(6500);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));start=time.monotonic()
  try:
   p.set_content(html,wait_until='load');p.wait_for_function('window.GridToneApp');p.wait_for_timeout(180)
   detail=fn(p);assert not errors,errors;checks.append({'id':id,'status':'PASS','seconds':round(time.monotonic()-start,3),'detail':detail});print('PASS',id,flush=True)
  except Exception as e:
   checks.append({'id':id,'status':'FAIL','message':str(e),'trace':traceback.format_exc(),'pageErrors':errors});print('FAIL',id,str(e)[:600],flush=True)
  finally:
   try:p.screenshot(path=str(O/'screens'/f'{id}.png'))
   except:pass
   c.close()
 def home(p):
  assert ev(p,'GridToneApp.version')==json.loads((R/'package.json').read_text())['version'];assert p.locator('.workspace-tabs').inner_text().split()==['编排','混音'];assert p.locator('.shelf-card').count()<=12;assert p.locator('.shelf-browse .btn.active').inner_text()=='托盘';assert ev(p,'GridToneApp.getProject().title')=='复古暖光'
  return {'trayCards':p.locator('.shelf-card').count(),'presets':ev(p,'GridTone.projectPresets(GridToneApp.getProject()).length'),'templates':ev(p,'GridTone.catalogTemplates().length')}
 run('SB01-preset-first-tray-and-catalog-counts',home)
 def full(p):
  before=raw(p);library(p);assert p.locator('.library-family').count()==6;assert p.locator('.library-variants .btn').count()==3;assert p.locator('.workspace-body').get_attribute('inert') is not None;assert p.locator('#edit-command-bar').get_attribute('inert') is not None
  act(p,'library-variant','[data-id="studio.combo.warm.ending"]');assert '收尾' in p.locator('.library-detail h3').inner_text();assert raw(p)==before;close(p);assert p.locator('.workspace-body').get_attribute('inert') is None;assert raw(p)==before
 run('SB02-wide-browser-family-variants-preserve-document',full)
 def search(p):
  library(p,'sound');assert p.locator('.library-family').count()==12;act(p,'library-next');assert 0<p.locator('.library-family').count()<=12
  p.locator('#studio-search').fill('FM');assert p.locator('.library-family').count()>=2;act(p,'library-view');assert p.locator('.library-family-grid.is-list').count()==1
  p.locator('#studio-search').fill('不存在_zyx');assert '没有匹配' in p.locator('.library-results').inner_text();act(p,'library-reset');assert p.locator('.library-family').count()>0
 run('SB03-search-pagination-list-empty-state',search)
 def legacy(p):
  library(p,'sound');base=ev(p,'GridToneApp.library.familyList().length');p.locator('[data-library-field="legacy"]').check();assert ev(p,'GridToneApp.library.familyList().length')>=base
  p.locator('#studio-search').fill('基础钢琴');assert p.locator('.library-family').count()==1
  ids=ev(p,'GridTone.studioFamilies(GridToneApp.getProject(),{kind:"sound",legacy:true}).flatMap(f=>f.members)');allids=ev(p,'GridTone.projectPresets(GridToneApp.getProject()).map(p=>p.id)');assert set(allids)<=set(ids)
  return {'reachableSoundIds':len(set(ids))}
 run('SB04-all-legacy-sound-identities-remain-reachable',legacy)
 def favorite(p):
  before=raw(p);library(p,'sound');id=ev(p,'GridToneApp.library.selected');act(p,'library-star');act(p,'library-favorites');assert p.locator('.library-family').count()==1;assert raw(p)==before
  act(p,'library-pin');close(p);assert p.locator('.tray-sound').count()==1;assert ev(p,'id=>GridToneApp.shelf.preferences.tray.includes(id)',id);assert raw(p)==before
 run('SB05-favorite-and-pin-sound-no-music-change',favorite)
 def sound_apply(p):
  f=fixture(p);before=ev(p,'GridToneApp.getProject()');h=history(p);library(p,'sound','studio.fm.tine');set_target(p,f['trackId']);act(p,'library-adopt');assert ev(p,'id=>GridToneApp.getProject().tracks.find(t=>t.id===id).preset',f['trackId'])=='studio.fm.tine';same_notes(p,f['trackId'],before['tracks'][-1]['patterns']);assert ev(p,'GridToneApp.getProject().tracks[0]')==before['tracks'][0];assert history(p)==h+1;close(p);act(p,'undo');assert raw(p)==json.dumps(before,separators=(',',':'),ensure_ascii=False) or ev(p,'GridToneApp.getProject()')==before
 run('SB06-use-sound-keeps-music-other-tracks-and-undo',sound_apply)
 def audition(p):
  f=fixture(p);before=raw(p);h=history(p);library(p,'sound','studio.va.silk');act(p,'library-preview');p.wait_for_timeout(300);assert ev(p,'GridToneApp.engine.playing');assert p.locator('[data-action="library-preview"]').inner_text()=='停止试听';assert raw(p)==before and history(p)==h
  act(p,'stop');p.wait_for_timeout(360);assert not ev(p,'GridToneApp.engine.playing');assert p.locator('[data-action="library-preview"]').inner_text()=='试听';assert ev(p,'GridToneApp.engine.previewGraphs.size')==0
 run('SB07-actual-new-engine-audition-global-stop-state',audition)
 def switching(p):
  fixture(p);library(p,'sound','studio.fm.tine');act(p,'library-preview');act(p,'library-variant','[data-id="studio.fm.softkeys"]');act(p,'library-preview');p.wait_for_timeout(250);assert ev(p,'GridToneApp.playback.context.audition').endswith(ev(p,'GridTone.resolvePreset("studio.fm.softkeys",GridToneApp.getProject()).name'));act(p,'library-kind','[data-kind="rhythm"]');assert not ev(p,'GridToneApp.engine.playing');assert p.locator('[data-action="library-preview"]').inner_text()=='试听'
 run('SB08-switch-sound-and-library-kind-end-old-audition',switching)
 def combo(p):
  before=ev(p,'GridToneApp.getProject()');h=history(p);library(p,'combo','studio.combo.city');p.locator('[data-library-field="bar"]').fill('9');p.locator('[data-library-field="bar"]').press('Tab');act(p,'library-adopt');p.wait_for_timeout(70);after=ev(p,'GridToneApp.getProject()');assert len(after['tracks'])==len(before['tracks'])+5;assert after['tracks'][:len(before['tracks'])]==before['tracks'];assert after['bpm']==before['bpm'];assert all(c['bar']==8 for t in after['tracks'][-5:]for c in t['clips']);assert after['bars']==16;assert history(p)==h+1;act(p,'undo');assert ev(p,'GridToneApp.getProject()')==before
 run('SB09-combination-insert-range-old-mix-kept-one-undo',combo)
 def tempo(p):
  library(p,'combo','studio.combo.night');p.locator('[data-library-field="tempo"]').check();act(p,'library-adopt');assert ev(p,'GridToneApp.getProject().bpm')==84;assert ev(p,'GridToneApp.getProject().swing')==0
 run('SB10-combination-tempo-only-on-explicit-choice',tempo)
 def invalid(p):
  before=raw(p);h=history(p);library(p,'combo');p.locator('[data-library-field="bar"]').fill('253');p.locator('[data-library-field="bar"]').press('Tab');act(p,'library-adopt');p.wait_for_timeout(40);assert raw(p)==before and history(p)==h;assert '超出' in p.locator('.library-status').inner_text()
 run('SB11-combination-range-failure-zero-write',invalid)
 def parts(p):
  before=raw(p);library(p,'combo','studio.combo.pulse');p.locator('.library-advanced summary').click();act(p,'library-parts');close(p);assert raw(p)==before;assert ev(p,'GridToneApp.shelf.preferences.tray.filter(id=>id.startsWith("studio.combo.pulse.part.")).length')==4;assert p.locator('.shelf-card').count()>=4
 run('SB12-split-combination-into-editable-tray-parts',parts)
 def rhythm(p):
  f=fixture(p);ev(p,'''()=>{const A=GridToneApp,p=A.getProject(),t=p.tracks.find(t=>t.kind==='drum');t.patterns[0].bars=4;t.patterns[0].notes=[];A.materials.c.commit({project:p,trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id});A.openPattern({trackId:t.id,clipId:t.clips[0].id,edit:true,activation:'notes'});}''');before=history(p)
  library(p,'rhythm','studio.rhythm.hand-soul.1');act(p,'library-into-block');p.wait_for_timeout(80)
  notes=ns(p);assert len(notes)>20;assert all(n.get('performed') for n in notes);assert any(n['start']%240 for n in notes);assert history(p)==before+1
  result=ev(p,'''()=>{const G=GridTone,A=GridToneApp,p=A.getProject(),t=p.tracks.find(t=>t.id===A.getState().trackId),pat=t.patterns.find(p=>p.id===A.getState().patternId);return {first:G.processPattern(pat,t,{...p,swing:0}).map(n=>n.start),second:G.processPattern(pat,t,{...p,swing:.4}).map(n=>n.start),credits:pat.attributions}}''');assert result['first']==result['second'];assert result['credits'][0]['license']=='CC-BY-4.0';act(p,'undo');assert not ns(p)
  return {'noteCount':len(notes),'credit':result['credits']}
 run('SB13-GMD-microtiming-role-map-adoption-and-undo',rhythm)
 def soundkit(p):
  f=fixture(p);d=ev(p,'GridToneApp.getProject()');t=next(t for t in d['tracks']if t['kind']=='drum');h=history(p);library(p,'sound','studio.drum.metal');set_target(p,t['id']);act(p,'library-adopt');after=ev(p,'GridToneApp.getProject()');tr=next(t1 for t1 in after['tracks']if t1['id']==t['id']);assert tr['drumkitId']=='studio.kit.metal';assert tr['patterns']==t['patterns'];assert history(p)==h+1
 run('SB14-electronic-kit-swap-keeps-rhythm-identities',soundkit)
 def advanced(p):
  f=fixture(p);before=raw(p);h=history(p);library(p,'sound','studio.va.sawlead');set_target(p,f['trackId']);assert not p.locator('[data-action="library-tweak"]').is_visible();p.locator('.library-advanced summary').click();act(p,'library-tweak');p.locator('#studio-custom-name').fill('我的测试音色');p.locator('#studio-custom-cutoff').fill('0.5');act(p,'library-tweak-preview');p.wait_for_timeout(160);assert raw(p)==before and history(p)==h;act(p,'close-modal');assert raw(p)==before
  act(p,'library-tweak');p.locator('#studio-custom-name').fill('我的测试音色');p.locator('#studio-custom-cutoff').fill('0.43');act(p,'library-tweak-save');p.wait_for_timeout(80);d=ev(p,'GridToneApp.getProject()');t=next(t for t in d['tracks']if t['id']==f['trackId']);assert t['preset'].startswith('user.studio.');assert next(x for x in d['catalog']['presets']if x['id']==t['preset'])['synthesis']['cutoff']==.43;assert p.locator('.library-detail h3').inner_text()=='我的测试音色';assert history(p)==h+1;assert ev(p,'GridTone.validateProject(JSON.parse(JSON.stringify(GridToneApp.getProject()))).catalog.presets.length')>0
 run('SB15-advanced-hidden-preview-cancel-save-independent-preset',advanced)
 def keyboard(p):
  f=fixture(p);ev(p,'GridTone.keymap.setPlatform("mac")');note(p,f['noteIds'][0]);setcursor(p,7200);h=history(p)
  p.keyboard.press('Meta+c');p.keyboard.press('Meta+v');p.wait_for_timeout(40);assert any(n['start']==7200 for n in ns(p));assert history(p)==h+1
  p.keyboard.press('Meta+z');assert len(ns(p))==3;p.keyboard.press('Meta+Shift+z');assert len(ns(p))==4;p.keyboard.press('Backspace');assert len(ns(p))==3
  return {'platform':'configured Mac Meta bindings on Chromium Linux; physical Mac NOT_RUN'}
 run('SB16-Mac-copy-paste-undo-redo-delete-real-keys',keyboard)
 def cut(p):
  f=fixture(p);ev(p,'GridTone.keymap.setPlatform("mac")');note(p,f['noteIds'][0]);h=history(p);p.keyboard.press('Meta+x');assert len(ns(p))==2;assert history(p)==h+1
  setcursor(p,7200);p.keyboard.press('Meta+v');p.wait_for_timeout(40);assert len(ns(p))==3 and any(n['start']==7200 for n in ns(p));p.keyboard.press('Meta+z');p.keyboard.press('Meta+z');assert len(ns(p))==3 and ns(p)[0]['start']==0
 run('SB17-Mac-cut-is-one-transaction-copy-preserved',cut)
 def text(p):
  f=fixture(p);ev(p,'GridTone.keymap.setPlatform("mac")');note(p,f['noteIds'][0]);before=raw(p);p.locator('[data-field="shelf-search"]').fill('测试内容');p.locator('[data-field="shelf-search"]').press('Meta+a');p.locator('[data-field="shelf-search"]').press('Backspace');assert raw(p)==before;p.locator('[data-field="shelf-search"]').select_text();p.locator('[data-field="shelf-search"]').press('Backspace');assert p.locator('[data-field="shelf-search"]').input_value()=='';assert raw(p)==before # Native text-selection shortcut is platform-owned; tested range deletion on Linux
  p.locator('#gridframe').focus();p.dispatch_event('#gridframe','keydown',{'key':'Backspace','isComposing':True,'bubbles':True});assert raw(p)==before;p.keyboard.press('Control+c');assert not ev(p,'GridToneApp.materials.c.getSession().editClipboard')
 run('SB18-text-IME-and-non-Mac-modifier-do-not-edit-music',text)
 def sysclip(p):
  f=fixture(p);ev(p,'GridTone.keymap.setPlatform("mac")');note(p,f['noteIds'][0]);ev(p,'''()=>{window.osClipboard='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>{window.osClipboard=s},readText:async()=>window.osClipboard}});}''');p.keyboard.press('Meta+c');p.wait_for_timeout(40);assert ev(p,'osClipboard.startsWith("LEGOUCLIP/1\\n")');setcursor(p,7200);p.locator('#edit-command-bar [data-command="paste"]').click();assert any(n['start']==7200 for n in ns(p));before=raw(p);ev(p,'osClipboard="plain text"');p.keyboard.press('Meta+v');p.wait_for_timeout(40);assert raw(p)==before
  return 'OS clipboard permission API is an explicit test double; production parser and commands are real.'
 run('SB19-system-clipboard-envelope-and-toolbar-equivalence',sysclip)
 def clipboard_delay(p):
  f=fixture(p);ev(p,'GridTone.keymap.setPlatform("mac")');note(p,f['noteIds'][0]);p.keyboard.press('Meta+c');setcursor(p,7200)
  ev(p,'''()=>{const s=GridToneApp.materials.c.getSession();window.clipText='LEGOUCLIP/1\\n'+JSON.stringify(s.editClipboard);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:()=>new Promise(resolve=>window.resolveClipboard=resolve)}})}''')
  p.keyboard.press('Meta+v');p.wait_for_function('typeof resolveClipboard==="function"');ev(p,'''()=>{const A=GridToneApp,d=A.getProject(),s=A.getState(),pat=d.tracks.find(t=>t.id===s.trackId).patterns.find(p=>p.id===s.patternId);pat.notes[0].pitch++;A.materials.c.commit({project:d});}''');before=raw(p);ev(p,'resolveClipboard(clipText)');p.wait_for_timeout(50);assert raw(p)==before;assert '变化' in p.locator('#toast').inner_text()
  return 'Delayed OS read is a test double; target fingerprint protection is production.'
 run('SB20-delayed-paste-rejects-changed-target-content',clipboard_delay)
 def saving(p):
  f=fixture(p);ev(p,'GridTone.keymap.setPlatform("mac")');downloads=[];p.on('download',lambda x:downloads.append(x.suggested_filename));p.locator('#gridframe').focus();p.keyboard.press('Meta+s');p.wait_for_timeout(500);assert not downloads;assert not ('已保存在本机' in p.locator('#storage-status').inner_text());assert '失败' in p.locator('#storage-status').inner_text() or '冲突' in p.locator('#storage-status').inner_text();return 'Actual origin storage unavailable in inline environment; failure is visible, no download masquerading as save.'
 run('SB21-CmdS-persists-or-reports-failure-never-downloads',saving)
 def saved_call(p):
  f=fixture(p);ev(p,'''()=>{GridTone.keymap.setPlatform('mac');window.savedDocs=[];GridTone.projects.save=async p=>{savedDocs.push(structuredClone(p));return {id:p.id,revision:1}};GridTone.projects.activate=async()=>{};}''');p.locator('#gridframe').focus();p.keyboard.press('Meta+s');p.wait_for_timeout(350);assert ev(p,'savedDocs.length')>=1;assert ev(p,'savedDocs.at(-1).id===GridToneApp.getProject().id');assert p.locator('#storage-status').inner_text()=='已保存在本机';return 'Repository is a labeled test double to verify CmdS calls save with current snapshot. No persistence certification.'
 run('SB22-save-command-calls-repository-current-snapshot',saved_call)
 def settings(p):
  f=fixture(p);act(p,'workspace-menu');act(p,'keyboard-settings');p.locator('[data-field="keymap-platform"]').select_option('mac');assert '⌘ C' in p.locator('.modal').inner_text();p.locator('[data-field="keymap-platform"]').select_option('windows');assert 'Ctrl + C' in p.locator('.modal').inner_text();act(p,'close-modal');note(p,f['noteIds'][0]);p.keyboard.press('Control+c');assert ev(p,'GridToneApp.materials.c.getSession().editClipboard.kind')=='notes'
 run('SB23-platform-configuration-and-generated-help',settings)
 def export(p):
  library(p,'combo','studio.combo.pulse');p.locator('[data-library-field="tempo"]').check();act(p,'library-adopt');act(p,'export');
  with p.expect_download()as d:act(p,'export-project')
  got=d.value;dest=O/'downloads'/'studio-project.gridtone';got.save_as(dest);data=json.loads(dest.read_text());assert any(t['preset'].startswith('studio.')for t in data['tracks']);assert ev(p,'d=>GridTone.validateProject(d).tracks.length',data)==len(data['tracks']);act(p,'close-modal');return {'file':str(dest.relative_to(O)),'tracks':len(data['tracks'])}
 run('SB24-actual-project-download-with-pinned-new-sounds',export)
 def window_sizes(p):
  library(p,'sound');rows=[]
  for w,h in [(1440,900),(1280,720),(1024,680),(900,600)]:
   for skin in ['crystal','pearl']:
    p.set_viewport_size({'width':w,'height':h});ev(p,'skin=>{GridTone.appearance.set({skin});GridToneApp.library.render();}',skin);p.wait_for_timeout(90);loc=p.locator('[data-action="library-adopt"]');loc.scroll_into_view_if_needed();assert loc.evaluate('(el)=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return at===el||el.contains(at)}');assert ev(p,'document.documentElement.scrollWidth')<=w;assert p.locator('[data-library-field="legacy"]').is_visible();assert p.locator('[data-action="library-role"][data-role="bass"]').is_visible();assert 0<=p.locator('.topbar').bounding_box()['y']<=12;rows.append({'width':w,'height':h,'skin':skin});p.screenshot(path=str(O/'screens'/f'library-{w}-{h}-{skin}.png'))
  return rows
 run('SB25-eight-desktop-theme-library-layouts-and-reachability',window_sizes)
 def focus(p):
  f=fixture(p);note(p,f['noteIds'][0]);before=raw(p);library(p,'sound');p.keyboard.press('Tab');p.keyboard.press('Backspace');assert raw(p)==before;assert not ev(p,'document.activeElement.closest(".workspace-body")');p.keyboard.press('Escape');assert p.locator('#studio-library').count()==0;assert ev(p,'GridToneApp.getState().editTarget.kind')=='notes';assert raw(p)==before
 run('SB26-library-focus-background-protection-and-Escape',focus)
 def flow(p):
  f=fixture(p,notes=False);library(p,'sound','studio.fm.crystal');set_target(p,f['trackId']);act(p,'library-adopt');close(p);gen(p);assert ev(p,'GridToneApp.creation.session.candidates.length')>0;act(p,'creation-apply');p.wait_for_timeout(70);assert len(ns(p))>0;act(p,'view','[data-view="mix"]');assert p.locator('.mixer-channel').count()==5;act(p,'play');p.wait_for_timeout(200);assert ev(p,'GridToneApp.engine.playing');act(p,'stop');act(p,'view','[data-view="arrange"]');return 'Old harmonic generator → new sound → real playback/mix stays on the original data and audio paths.'
 run('SB27-existing-generation-new-sound-mix-playback-journey',flow)
 def used_tray(p):
  before=raw(p);act(p,'shelf-browse','[data-browse="used"]');assert p.locator('.tray-sound').count()>=4;assert raw(p)==before
  act(p,'shelf-browse','[data-browse="tray"]');old=ev(p,'GridToneApp.shelf.preferences.tray||GridTone.studioDefaults()');library(p,'sound','studio.fm.tine');act(p,'library-pin');close(p);assert ev(p,'GridToneApp.shelf.preferences.tray.length')==len(old)+1;act(p,'shelf-unpin','[data-id="studio.fm.tine"]');assert ev(p,'GridToneApp.shelf.preferences.tray')==old;assert raw(p)==before
 run('SB28-used-sounds-and-tray-pin-remove-preserve-defaults',used_tray)
 def folded_sound(p):
  fixture(p);act(p,'open-sound');assert not p.locator('#sound-parameters').is_visible();p.locator('#sound-adjustment-panel>summary').click();assert p.locator('#sound-parameters').is_visible();before=raw(p);act(p,'library-open','[data-kind="sound"]');close(p);assert raw(p)==before
 run('SB29-sound-fine-adjustment-remains-secondary',folded_sound)
 report={'version':json.loads((R/'package.json').read_text())['version'],'sha256':hashlib.sha256(html.encode()).hexdigest(),'browser':b.version,'mode':'Full production HTML set_content; physical macOS Chrome and origin storage remain separate. Clipboard/storage doubles only in specifically labeled cases.','checks':checks,'counts':{k:sum(x['status']==k for x in checks)for k in ['PASS','FAIL']}}
 (O/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report['counts']);b.close()
raise SystemExit(1 if report['counts']['FAIL']else 0)
