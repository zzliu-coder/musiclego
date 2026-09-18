/** Bounded, deterministic composition. No DOM, audio nodes or document writes. */
(function(G){'use strict';
 const VERSION='legou.rules.2';
 function rng(seed){let x=seed>>>0;return ()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 const overlap=(a,b)=>a.start<b.start+b.duration-1e-7&&a.start+a.duration>b.start+1e-7;
 const intersects=(n,a,b)=>n.start<b&&n.start+n.duration>a;
 function explainNote(note,harmony,transpose=0,neighbors=[]){
  const events=harmony?.events?.filter(e=>overlap(note,e))||[];
  if(!events.length)return {role:'未分析',reason:'参考和弦尚未覆盖这个音。'};
  const pitch=G.pitchClass(note.pitch+transpose),matches=events.filter(e=>e.pitchClasses.includes(pitch));
  if(matches.length!==events.length){const ordered=[...neighbors].sort((a,b)=>a.start-b.start),i=ordered.findIndex(n=>n.id===note.id),prev=ordered[i-1],next=ordered[i+1];let connection='这个音位于和弦外；缺少明确连接依据，请结合前后音试听。';if(prev&&next){const a=note.pitch-prev.pitch,b=next.pitch-note.pitch;if(Math.abs(a)<=2&&Math.abs(b)<=2&&a*b>0)connection='这个音以同向级进连接前后音，形成经过关系。';else if(prev.pitch===next.pitch&&Math.abs(a)<=2)connection='这个音离开前音后返回同一音高，形成邻接关系。';else if(Math.abs(b)===1)connection='这个音以半音趋近下一落点；请确认下一音的和声位置。';}return {role:'有条件变化',reason:events.length>1?'这个长音经过不同和弦，其中部分时段形成张力。':connection};}
  const ending=note.start+note.duration>=harmony.end-1,strong=note.start%G.BAR===0,secondary=note.start%G.BAR===2*G.PPQ&&note.duration>=G.PPQ;
  if(ending||strong||secondary)return {role:'结构支点',reason:ending?'这是这句的收尾和弦音。':strong?'这个和弦音落在小节重拍，可作为乐句落点。':'这个长和弦音位于第三拍的次强拍，可支撑乐句。'};
  return {role:'装饰空间',reason:note.start%G.PPQ===0?'这是正拍上的和弦内音，可以尝试重复或留白。':'这是拍间位置的和弦内音，可以尝试连接或休止。'};
 }
 function rhythmSkeleton(notes,bars){const slots=[];for(const n of [...notes].sort((a,b)=>a.start-b.start||b.duration-a.duration))if(!slots.some(s=>s.start===n.start))slots.push({start:n.start,duration:n.duration,velocity:n.velocity});for(let i=0;i<slots.length;i++)slots[i].duration=Math.min(slots[i].duration,(slots[i+1]?.start??bars*G.BAR)-slots[i].start);return {version:1,bars,slots};}
 function compose(context,settings={},seed=1){
  const {harmony,notes:original=[],retention={notes:[],ranges:[]}}=context;
  if(!harmony?.events?.length)throw Error('请先选择已确认的参考和弦。');
  const mode=settings.mode||'generate',low=Number(settings.low??60),high=Number(settings.high??84);
  if(!Number.isInteger(low)||!Number.isInteger(high)||low<0||high>127||low>high)throw Error('请填写 MIDI 0–127 内的有效音域。');
  const start=Number(settings.start??0),end=Number(settings.end??harmony.bars*G.BAR);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>harmony.bars*G.BAR)throw Error('生成范围无效。');
  if(![4,8].includes(harmony.bars)&&!(harmony.bars===16&&[4,8].includes((end-start)/G.BAR)))throw Error('生成支持 4 / 8 小节；16 小节请选择其中 4 / 8 小节。短乐句可先扩展或新建 4 小节。');
  const rangeStart=mode==='ending'?Math.max(start,end-G.BAR):start;
  const random=rng(seed),pitchRandom=rng(seed^0x9371ab),flags=new Map(retention.notes.map(x=>[x.id,x]));
  const immutable=n=>n.start<rangeStart||n.start+n.duration>end||retention.ranges.some(r=>intersects(n,r.start,r.end))||flags.get(n.id)?.all;
  const fixed=original.filter(immutable).map(G.clone),work=[];
  const locked=n=>retention.ranges.some(r=>intersects(n,r.start,r.end))||fixed.some(f=>overlap(f,n));
  const anchors=n=>mode==='anchors'&&explainNote(n,harmony,harmony.targetTranspose).role==='结构支点';
  for(const n of original.filter(n=>!immutable(n)))if(mode==='rhythm'||mode==='answer'||mode==='anchors'||flags.has(n.id))work.push({...n,_fixedPitch:!!flags.get(n.id)?.pitch||anchors(n)});
  if(mode==='answer'&&rangeStart>0){const sourceStart=Math.max(0,rangeStart-(end-rangeStart)),motifNotes=original.filter(n=>n.start>=sourceStart&&n.start+n.duration<=rangeStart);if(motifNotes.length){const kept=work.filter(n=>flags.has(n.id));work.length=0;work.push(...kept);for(const source of motifNotes){const n={...source,id:'generated_'+seed+'_answer_'+source.start,start:rangeStart+source.start-sourceStart};if(n.start+n.duration<=end&&!locked(n)&&!work.some(w=>overlap(w,n)))work.push(n);}}}
  const skeleton=settings.rhythmTemplate||null;
  if(skeleton&&mode!=='rhythm'&&mode!=='answer'&&mode!=='anchors'){
   if(![1,2,4,8,16].includes(skeleton.bars)||!Array.isArray(skeleton.slots)||skeleton.slots.length>4096)throw Error('节奏骨架无效。');
   for(let offset=rangeStart;offset<end;offset+=skeleton.bars*G.BAR)for(const slot of skeleton.slots){const at=offset+slot.start;if(!Number.isFinite(slot.start)||!Number.isFinite(slot.duration)||slot.start<0||slot.duration<1||slot.start+slot.duration>skeleton.bars*G.BAR)throw Error('节奏骨架时间无效。');if(at>=end)continue;const n={id:'generated_'+seed+'_'+at,pitch:60,start:at,duration:Math.min(slot.duration,end-at),velocity:G.clamp(slot.velocity??.65,.01,1)};if(!locked(n)&&!work.some(w=>overlap(w,n)))work.push(n);}
  }else if(mode!=='rhythm'&&mode!=='answer'&&mode!=='anchors'){
   const subdivision=settings.density==='dense'?480:960;
   for(let at=rangeStart;at<end;at+=subdivision){
    if(at%G.BAR!==0&&random()<(settings.density==='sparse'?.5:.18))continue;
    const duration=Math.min(end-at,subdivision*(random()>.7?1:.75)),n={id:'generated_'+seed+'_'+at,pitch:60,start:at,duration,velocity:at%G.BAR===0?.78:.63};
    if(!locked(n)&&!work.some(w=>overlap(w,n)))work.push(n);
   }
  }
  let previous=(low+high)/2;const shift=harmony.targetTranspose||0,motif=new Map();
  work.sort((a,b)=>a.start-b.start);
  for(let i=0;i<work.length;i++){
   const n=work[i];if(n._fixedPitch){previous=n.pitch+shift;delete n._fixedPitch;continue;}
   const events=harmony.events.filter(e=>overlap(n,e));if(!events.length)throw Error('参考和弦没有覆盖目标音符。');
   const motifKey=(n.start-rangeStart)%(2*G.BAR),motifPitch=motif.get(motifKey),contour=motifPitch??(mode==='answer'?high-(high-low)*n.start/(harmony.bars*G.BAR):low+(high-low)*(.3+.35*Math.sin(n.start/(harmony.bars*G.BAR)*Math.PI)));
   const anchor=n.start%G.BAR===0||n.start>=end-G.PPQ;
   const pitches=[];
   for(let pitch=low;pitch<=high;pitch++){
    if(pitch-shift<0||pitch-shift>127)continue;
    const matches=events.reduce((s,e)=>s+(e.pitchClasses.includes(G.pitchClass(pitch))?Math.min(n.start+n.duration,e.start+e.duration)-Math.max(n.start,e.start):0),0)/n.duration;
    const distance=Math.abs(pitch-previous),leap=Math.max(0,distance-7);
    pitches.push({pitch,score:matches*(anchor?14:8)-distance*.55-leap*2-Math.abs(pitch-contour)*(motifPitch!==undefined?.8:.12)+pitchRandom()*4});
   }
   if(!pitches.length)throw Error('轨道移调后超出音域，请调整音域或演奏移调。');
   pitches.sort((a,b)=>b.score-a.score||a.pitch-b.pitch);n.pitch=pitches[0].pitch-shift;previous=pitches[0].pitch;if(!motif.has(motifKey))motif.set(motifKey,previous);delete n._fixedPitch;
  }
  // Connections change only unlocked interior pitches and explicitly resolve to a next note.
  for(let i=1;i<work.length-1;i++){const n=work[i],prev=work[i-1],next=work[i+1];if(flags.has(n.id)||n.start%G.BAR===0||mode==='anchors'&&anchors(n)||n.duration>G.PPQ)continue;let pitch;
   if(settings.color==='chromatic'&&i%3===1)pitch=next.pitch+(prev.pitch>next.pitch?1:-1);
   if(settings.color==='diatonic'){if(prev.pitch===next.pitch)pitch=prev.pitch+2;else if(Math.abs(next.pitch-prev.pitch)<=4)pitch=prev.pitch+Math.sign(next.pitch-prev.pitch)*2;}
   if(pitch!==undefined&&pitch+shift>=low&&pitch+shift<=high&&(settings.color==='chromatic'||G.inScale(pitch+shift,context.key??0,context.scale??'major')))n.pitch=pitch;
  }
  if((mode==='ending'||settings.intent==='ending')&&work.length){const n=work.at(-1),h=harmony.events.find(e=>n.start>=e.start&&n.start<e.start+e.duration);if(h&&!flags.has(n.id)){const choices=Array.from({length:high-low+1},(_,i)=>low+i).filter(p=>G.pitchClass(p)===h.rootPitchClass&&p-shift>=0&&p-shift<=127);if(choices.length)n.pitch=choices.sort((a,b)=>Math.abs(a-(n.pitch+shift))-Math.abs(b-(n.pitch+shift)))[0]-shift;if(!skeleton)n.duration=Math.min(end-n.start,G.PPQ);}}
  const notes=fixed.concat(work).sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
  // Preserve all retained IDs and fields. Range silence was reserved before filling.
  for(const keep of retention.notes){const old=original.find(n=>n.id===keep.id),n=notes.find(n=>n.id===keep.id);if(!old||!n)throw Error('无法满足保留约束。');if(keep.all&&JSON.stringify(n)!==JSON.stringify(old))throw Error('全部保留约束冲突。');if(keep.pitch&&n.pitch!==old.pitch)throw Error('音高保留约束冲突。');if(keep.rhythm&&(n.start!==old.start||n.duration!==old.duration))throw Error('节奏保留约束冲突。');}
  const ordered=[...notes].sort((a,b)=>a.start-b.start);
  if(ordered.some((n,i)=>i&&n.start<ordered[i-1].start+ordered[i-1].duration-1e-7))throw Error('当前素材包含重叠音符，请选单声部旋律片段。');
  return {notes,retention:G.clone(retention),generation:{version:1,algorithm:VERSION,kind:mode,seed:seed>>>0,templateVersion:1,inputHash:G.contentHash({events:harmony.events.map(({sourceClipId,...e})=>e),notes:G.musicalNotes(original),settings}),sources:[{trackId:harmony.sourceTrackId,hash:harmony.sourceHash,...(harmony.sourceRange?{range:harmony.sourceRange}:{})}],settings:{mode,low,high,start:rangeStart,end,origin:harmony.origin||0,density:settings.density||'normal',color:settings.color||'none',intent:settings.intent||'loop',rhythmTemplateId:settings.rhythmTemplateId||''}}};
 }
 function generateMelody(context,settings={},seed=1){
  const out=[],seen=new Set(),original=JSON.stringify(G.musicalNotes(context.notes||[]).map(n=>n.slice(0,3)));
  for(let i=0;i<12&&out.length<3;i++){
   const candidate=compose(context,settings,(Number(seed)+i*7919)>>>0),key=JSON.stringify(G.musicalNotes(candidate.notes).map(n=>n.slice(0,3)));
   if(key===original||seen.has(key))continue;seen.add(key);out.push(candidate);
  }
  return {candidates:out,message:out.length===3?'三版分别变化音高与连接。':out.length?`保留条件下找到 ${out.length} 版不同候选。`:'没有可变化内容，请调整保留项或扩大音域。'};
 }
 function applyGenerated(project,target,candidate,{shared=false}={}){
  const p=G.clone(project),t=p.tracks.find(t=>t.id===target.trackId),c=t?.clips.find(c=>c.id===target.clipId),original=t?.patterns.find(x=>x.id===c?.patternId);
  if(!original)throw Error('目标实例已不存在，请重新生成。');
  const refs=t.clips.filter(c=>c.patternId===original.id);let pat=original;
  if(!shared&&refs.length>1){pat=G.clone(original);pat.id=G.uid('p');pat.name+=' · 变化';t.patterns.push(pat);c.patternId=pat.id;}
  const sourceIds=new Set(original.notes.map(n=>n.id)),ids=new Map();
  pat.notes=candidate.notes.map(n=>{const id=pat===original&&sourceIds.has(n.id)?n.id:G.uid('n');ids.set(n.id,id);return {...n,...(id!==n.id?{performanceKey:n.performanceKey||n.id}:{}),id};});
  pat.retention=G.clone(candidate.retention||{notes:[],ranges:[]});pat.retention.notes=pat.retention.notes.filter(n=>ids.has(n.id)).map(n=>({...n,id:ids.get(n.id)}));
  pat.generation=G.clone(candidate.generation);delete pat.harmony;
  return {project:G.validateProject(p),trackId:t.id,patternId:pat.id,clipId:c.id};
 }
 Object.assign(G,{generationVersion:VERSION,seededRandom:rng,rhythmSkeleton,explainNote,generateMelody,applyGenerated});
})(globalThis.GridTone ||= {});
