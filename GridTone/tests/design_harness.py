"""Shared production-browser fixture and actions. No UI business logic is replaced."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def ev(p,s,arg=None):return p.evaluate(s,arg)

def act(p,a,extra=''):
  scope=p.locator('.modal') if p.locator('.modal').count() else p
  scope.locator(f'button[data-action="{a}"]'+extra).filter(visible=True).first.click()

def fixture(p,bars=4,notes=True,open=True):
  return ev(p,'''({bars,notes,open})=>{const A=GridToneApp,G=GridTone;A.playback.stop();A.creation.close();A.composer.reset();A.shelf.cancel();A.materials.c.closeModal();let d=G.recipeProject('recipe.pop');d.id=A.getProject().id;d.bars=Math.max(8,bars);const t=d.tracks.at(-1),pat=t.patterns[0];pat.bars=bars;pat.notes=notes?[G.newNote(60,0,960,.7),G.newNote(64,1920,480,.6),G.newNote(67,5760,960,.7)]:[];const out=A.materials.c.commit({project:d,trackId:t.id,patternId:pat.id,clipId:t.clips[0].id});if(out?.ok===false)throw Error(out.error.message);const s=A.materials.c.getSession();s.view='arrange';s.rightPanel=null;s.editorOpen=false;s.editorManuallyClosed=false;s.editorExpanded=false;s.snap=240;s.continuous=true;s.tool='draw';s.editClipboard=null;s.cursor=0;s.selected=[];s.clipIds=[];s.editTarget={kind:'none'};s.arrangeCursor={trackId:t.id,tick:0};s.scrolls={};A.shelf.collapsed=false;A.render();if(open)A.openPattern({trackId:t.id,clipId:t.clips[0].id,edit:true,activation:'notes'});return {trackId:t.id,patternId:pat.id,clipId:t.clips[0].id,noteIds:pat.notes.map(n=>n.id),sourceTrackId:d.tracks[0].id,sourceClipId:d.tracks[0].clips[0].id}}''',{'bars':bars,'notes':notes,'open':open})

def ns(p,tid=None):return ev(p,'''tid=>{const A=GridToneApp,s=A.getState(),t=A.getProject().tracks.find(t=>t.id===(tid||s.trackId));return t.patterns.find(p=>p.id===s.patternId)?.notes||t.patterns[0].notes}''',tid)

def note(p,id):p.locator(f'#note-layer [data-note="{id}"] .note-body').scroll_into_view_if_needed();p.locator(f'#note-layer [data-note="{id}"] .note-body').click()

def gridpoint(p,tick,pitch=60):
  p.locator('#gridframe').scroll_into_view_if_needed()
  xy=ev(p,'''({tick,pitch})=>{const A=GridToneApp,G=GridTone,s=A.materials.c.getSession(),d=A.getProject(),t=d.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),svg=document.querySelector('#note-grid'),r=svg.getBoundingClientRect(),rows=G.visiblePitches(d,s,t,pat),win=G.gridWindow(s,pat);return {x:r.x+Number(svg.dataset.left)+(tick-win.offset)/240*Number(svg.dataset.cellWidth)+3,y:r.y+28+(rows.indexOf(pitch)+.5)*Number(svg.dataset.rowHeight)}}''',{'tick':tick,'pitch':pitch})
  p.evaluate('''({x,y})=>{const sc=document.querySelector('.grid-scroll'),r=sc.getBoundingClientRect();if(y>r.bottom-35)sc.scrollTop+=y-(r.bottom-35);if(y<r.top+35)sc.scrollTop-=r.top+35-y;}''',xy)
  xy=ev(p,'''({tick,pitch})=>{const A=GridToneApp,G=GridTone,s=A.materials.c.getSession(),d=A.getProject(),t=d.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),svg=document.querySelector('#note-grid'),r=svg.getBoundingClientRect(),rows=G.visiblePitches(d,s,t,pat),win=G.gridWindow(s,pat);return {x:r.x+Number(svg.dataset.left)+(tick-win.offset)/240*Number(svg.dataset.cellWidth)+3,y:r.y+28+(rows.indexOf(pitch)+.5)*Number(svg.dataset.rowHeight)}}''',{'tick':tick,'pitch':pitch})
  return xy

def setcursor(p,tick):ev(p,'tick=>{GridToneApp.materials.c.getSession().cursor=tick;GridToneApp.render()}',tick)

def choose_source(p):
  field=p.locator('[data-field="creation-sourceTrackId"]');
  if field.count() and not field.input_value():field.select_option(index=1)

def gen(p):
  act(p,'edit-tools');act(p,'creation',':not([data-mode])');choose_source(p);act(p,'creation-generate');p.wait_for_timeout(80)
