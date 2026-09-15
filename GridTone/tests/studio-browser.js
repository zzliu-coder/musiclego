/** Run in the local development app via its browser DevTools. Restores the original document. */
(async()=>{
const A=GridToneApp,G=GridTone,original=A.getProject(),results=[];
const check=(name,ok,detail)=>results.push({name,result:ok?'PASS':'FAIL',detail});
const click=a=>document.querySelector(`[data-action="${a}"]`).click();
const frame=()=>new Promise(r=>requestAnimationFrame(r));
try{
 A.changeView('arrange');A.playback.stop();
 await A.playback.start('song',G.BAR);await frame();
 const graph=A.engine.graph,count=A.engine.compileCount,grid=document.querySelector('#note-grid');
 A.playback.toggleSolo(original.tracks[0].id);
 check('solo preserves graph and compiled plan',A.engine.graph===graph&&A.engine.compileCount===count&&A.engine.playing);
 A.playback.toggleSolo(original.tracks[0].id);
 const bpm=document.querySelector('#bpm');bpm.value='108';bpm.dispatchEvent(new Event('change',{bubbles:true}));
 check('tempo change keeps playback and graph',A.getProject().bpm===108&&A.engine.graph===graph&&A.engine.playing);
 click('undo');check('undo while playing',A.getProject().bpm===original.bpm&&A.engine.playing);
 check('shell render retains musical grid',grid===document.querySelector('#note-grid'));
 const volume=document.querySelector('[data-range="track.volume"]'),comp=A.engine.compileCount;
 volume.value='.4';volume.dispatchEvent(new Event('input',{bubbles:true}));volume.dispatchEvent(new Event('change',{bubbles:true}));
 check('volume bypasses score compile',A.engine.compileCount===comp&&A.engine.graph===graph);
 click('undo');
 const analyser=A.engine.graph.analyser,b=new Float32Array(analyser.fftSize);let peak=0;
 for(let i=0;i<20;i++){await frame();analyser.getFloatTimeDomainData(b);for(const x of b)peak=Math.max(peak,Math.abs(x));}
 check('audio output contains signal',peak>0,{peak,lateWindows:A.engine.lateWindows,skippedEvents:A.engine.skippedEvents});
 A.playback.stop();A.playback.setRange([G.BAR,3*G.BAR]);check('loop position is not double-offset',A.playback.position()===G.BAR);A.playback.seek(G.BAR*2);A.playback.stop();check('first stop returns to origin',A.playback.position()===G.BAR*2);A.playback.stop();check('second stop returns to zero',A.playback.position()===0);
 await G.saveLocal(A.getProject());const saved=await G.loadLocal();check('IndexedDB round trip',JSON.stringify(saved)===JSON.stringify(A.getProject()));const versions=await G.listRecoveries();check('recovery snapshot is readable',versions.length>0&&!!(await G.loadRecovery(versions[0].id)));
 const midi=G.encodeMidi(A.getProject(),{kind:'song'});check('MIDI export header',String.fromCharCode(...new Uint8Array(midi).slice(0,4))==='MThd');
 const wav=await A.engine.exportWav(A.getProject(),{kind:'pattern',trackId:original.tracks[0].id,patternId:original.tracks[0].patterns[0].id,ignoreMute:true});const bytes=new Uint8Array(await wav.blob.arrayBuffer());check('WAV export',String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&bytes.length>100000,{bytes:bytes.length});
 A.loadProject(JSON.parse(JSON.stringify(original)));check('project export/reopen keeps music',JSON.stringify(G.compileSong(A.getProject()))===JSON.stringify(G.compileSong(original)));
}catch(e){check('unexpected runtime error',false,e.stack);}
finally{A.playback.stop();A.loadProject(original);await G.saveLocal(A.getProject());}
return {date:new Date().toISOString(),method:'Actual local Chromium DOM events, Web Audio, IndexedDB and offline export; hardware listening not assessed',results};
})();
