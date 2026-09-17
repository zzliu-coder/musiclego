/** Actual browser integration. Restores the user's project and appearance. */
(async()=>{
const A=GridToneApp,G=GridTone,original=A.getProject(),prefs=G.appearance.get(),results=[];
const check=(name,ok,detail)=>results.push({name,result:ok?'PASS':'FAIL',...(detail?{detail}: {})});
const frame=()=>new Promise(r=>requestAnimationFrame(r));
const click=a=>document.querySelector(`[data-action="${a}"]`).click();
try{
 A.changeView('edit');A.playback.stop();await A.playback.start('song',0);await frame();
 const graph=A.engine.graph,origin=A.engine.origin,count=A.engine.compileCount,s=A.getState();
 A.changeView('arrange');A.changeView('edit');
 check('view switch preserves audio graph, origin and compilation',A.engine.playing&&A.engine.graph===graph&&A.engine.origin===origin&&A.engine.compileCount===count);
 check('view switch preserves current phrase',A.getState().patternId===s.patternId&&A.getState().trackId===s.trackId);
 check('arrangement and phrase views remain directly reachable',!!document.querySelector('[data-view="arrange"]')&&!!document.querySelector('[data-view="edit"]'));
 A.playback.stop();
 const t=original.tracks.find(t=>t.kind!=='drum'),p=t.patterns[0];A.openPattern({trackId:t.id,patternId:p.id});
 const first=p.notes[0];
 if(first){G.motion.playback({project:A.getProject(),S:A.getState(),B:{...A.getPlayback(),target:'pattern'},engine:{playing:true},position:first.start+1});check('playback lights notes without geometric transforms',!!document.querySelector('.note.is-sounding')&&[...document.querySelectorAll('.note')].every(n=>!n.style.transform));
 G.motion.playback({project:A.getProject(),S:A.getState(),B:A.getPlayback(),engine:{playing:false},position:0});check('stopping clears note lighting',!document.querySelector('.note.is-sounding'));}
 G.appearance.set({motion:'reduced'});check('reduced motion disables animation and retains geometry',G.motion.reduced()&&getComputedStyle(document.querySelector('.btn')).transitionDuration==='0s'&&!!document.querySelector('#note-grid'));
 click('appearance');check('motion preference exposed in settings',!!document.querySelector('[data-field="reduce-motion"]'));click('close-modal');
 G.appearance.set(prefs);
 click('workspace-menu');document.querySelector('#overlay [data-view="mix"]').click();check('mix navigation closes overlay and leaves workspace operable',A.getState().view==='mix'&&!A.getState().modal&&!document.querySelector('#app').inert);
 A.changeView('edit');click('close-editor');check('editor can collapse',!document.querySelector('.studio-editor'));document.querySelector('[data-view="edit"]').click();check('phrase navigation reopens collapsed editor',!!document.querySelector('.studio-editor'));
 check('branding is consistent in page and export',document.title.includes('乐构')&&document.querySelector('.brand').textContent==='乐构');
 click('export');check('all export formats remain available',!!document.querySelector('[data-action="export-wav"]')&&!!document.querySelector('[data-action="export-midi"]')&&document.querySelector('[data-action="export-project"]').textContent.includes('乐构'));click('close-modal');
}catch(e){check('unexpected runtime exception',false,e.stack);}
finally{A.playback.stop();G.appearance.set(prefs);A.loadProject(original);await G.saveLocal(A.getProject());}
return {date:new Date().toISOString(),results};
})();
