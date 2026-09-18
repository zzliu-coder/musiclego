/** Studio commands: musical edits remain independent of view state. */
(function(G){
 'use strict';
 G.snapTicks=s=>Number(s.snap)>0?Number(s.snap):1;
 G.snapTime=(tick,s)=>Math.round(tick/G.snapTicks(s))*G.snapTicks(s);
 G.gridWindow=(s,p)=>({offset:s.continuous===false?s.page*G.BAR:0,bars:s.continuous===false?1:p.bars});
 G.clipSelection=(p,ids)=>p.tracks.flatMap(t=>t.clips.filter(c=>ids.includes(c.id)).map(c=>({track:t,clip:c,pattern:t.patterns.find(x=>x.id===c.patternId)})));
 G.moveClips=function(p,ids,delta,targetId=null,copy=false){
  const next=G.clone(p),items=G.clipSelection(next,ids); if(!items.length)return {project:next,ids:[]};
  const target=targetId?next.tracks.find(t=>t.id===targetId):null;
  if(target&&items.some(x=>x.track.kind!==target.kind))throw Error('鼓点与旋律请放入同类型音轨。');
  if(!copy)for(const t of next.tracks)t.clips=t.clips.filter(c=>!ids.includes(c.id));
  const newIds=[];
  for(const {track,clip,pattern} of items){
   const dest=target||track;let pat=pattern;
   if(copy||dest.id!==track.id){pat=G.copyPattern(pattern);dest.patterns.push(pat);}
   const at=clip.bar+delta;
   if(!G.canPlace(dest,pat,at,next.bars))throw Error('目标位置空间不足，请选择空白位置。');
   const c={...clip,id:copy?G.uid('c'):clip.id,patternId:pat.id,bar:at};dest.clips.push(c);newIds.push(c.id);
  }
  return {project:next,ids:newIds};
 };
})(globalThis.GridTone ||= {});
