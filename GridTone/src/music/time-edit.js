/** Exact whole-song time edits. A surviving phrase stays one phrase (including 3/5/7 bars).
 * Clear leaves a rest; delete joins time. Neither operation invents seams at powers of two.
 * Only the affected arrangement instance is rewritten; other references keep their IDs.
 */
(function(G){'use strict';
 const validInt=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
 function occupiedEnd(p){return Math.max(1,...p.tracks.flatMap(t=>t.clips.map(c=>c.bar+t.patterns.find(x=>x.id===c.patternId).bars)));}
 function resizeSong(project,bars){
  if(!validInt(bars,1,G.LIMITS.bars))throw Error('作品长度应为1—256个完整小节。');
  const end=occupiedEnd(project);if(bars<end)throw Error(`第${end}小节仍有音乐块。请先移除或明确删除那段时间。`);
  const p=G.clone(project);p.bars=bars;return {project:G.validateProject(p),timeEdit:{kind:'resize',bars}};
 }
 function trimSong(project){return resizeSong(project,occupiedEnd(project));}
 // Half-open intervals. Deleting time joins the two surviving sides of one sustained note.
 function mapInterval(start,end,a,b,kind){
  if(end<=a)return [[start,end]];
  if(start>=b)return [[start-(kind==='delete'?b-a:0),end-(kind==='delete'?b-a:0)]];
  if(kind==='delete'){
   const left=start<a?start:a,right=end>b?end-(b-a):a;
   return right-left>=1?[[left,right]]:[];
  }
  const out=[];if(start<a&&a-start>=1)out.push([start,Math.min(a,end)]);
  if(end>b&&end-b>=1)out.push([Math.max(start,b),end]);return out;
 }
 function rewritePattern(source,a,b,kind){
  const pat=G.clone(source),ids=new Map();pat.id=G.uid('p');
  pat.bars=source.bars-(kind==='delete'?(b-a)/G.BAR:0);pat.notes=[];
  for(const n of source.notes){
   const mapped=mapInterval(n.start,n.start+n.duration,a,b,kind),newIds=[];
   for(const [start,end] of mapped){const id=G.uid('n');newIds.push(id);pat.notes.push({...G.clone(n),id,performanceKey:n.performanceKey||n.id,swingPhase:n.swingPhase??Math.floor(n.start/G.STEP)%2,start,duration:end-start});}
   ids.set(n.id,newIds);
  }
  if(source.retention)pat.retention={notes:source.retention.notes.flatMap(n=>(ids.get(n.id)||[]).map(id=>({...G.clone(n),id}))),ranges:source.retention.ranges.flatMap(r=>mapInterval(r.start,r.end,a,b,kind).map(([start,end])=>({start,end})))};
  if(source.harmony){
   const h=G.clone(source.harmony);delete h.source;
   h.events=source.harmony.events.flatMap(e=>mapInterval(e.start,e.start+e.duration,a,b,kind).map(([start,end])=>({...G.clone(e),start,duration:end-start})));
   // Joining identical harmony descriptions must not create spurious harmonic boundaries.
   const events=[];for(const e of h.events){const last=events.at(-1);if(kind==='delete'&&last&&last.start+last.duration===e.start&&last.rootPitchClass===e.rootPitchClass&&last.quality===e.quality&&JSON.stringify(last.pitchClasses)===JSON.stringify(e.pitchClasses))last.duration+=e.duration;else events.push(e);}h.events=events;
   if(h.events.length){if(G.harmonyStatus(source)==='confirmed')G.confirmHarmony(pat,h);else{h.confirmedMusicHash='stale:'+G.musicHash(pat);pat.harmony=h;}}else delete pat.harmony;
  }
  // Preserve provenance for explanation, while explicitly requiring a fresh generation check.
  if(pat.generation){pat.generation.settings={...pat.generation.settings,timeEdited:true};}
  return pat;
 }
 function editSongTime(project,{startBar,endBar,kind='clear'}){
  if(!['clear','delete'].includes(kind))throw Error('时间操作无效。');
  if(!validInt(startBar,0,project.bars-1)||!validInt(endBar,startBar+1,project.bars))throw Error('请选择作品内的完整小节范围。');
  const width=endBar-startBar;if(kind==='delete'&&width>=project.bars)throw Error('作品至少保留一小节；清空全曲请使用“清除内容”。');
  const p=G.clone(project);let rewrittenCount=0,removedCount=0;
  for(const t of p.tracks){const before=new Map(t.patterns.map(x=>[x.id,x])),changed=new Set(),next=[];
   for(const c of t.clips){const source=before.get(c.patternId),lo=c.bar,hi=lo+source.bars;
    if(hi<=startBar||lo>=endBar){next.push({...c,bar:kind==='delete'&&lo>=endBar?lo-width:lo});continue;}
    if(lo>=startBar&&hi<=endBar){changed.add(source.id);removedCount++;continue;}
    const a=(Math.max(lo,startBar)-lo)*G.BAR,b=(Math.min(hi,endBar)-lo)*G.BAR;
    const intersects=(s,e)=>s<b&&e>a;
    if(kind==='clear'&&!source.notes.some(n=>intersects(n.start,n.start+n.duration))&&!(source.harmony?.events||[]).some(e=>intersects(e.start,e.start+e.duration))&&!(source.retention?.ranges||[]).some(r=>intersects(r.start,r.end))){next.push(c);continue;}
    const pat=rewritePattern(source,a,b,kind);t.patterns.push(pat);changed.add(source.id);rewrittenCount++;
    // Keep the arrangement instance stable; only its independent musical content changes.
    next.push({...c,patternId:pat.id,bar:kind==='delete'&&lo>startBar?startBar:lo});
   }
   t.clips=next.sort((a,b)=>a.bar-b.bar);const used=new Set(next.map(c=>c.patternId));t.patterns=t.patterns.filter(pat=>!changed.has(pat.id)||used.has(pat.id));
   if(!t.patterns.length)t.patterns.push(G.newPattern('空白音乐块',1));
  }
  if(kind==='delete')p.bars-=width;
  return {project:G.validateProject(p),timeEdit:{kind,startBar,endBar,bars:p.bars},splitCount:0,rewrittenCount,removedCount};
 }
 function mapSongTick(tick,edit){if(!Number.isFinite(tick))return 0;let x=tick;if(edit.kind==='delete'){const a=edit.startBar*G.BAR,b=edit.endBar*G.BAR;if(x>=b)x-=b-a;else if(x>a)x=a;}return G.clamp(x,0,edit.bars*G.BAR);}
 function reconcileSongTime(S,B,edit){S.cursor=Math.max(0,S.cursor||0);if(S.arrangeCursor)S.arrangeCursor.tick=Math.min(Math.max(0,edit.bars*G.BAR-1),mapSongTick(S.arrangeCursor.tick,edit));B.startTick=mapSongTick(B.startTick||0,edit);if(B.range){const a=mapSongTick(B.range[0],edit),b=mapSongTick(B.range[1],edit);B.range=b>a?[a,b]:null;}}
 Object.assign(G,{occupiedEnd,resizeSong,trimSong,editSongTime,mapSongTick,reconcileSongTime});
})(globalThis.GridTone ||= {});
