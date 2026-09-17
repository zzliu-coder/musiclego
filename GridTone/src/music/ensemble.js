(function(G){'use strict';
 const ROLE_PITCH={kick:36,snare:38,closedHat:42,openHat:46,clap:39,tom:45,crash:49,rim:37};
 function drumRole(row){return row.role||Object.keys(ROLE_PITCH).find(k=>row.source?.type==='drum'&&ROLE_PITCH[k]===row.source.pitch);}
 function drumMap(project,track){const map=new Map();for(const row of G.drumsFor(project,track)){const role=drumRole(row);if(role&&!row.missing&&!map.has(role))map.set(role,row.pitch);}return map;}
 function remapDrums(notes,sourceRows,targetRows){const source=new Map(sourceRows.map(r=>[r.pitch,drumRole(r)])),target=new Map(targetRows.map(r=>[drumRole(r),r.pitch]));return notes.map(n=>{const role=source.get(n.pitch),pitch=target.get(role);if(!role||pitch===undefined)throw Error('目标鼓组缺少 '+(role||'未定义角色')+'，请选择替代鼓组或补齐角色。');return {...n,pitch};});}
 function sourceNotes(project,trackId,origin,length){const t=project.tracks.find(t=>t.id===trackId);if(!t)throw Error('参考声部已不存在。');return t.clips.flatMap(c=>{const p=t.patterns.find(p=>p.id===c.patternId);return p.notes.map(n=>({...n,start:c.bar*G.BAR+n.start-origin}));}).filter(n=>n.start>=0&&n.start<length);}
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
   const step=settings.density==='dense'?G.STEP:G.PPQ/2;
   for(let at=start;at<end;at+=step){if(settings.density==='sparse'&&at%G.PPQ!==0)continue;if(at%G.PPQ!==0&&random()<.15)continue;const n={id:'generated_'+seed+'_'+at,pitch,start:at,duration:Math.min(G.STEP,end-at),velocity:at%G.PPQ===0?.64:.4};if(!notes.some(x=>x.pitch===pitch&&x.start===at)&&!retention.ranges.some(r=>at<r.end&&at+n.duration>r.start))notes.push(n);}
  }else{
   if(t.kind==='drum')throw Error('请选择旋律类音轨。');
   harmony=G.resolveHarmony(project,{...target,sourceTrackId:settings.sourceTrackId});sources.push({trackId:harmony.sourceTrackId,hash:harmony.sourceHash});
   let reference=[];
   if(settings.referenceTrackId){const source=project.tracks.find(t=>t.id===settings.referenceTrackId);if(!source)throw Error('参考声部不存在。');if(source.id===t.id)throw Error('请选择另一条轨道作为参考。');reference=sourceNotes(project,source.id,harmony.origin,length);sources.push({trackId:source.id,hash:G.sourceHash(source)});if(mode==='bass'){const kick=drumMap(project,source).get('kick');if(kick===undefined)throw Error('参考鼓轨没有底鼓角色。');reference=reference.filter(n=>n.pitch===kick);}}
   notes.push(...pat.notes.filter(keep).map(G.clone));
   let onsets=[];
   if(mode==='bass'&&reference.length)onsets=reference.map(n=>n.start+(settings.strategy==='answer'?G.PPQ/2:0));
   else if(mode==='accompaniment'&&reference.length&&settings.strategy==='together')onsets=reference.map(n=>n.start);
   else for(let at=start;at<end;at+=mode==='bass'?G.PPQ*2:settings.strategy==='support'?G.BAR:G.PPQ)onsets.push(at);
   for(const at of [...new Set(onsets)].sort((a,b)=>a-b)){
    if(at<start||at>=end)continue;
    const active=reference.some(n=>at>=n.start&&at<n.start+n.duration);
    if(mode==='accompaniment'&&settings.strategy!=='together'&&active)continue;
    const h=harmony.events.find(e=>at>=e.start&&at<e.start+e.duration);if(!h)throw Error('参考和弦存在空档。');
    const duration=Math.min(mode==='bass'?G.PPQ*.7:settings.strategy==='support'?G.BAR*.85:G.PPQ*.6,end-at,h.start+h.duration-at),base=mode==='bass'?36:60;
    const pitches=mode==='bass'?[base+h.rootPitchClass]:h.pitchClasses.map(pc=>base+pc);
    const slot={start:at,duration};if(occupied(slot))continue;
    for(const [i,pitch] of pitches.entries()){const written=pitch-Math.round(t.pipeline.transpose);if(written<0||written>127)throw Error('目标轨道移调超出音域。');notes.push({id:'generated_'+seed+'_'+at+'_'+i,pitch:written,start:at,duration,velocity:mode==='bass'?.7:.48});}
   }
  }
  return {notes:notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch),retention:G.clone(retention),generation:{version:1,algorithm:G.generationVersion,kind:mode,seed:seed>>>0,templateVersion:1,inputHash:G.contentHash({sources,notes:G.musicalNotes(pat.notes),settings}),sources,settings:{mode,start,end,strategy:settings.strategy||'support',drumRole:settings.drumRole||'closedHat',density:settings.density||'normal'}}};
 }
 Object.assign(G,{DRUM_ROLE_PITCH:ROLE_PITCH,drumRole,drumMap,remapDrums,sourceNotes,generateEnsemble});
})(globalThis.GridTone ||= {});
