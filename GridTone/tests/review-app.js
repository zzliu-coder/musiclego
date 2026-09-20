/* Full-app helpers for an isolated browser profile; never run in a user's tab. */
globalThis.reviewApp={
 async setup(){
  const G=GridTone,A=GridToneApp,p=G.blankProject();p.title='Review regression fixture';p.bpm=120;
  const samples=new Float32Array(1572864);
  const wav=G.encodeWav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples});
  p.assets.fixture={data:await G.blobDataURL(new Blob([wav],{type:'audio/wav'})),root:60,mode:'pitched',name:'4 MiB WAV fixture'};
  const t=p.tracks[0],pat=t.patterns[0];t.name='Overlap test';pat.notes=[{id:'note-A',pitch:60,start:0,duration:1920,velocity:.6},{id:'note-B',pitch:60,start:240,duration:1920,velocity:.7}];
  await A.loadProject(p);this.id=p.id;this.track=t.id;this.pattern=pat.id;this.clip=t.clips[0].id;
  A.openPattern({trackId:t.id,patternId:pat.id,clipId:this.clip,edit:true});
  document.querySelector('[data-action=tool][data-tool=select]').click();
  return {sampleBytes:p.assets.fixture.data.length,history:A.getHistory()};
 },
 target(ids){GridToneApp.activateTarget({kind:'notes',trackId:this.track,patternId:this.pattern,clipId:this.clip,ids});},
 check(){
  const A=GridToneApp,notes=A.getProject().tracks[0].patterns[0].notes,order=notes.map(n=>n.id),dom=[...document.querySelector('#note-layer').children].map(n=>n.dataset.note);
  if(order.join()!==dom.join())throw Error('data/DOM order differs');
  const rects=[...document.querySelectorAll('#note-layer .note-body')].map(n=>n.getBoundingClientRect());
  const left=Math.max(...rects.map(r=>r.left)),right=Math.min(...rects.map(r=>r.right)),y=rects[0].y+rects[0].height/2,x=left+(right-left)/2;
  const top=document.elementFromPoint(x,y)?.closest('[data-note]')?.dataset.note;
  if(top!==order.at(-1))throw Error('painted top differs');
  this.target([]);return {order,dom,top,x,y};
 },
 transform(){
  this.target(['note-A']);const A=GridToneApp,G=GridTone,validate=G.validateProject,equals=G.projectEquals,stringify=JSON.stringify;
  let validations=0,comparisons=0,maxJSON=0;
  G.validateProject=(...args)=>{validations++;return validate(...args);};G.projectEquals=(...args)=>{comparisons++;return equals(...args);};
  JSON.stringify=(...args)=>{const s=stringify(...args);maxJSON=Math.max(maxJSON,s?.length||0);return s;};
  const started=performance.now();try{A.transformSelection('humanize');}finally{G.validateProject=validate;G.projectEquals=equals;JSON.stringify=stringify;}
  if(validations!==1||comparisons!==1||maxJSON>100000)throw Error('hot path repeated work: '+stringify({validations,comparisons,maxJSON}));
  return {validations,comparisons,maxJSON,ms:performance.now()-started,history:A.getHistory()};
 },
 async liveAudio(){
  const G=GridTone,A=GridToneApp,p=G.blankProject(),drum=G.newTrack('drum');p.bpm=120;p.bars=1;
  drum.patterns[0].notes=Array.from({length:16},(_,i)=>G.newNote(36,i*240,120));p.tracks.push(drum);
  p.tracks[0].patterns[0].notes=[G.newNote(60,0,960)];await A.loadProject(p);
  A.openPattern({trackId:p.tracks[0].id,edit:true});A.activateTarget({kind:'notes',trackId:p.tracks[0].id,patternId:p.tracks[0].patterns[0].id,clipId:p.tracks[0].clips[0].id,ids:[p.tracks[0].patterns[0].notes[0].id]});
  const engine=A.engine,render=G.getInstrumentRenderer('drum'),events=[],stops=new WeakMap(),stop=AudioScheduledSourceNode.prototype.stop;
  AudioScheduledSourceNode.prototype.stop=function(at){stops.set(this,at??0);return stop.call(this,at);};
  G.registerInstrument('drum',args=>{const prior=new Set(args.graph.sources);render(args);events.push({at:args.at,sources:[...args.graph.sources].filter(s=>!prior.has(s))});});
  let count=0;
  try{
   await A.playback.start('song');if(!engine.playing)throw Error(engine.error?.message||'audio did not start');
   const origin=engine.origin;
   for(let i=0;i<180;i++){await new Promise(ok=>setTimeout(ok,11+(i%7)));A.transformSelection(i%2?'shift':'humanize');count++;}
   const end=engine.ctx.currentTime;
   const heard=events.filter(e=>e.at<end-.01&&e.sources.some(s=>(stops.get(s)??Infinity)>s.gridStart));
   const expected=[];for(let at=origin;at<end-.01;at+=.125)expected.push(at);
   for(const at of expected)if(heard.filter(e=>Math.abs(e.at-at)<1e-6).length!==1)throw Error('lost/duplicated real Web Audio onset '+at);
   return {edits:count,onsets:expected.length,durationSeconds:end-origin,lateWindows:engine.lateWindows,skippedEvents:engine.skippedEvents};
  }finally{A.playback.stop();G.registerInstrument('drum',render);AudioScheduledSourceNode.prototype.stop=stop;}
 }
};
