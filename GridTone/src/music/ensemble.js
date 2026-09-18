(function(G){'use strict';
 const ROLE_PITCH={kick:36,snare:38,closedHat:42,openHat:46,clap:39,tom:45,crash:49,rim:37};
 function drumRole(row){return row.role||Object.keys(ROLE_PITCH).find(k=>row.source?.type==='drum'&&ROLE_PITCH[k]===row.source.pitch);}
 function drumMap(project,track){const map=new Map();for(const row of G.drumsFor(project,track)){const role=drumRole(row);if(role&&!row.missing&&!map.has(role))map.set(role,row.pitch);}return map;}
 function remapDrums(notes,sourceRows,targetRows){const source=new Map(sourceRows.map(r=>[r.pitch,drumRole(r)])),target=new Map(targetRows.map(r=>[drumRole(r),r.pitch]));return notes.map(n=>{const role=source.get(n.pitch),pitch=target.get(role);if(!role||pitch===undefined)throw Error('目标鼓组缺少 '+(role||'未定义角色')+'，请选择替代鼓组或补齐角色。');return {...n,pitch};});}
 function sourceNotes(project,trackId,origin,length,{sustained=false,performed=false}={}){const t=project.tracks.find(t=>t.id===trackId);if(!t)throw Error('参考声部已不存在。');return t.clips.flatMap(c=>{const p=t.patterns.find(p=>p.id===c.patternId);return (performed?G.processPattern(p,t,project):p.notes).map(n=>({...n,start:c.bar*G.BAR+n.start-origin}));}).filter(n=>sustained?n.start<length&&n.start+n.duration>0:n.start>=0&&n.start<length).map(n=>sustained?{...n,originalStart:n.start,start:Math.max(0,n.start),duration:Math.min(length,n.start+n.duration)-Math.max(0,n.start)}:n);}
 const onsetsInRange=(project,id,from,to)=>sourceNotes(project,id,from,to-from);
 const soundingIntervals=(project,id,from,to)=>sourceNotes(project,id,from,to-from,{sustained:true});
 function generateEnsemble(project,target,settings={},seed=1){
  const t=project.tracks.find(t=>t.id===target.trackId),clip=t?.clips.find(c=>c.id===target.clipId),pat=t?.patterns.find(p=>p.id===clip?.patternId);
  if(!pat)throw Error('请选择目标实例。');
  const length=pat.bars*G.BAR,start=settings.lastBeat?length-G.PPQ:Number(settings.start??0),end=Number(settings.end??length),mode=settings.mode||'bass';
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>length||end<=start)throw Error('生成范围无效。');
  const retention=pat.retention||{notes:[],ranges:[]},flags=new Map(retention.notes.map(n=>[n.id,n])),sources=[],notes=[],random=G.seededRandom(seed);
  const keep=n=>n.start<start||n.start+n.duration>end||retention.ranges.some(r=>n.start<r.end&&n.start+n.duration>r.start)||flags.has(n.id);
  const occupied=n=>notes.some(x=>x.start<n.start+n.duration&&x.start+x.duration>n.start)||retention.ranges.some(r=>n.start<r.end&&n.start+n.duration>r.start);
  let harmony=null;
  if(mode==='drums'){
   if(t.kind!=='drum')throw Error('鼓型变化需要鼓轨。');
   const map=drumMap(project,t),role=settings.drumRole||'closedHat',pitch=map.get(role);
   if(pitch===undefined)throw Error('当前鼓组缺少 '+role+'，请选择可用鼓件。');
   notes.push(...pat.notes.filter(n=>n.pitch!==pitch||keep(n)).map(G.clone));
   const step=settings.density==='dense'?G.STEP:G.PPQ/2,style=settings.drumStyle||'straight',velocityScale=({soft:.7,balanced:1,punch:1.3})[settings.velocityStyle||'balanced'];if(!['straight','half','four'].includes(style)||!velocityScale)throw Error('鼓型参数无效。');
   for(let at=start;at<end;at+=step){const beat=(at%G.BAR)/G.PPQ;const primary=role==='kick'?(style==='four'?[0,1,2,3]:style==='half'?[0,2.5]:[0,2]):['snare','clap'].includes(role)?(style==='half'?[2]:[1,3]):null;if(primary&&!primary.includes(beat)&&!(settings.density==='dense'&&beat%1===.5&&random()>.45))continue;if(settings.density==='sparse'&&at%G.PPQ!==0)continue;if(at%G.PPQ!==0&&random()<.15)continue;const n={id:'generated_'+seed+'_'+at,pitch,start:at,duration:Math.min(G.STEP,end-at),velocity:G.clamp((at%G.PPQ===0?.64:.4)*velocityScale,.01,1)};if(!notes.some(x=>x.pitch===pitch&&x.start===at)&&!retention.ranges.some(r=>at<r.end&&at+n.duration>r.start))notes.push(n);}
  }else{
   if(t.kind==='drum')throw Error('请选择旋律类音轨。');
   harmony=G.resolveHarmony(project,{...target,sourceTrackId:settings.sourceTrackId,start,end});sources.push({trackId:harmony.sourceTrackId,hash:harmony.sourceHash,range:harmony.sourceRange});
   let reference=[];G.assertDependencies(project,t.id,[settings.sourceTrackId,settings.referenceTrackId]);
   if(settings.referenceTrackId){const source=project.tracks.find(t=>t.id===settings.referenceTrackId);if(!source)throw Error('参考声部不存在。');if(source.id===t.id)throw Error('请选择另一条轨道作为参考。');if(mode==='bass'&&source.kind!=='drum')throw Error('贝斯的节奏参考需要鼓轨。');if(mode==='accompaniment'&&source.kind==='drum')throw Error('伴奏的避让参考需要旋律轨。');reference=sourceNotes(project,source.id,harmony.origin,length,{sustained:mode==='accompaniment',performed:true});const range=[harmony.origin,harmony.origin+length];sources.push({trackId:source.id,hash:G.performanceSourceHash(project,source,...range),range,layer:'performed'});if(mode==='bass'){const kick=drumMap(project,source).get('kick');if(kick===undefined)throw Error('参考鼓轨没有底鼓角色。');reference=reference.filter(n=>n.pitch===kick);}}
   notes.push(...pat.notes.filter(keep).map(G.clone));
   const low=Number(settings.low??(mode==='bass'?36:60)),high=Number(settings.high??(mode==='bass'?55:84));
   if(!Number.isInteger(low)||!Number.isInteger(high)||low<0||high>127||low>high)throw Error('请指定有效的发声音域。');
   let onsets=[];
   if(mode==='bass'&&reference.length)onsets=reference.map(n=>n.start+(settings.strategy==='answer'?G.PPQ/2:0));
   else if(mode==='accompaniment'&&reference.length&&settings.strategy==='together')onsets=reference.filter(n=>(n.originalStart??n.start)>=0).map(n=>n.originalStart??n.start);
   else for(let at=start;at<end;at+=mode==='bass'?G.PPQ*2:settings.textureStyle==='arp'?G.PPQ/2:settings.textureStyle==='pulse'?G.PPQ:settings.strategy==='support'?G.BAR:G.PPQ)onsets.push(at);
   if(settings.density==='sparse')onsets=onsets.filter((_,i)=>i%2===0);
   if(settings.density==='dense')onsets=onsets.flatMap(at=>[at,at+G.PPQ/2]);
   for(const at of [...new Set(onsets)].sort((a,b)=>a-b)){
    if(at<start||at>=end)continue;
    const active=reference.some(n=>at>=n.start&&at<n.start+n.duration);
    if(mode==='accompaniment'&&settings.strategy!=='together'&&active)continue;
    const h=harmony.events.find(e=>at>=e.start&&at<e.start+e.duration);if(!h)throw Error('参考和弦存在空档。');
    let duration=Math.min(mode==='bass'?G.PPQ*.45:settings.textureStyle==='arp'?G.PPQ*.4:settings.textureStyle==='pulse'?G.PPQ*.6:settings.strategy==='support'?G.BAR*.85:G.PPQ*.45,end-at,h.start+h.duration-at);
    if(mode==='accompaniment'&&settings.strategy!=='together'){const next=reference.filter(n=>n.start>at).sort((a,b)=>a.start-b.start)[0];if(next)duration=Math.min(duration,next.start-at);}
    const available=Array.from({length:high-low+1},(_,i)=>low+i).filter(p=>p-Math.round(t.pipeline.transpose)>=0&&p-Math.round(t.pipeline.transpose)<=127);
    const roots=available.filter(p=>G.pitchClass(p)===h.rootPitchClass),chordPitches=available.filter(p=>h.pitchClasses.includes(G.pitchClass(p)));
    if(!chordPitches.length||mode==='bass'&&!roots.length)throw Error('当前和弦在请求音域内没有可用落点，请扩大音域。');
    let pitches=mode==='bass'?[roots[Math.floor(random()*roots.length)]]:h.pitchClasses.map(pc=>{const choices=chordPitches.filter(p=>G.pitchClass(p)===pc);return choices[Math.floor(random()*choices.length)];}).filter(p=>p!==undefined);
    if(mode==='accompaniment'&&settings.textureStyle==='arp')pitches=[pitches[Math.floor(at/(G.PPQ/2))%pitches.length]];
    const slot={start:at,duration};if(occupied(slot))continue;
    for(const [i,pitch] of pitches.entries()){const written=pitch-Math.round(t.pipeline.transpose);if(written<0||written>127)throw Error('目标轨道移调超出音域。');const id='generated_'+seed+'_'+at+'_'+i;const timingOffset=reference.length?-((Math.floor(at/G.STEP)%2?project.swing*G.STEP:0)+(G.hash(id)-.5)*t.pipeline.humanize):0;notes.push({id,pitch:written,start:at,duration,velocity:mode==='bass'?.7:.48,...(reference.length?{timingOffset}: {})});}
   }
  }
  return {notes:notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch),retention:G.clone(retention),generation:{version:1,algorithm:G.generationVersion,kind:mode,seed:seed>>>0,templateVersion:1,inputHash:G.contentHash({sources,notes:G.musicalNotes(pat.notes),settings}),sources,settings:{mode,start,end,origin:clip.bar*G.BAR,strategy:settings.strategy||'support',drumRole:settings.drumRole||'closedHat',density:settings.density||'normal',drumStyle:settings.drumStyle||'straight',velocityStyle:settings.velocityStyle||'balanced',textureStyle:settings.textureStyle||'sustain'}}};
 }
 function generateEnsembleGroup(project,settings={},seed=1){
  const from=Number(settings.sourceBar||0)*G.BAR,to=from+Number(settings.bars||4)*G.BAR;
  const roles={drums:0,bass:1,texture:2};
  const targets=project.tracks.filter(t=>t.role in roles&&(!settings.trackIds||settings.trackIds.includes(t.id))).sort((a,b)=>roles[a.role]-roles[b.role]||a.id.localeCompare(b.id));
  const drums=targets.filter(t=>t.role==='drums'),melody=project.tracks.find(t=>t.id===settings.melodyTrackId),affected=[],clipIds=[];
  let next=G.clone(project);
  // Fixed DAG: drums -> bass -> accompaniment. A visual reorder cannot change task seeds.
  for(const track of targets)for(const clip of track.clips){const pat=track.patterns.find(p=>p.id===clip.patternId),origin=clip.bar*G.BAR;if(origin>=to||origin+pat.bars*G.BAR<=from)continue;
   const mode=track.role==='drums'?'drums':track.role==='bass'?'bass':'accompaniment';
   const options={...settings,mode,start:Math.max(0,from-origin),end:Math.min(pat.bars*G.BAR,to-origin),referenceTrackId:mode==='bass'&&drums.length===1?drums[0].id:mode==='accompaniment'?melody?.id:undefined};
   delete options.low;delete options.high;
   const stableSeed=(Number(seed)+roles[track.role]*7919+clip.bar*101)>>>0;
   const result=G.applyGenerated(next,{trackId:track.id,clipId:clip.id},generateEnsemble(next,{trackId:track.id,clipId:clip.id},options,stableSeed));next=result.project;affected.push(track.id);clipIds.push(clip.id);
  }
  if(!affected.length)throw Error('所选范围没有鼓、贝斯或伴奏实例，请先指定声部角色。');
  return {project:G.validateProject(next),trackId:affected[0],clipId:clipIds[0],patternId:next.tracks.find(t=>t.id===affected[0]).clips.find(c=>c.id===clipIds[0]).patternId,trackIds:[...new Set(affected)],clipIds,range:[from,to]};
 }
 Object.assign(G,{DRUM_ROLE_PITCH:ROLE_PITCH,drumRole,drumMap,remapDrums,sourceNotes,onsetsInRange,soundingIntervals,generateEnsemble,generateEnsembleGroup});
})(globalThis.GridTone ||= {});
