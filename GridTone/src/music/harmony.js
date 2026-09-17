/** Explicit harmonic intent. Notes remain the only playback truth. */
(function(G){'use strict';
 const pc=n=>((n%12)+12)%12;
 function contentHash(value){const s=JSON.stringify(value);let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
 const musicalNotes=notes=>notes.map(n=>[n.pitch,n.start,n.duration,n.velocity]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
 const musicHash=pat=>contentHash({bars:pat.bars,notes:musicalNotes(pat.notes)});
 function confirmHarmony(pat,harmony){pat.harmony=G.clone(harmony);pat.harmony.confirmedMusicHash=musicHash(pat);return pat;}
 function sourceHash(track){return contentHash({transpose:track.pipeline.transpose,clips:track.clips.map(c=>({bar:c.bar,pattern:(()=>{const p=track.patterns.find(p=>p.id===c.patternId);return {bars:p.bars,harmony:p.harmony,notes:musicalNotes(p.notes)};})()}))});}
 function harmonyStatus(pat){return !pat.harmony?'missing':pat.harmony.confirmedMusicHash===musicHash(pat)?'confirmed':'stale';}
 function resolveHarmony(project,{trackId,clipId,sourceTrackId,start=0,end}){
  const track=project.tracks.find(t=>t.id===trackId),clip=track?.clips.find(c=>c.id===clipId),pat=track?.patterns.find(p=>p.id===clip?.patternId);
  if(!pat)throw Error('请选择编排中的目标片段实例。');
  end??=pat.bars*G.BAR;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>pat.bars*G.BAR)throw Error('和声查询范围无效。');
  const source=project.tracks.find(t=>t.id===sourceTrackId);
  if(!source||source.kind==='drum')throw Error('选择参考和弦：需要明确的和弦来源轨道。');
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
  return {events,sourceTrackId,sourceHash:sourceHash(source),trackId,clipId,start,end,origin,targetTranspose:Math.round(track.pipeline.transpose),bars:pat.bars};
 }
 function dependencyStatus(project,pat){
  if(!pat.generation)return 'none';
  for(const ref of pat.generation.sources||[]){const t=project.tracks.find(t=>t.id===ref.trackId);if(!t)return 'missing';if(sourceHash(t)!==ref.hash)return 'stale';}
  return 'current';
 }
 function bakeHarmony(pat,transpose){if(!pat.harmony)return;const h=G.clone(pat.harmony);for(const e of h.events){e.rootPitchClass=pc(e.rootPitchClass+transpose);if(e.pitchClasses)e.pitchClasses=e.pitchClasses.map(p=>pc(p+transpose));}confirmHarmony(pat,h);}
 Object.assign(G,{pitchClass:pc,contentHash,musicalNotes,musicHash,confirmHarmony,sourceHash,harmonyStatus,resolveHarmony,dependencyStatus,bakeHarmony});
})(globalThis.GridTone ||= {});
