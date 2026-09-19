/** Explicit harmonic intent. Notes remain the only playback truth. */
(function(G){'use strict';
 const pc=n=>((n%12)+12)%12;
 function contentHash(value){const s=JSON.stringify(value);let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
 const musicalNotes=notes=>notes.map(n=>[n.pitch,n.start,n.duration,n.velocity]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
 const musicHash=pat=>contentHash({bars:pat.bars,notes:musicalNotes(pat.notes)});
 function confirmHarmony(pat,harmony){pat.harmony=G.clone(harmony);pat.harmony.confirmedMusicHash=musicHash(pat);return pat;}
 function sourceHash(track){return contentHash({transpose:track.pipeline.transpose,clips:track.clips.map(c=>({bar:c.bar,pattern:(()=>{const p=track.patterns.find(p=>p.id===c.patternId);return {bars:p.bars,harmony:p.harmony,notes:musicalNotes(p.notes)};})()}))});}
 function rangeSourceHash(track,from,to){return contentHash({transpose:track.pipeline.transpose,clips:track.clips.flatMap(c=>{const p=track.patterns.find(p=>p.id===c.patternId),origin=c.bar*G.BAR;if(origin>=to||origin+p.bars*G.BAR<=from)return [];return [{bar:c.bar,notes:musicalNotes(p.notes.filter(n=>origin+n.start<to&&origin+n.start+n.duration>from)),harmony:p.harmony?.events.filter(e=>origin+e.start<to&&origin+e.start+e.duration>from)}];}).sort((a,b)=>a.bar-b.bar)});}
 function performanceSourceHash(project,track,from,to){return contentHash({swing:project.swing,pipeline:track.pipeline,events:track.clips.flatMap(c=>{const p=track.patterns.find(p=>p.id===c.patternId),origin=c.bar*G.BAR;return G.processPattern(p,track,project).filter(n=>origin+n.start<to&&origin+n.start+n.duration>from).map(n=>[n.pitch,origin+n.start,n.duration,n.velocity]);}).sort((a,b)=>a[1]-b[1]||a[0]-b[0])});}
 function drumMappingHash(project,track){
  if(track?.kind!=='drum')return null;
  return contentHash((G.drumsFor(project,track)||[]).map(row=>[row.pitch,G.drumRole(row)||null]).sort((a,b)=>a[0]-b[0]));
 }
 function dependencyMatches(project,track,ref){return !!track&&dependencyHash(project,track,ref)===ref.hash&&(ref.roleMapHash===undefined||drumMappingHash(project,track)===ref.roleMapHash);}
 function dependencyHash(project,track,ref){return ref.layer==='performed'?performanceSourceHash(project,track,...ref.range):ref.range?rangeSourceHash(track,...ref.range):sourceHash(track);}
 function harmonyStatus(pat){return !pat.harmony?'missing':pat.harmony.confirmedMusicHash===musicHash(pat)?'confirmed':'stale';}
 function assertDependencies(project,targetId,sourceIds){const visit=(id,path)=>{if(id===targetId)throw Error('参考关系形成循环，请选择独立来源。');if(path.has(id))throw Error('来源中存在循环参考，请先整理依赖。');const track=project.tracks.find(t=>t.id===id);if(!track)return;const next=new Set(path);next.add(id);for(const ref of new Set(track.patterns.flatMap(p=>p.generation?.sources.map(s=>s.trackId)||[])))visit(ref,next);};for(const id of sourceIds.filter(Boolean))visit(id,new Set());}
 function resolveHarmony(project,{trackId,clipId,sourceTrackId,start=0,end}){
  const track=project.tracks.find(t=>t.id===trackId),clip=track?.clips.find(c=>c.id===clipId),pat=track?.patterns.find(p=>p.id===clip?.patternId);
  if(!pat)throw Error('请选择编排中的目标片段实例。');
  end??=pat.bars*G.BAR;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>pat.bars*G.BAR)throw Error('和声查询范围无效。');
  const source=project.tracks.find(t=>t.id===sourceTrackId);
  if(!source||source.kind==='drum')throw Error('选择参考和弦：需要明确的和弦来源轨道。');
  assertDependencies(project,trackId,[sourceTrackId]);
  const origin=clip.bar*G.BAR,from=origin+start,to=origin+end,events=[];
  for(const c of source.clips){const p=source.patterns.find(p=>p.id===c.patternId),offset=c.bar*G.BAR;
   if(offset>=to||offset+p.bars*G.BAR<=from)continue;
   if(harmonyStatus(p)!=='confirmed')throw Error(`第 ${c.bar+1} 小节的和声${p.harmony?'需要复核':'尚未指定'}，请先确认参考和弦。`);
   for(const h of p.harmony.events){const a=Math.max(from,offset+h.start),b=Math.min(to,offset+h.start+h.duration);if(a>=b)continue;
    const shift=Math.round(source.pipeline.transpose),shape=h.pitchClasses||G.CHORD_SHAPES[h.quality].map(x=>pc(h.rootPitchClass+x));
    events.push({start:a-origin,duration:b-a,rootPitchClass:pc(h.rootPitchClass+shift),quality:h.quality,pitchClasses:[...new Set(shape.map(x=>pc(x+shift)))],sourceClipId:c.id});
   }
  }
  events.sort((a,b)=>a.start-b.start);let cursor=start;
  for(const event of events){if(event.start>cursor+1e-7)throw Error(`参考和弦在第 ${Math.floor((origin+cursor)/G.BAR)+1} 小节存在空档。`);if(event.start<cursor-1e-7)throw Error('参考和弦互相重叠，请确认来源。');cursor=event.start+event.duration;}
  if(cursor<end-1e-7)throw Error(`参考和弦未覆盖第 ${Math.floor((origin+cursor)/G.BAR)+1} 小节。`);
  return {events,sourceTrackId,sourceHash:rangeSourceHash(source,from,to),sourceRange:[from,to],trackId,clipId,start,end,origin,targetTranspose:Math.round(track.pipeline.transpose),bars:pat.bars};
 }
 function dependencyStatus(project,pat,clip){
  if(!pat.generation)return 'none';
  if(pat.generation.settings.timeEdited)return 'stale';
  if(clip&&pat.generation.settings.origin!==undefined&&clip.bar*G.BAR!==pat.generation.settings.origin)return 'stale';
  for(const ref of pat.generation.sources||[]){const t=project.tracks.find(t=>t.id===ref.trackId);if(!t)return 'missing';if(!dependencyMatches(project,t,ref))return 'stale';}
  const settings=pat.generation.settings;
  if(settings.drumReferenceTrackId){
   const source=project.tracks.find(t=>t.id===settings.drumReferenceTrackId);
   if(!source)return 'missing';
   if(drumMappingHash(project,source)!==settings.drumReferenceMapHash)return 'stale';
  }
  return 'current';
 }
 /** Apply harmonic intent with the same half-open interval as the note transaction.
  * An unknown region is a gap, and stale intent is never silently confirmed. */
 function mergePlacedHarmony(before,after,template,start,end){
  const outside=[];
  for(const event of before.harmony?.events||[]){
   const stop=event.start+event.duration;
   if(event.start<start){const b=Math.min(stop,start);if(b-event.start>=1)outside.push({...G.clone(event),duration:b-event.start});}
   if(stop>end){const a=Math.max(event.start,end);if(stop-a>=1)outside.push({...G.clone(event),start:a,duration:stop-a});}
  }
  const incoming=(template.harmony?.events||[]).map(event=>({...G.clone(event),start:event.start+start}));
  const events=outside.concat(incoming).sort((a,b)=>a.start-b.start);
  if(!events.length){delete after.harmony;return 'missing';}
  const h={version:1,events,confirmedMusicHash:'pending'};
  // A single source label would misrepresent a collage. Keep it only on a full replacement.
  if(!outside.length&&start===0&&template.bars===after.bars&&template.harmony?.source)h.source=G.clone(template.harmony.source);
  if(outside.length&&harmonyStatus(before)==='stale'||template.harmony?.confirmedMusicHash?.startsWith('stale:')){
   h.confirmedMusicHash='stale:'+musicHash(after);after.harmony=h;return 'stale';
  }
  confirmHarmony(after,h);return 'confirmed';
 }
 /** Caller captures status before rewriting performed notes. Unknown/stale intent stays unconfirmed. */
 function bakeHarmony(pat,transpose,previousStatus=harmonyStatus(pat)){
  if(!pat.harmony)return;const h=G.clone(pat.harmony);
  for(const e of h.events){e.rootPitchClass=pc(e.rootPitchClass+transpose);if(e.pitchClasses)e.pitchClasses=e.pitchClasses.map(p=>pc(p+transpose));}
  if(previousStatus==='confirmed')confirmHarmony(pat,h);
  else {h.confirmedMusicHash='stale:'+musicHash(pat);pat.harmony=h;}
 }
 Object.assign(G,{pitchClass:pc,contentHash,musicalNotes,musicHash,confirmHarmony,sourceHash,rangeSourceHash,harmonyStatus,resolveHarmony,dependencyStatus,bakeHarmony,mergePlacedHarmony,assertDependencies,performanceSourceHash,dependencyHash,dependencyMatches,drumMappingHash});
})(globalThis.GridTone ||= {});
