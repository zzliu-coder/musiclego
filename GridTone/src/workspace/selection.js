/** Editing identity is independent of open content, browser focus and the transport. */
(function(G){'use strict';
 const empty=()=>({kind:'none'});
 function resolveEditTarget(project,s){
  const a=s.editTarget||empty(),t=project.tracks.find(t=>t.id===a.trackId);
  if(a.kind==='track')return t?{kind:'track',trackId:t.id,track:t}:empty();
  if(a.kind==='clips'){
   const ids=[...new Set(a.ids||[])].filter(id=>project.tracks.some(t=>t.clips.some(c=>c.id===id))),items=G.clipSelection(project,ids);
   return items.length||t?{kind:'clips',ids,items,trackId:t?.id||items[0]?.track.id,tick:s.arrangeCursor?.tick||0}:empty();
  }
  if(a.kind==='notes'||a.kind==='range'){
   const p=t?.patterns.find(p=>p.id===a.patternId);if(!p)return empty();
   const c=t.clips.find(c=>c.id===a.clipId&&c.patternId===p.id);
   if(a.kind==='range'){
    const r=a.range;if(!r||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>p.bars*G.BAR)return empty();
    return {kind:'range',trackId:t.id,patternId:p.id,clipId:c?.id||null,track:t,pattern:p,range:{...r}};
   }
   const ids=[...new Set(a.ids||[])].filter(id=>p.notes.some(n=>n.id===id));
   return {kind:'notes',trackId:t.id,patternId:p.id,clipId:c?.id||null,track:t,pattern:p,ids,notes:p.notes.filter(n=>ids.includes(n.id))};
  }
  return empty();
 }
 function editTargetData(a){const x={kind:a.kind};for(const k of ['trackId','patternId','clipId','ids','range'])if(a[k]!==undefined)x[k]=G.clone(a[k]);return x;}
 function setEditTarget(s,project,a){
  s.editTarget=editTargetData(resolveEditTarget(project,{...s,editTarget:a}));
  if(s.editTarget.kind==='clips')s.clipIds=[...(s.editTarget.ids||[])];
  if(s.editTarget.kind==='notes')s.selected=[...(s.editTarget.ids||[])];
  if(s.editTarget.kind==='range'){s.noteRange={...s.editTarget.range};s.selected=[];}
  else s.noteRange=null;
  if(s.editTarget.kind==='track')s.inspectorTrackId=s.editTarget.trackId;
  return s.editTarget;
 }
 function reconcileEditTarget(s,project){return setEditTarget(s,project,s.editTarget||empty());}
 function activateNotes(s,project){return setEditTarget(s,project,{kind:'notes',trackId:s.trackId,patternId:s.patternId,clipId:s.clipId,ids:[...s.selected]});}
 function activateClips(s,project,ids=s.clipIds,trackId=s.trackId){return setEditTarget(s,project,{kind:'clips',trackId,ids:[...ids]});}
 function activeTrack(project,s){const a=resolveEditTarget(project,s);return project.tracks.find(t=>t.id===(a.trackId||s.inspectorTrackId||s.trackId))||project.tracks[0];}
 function positionLabel(tick,absolute=false){const b=Math.floor(tick/G.BAR),beat=(tick%G.BAR)/G.PPQ+1;return `第 ${b+1} 小节${beat===1?'':` · 第 ${Number(beat.toFixed(3))} 拍`}`;}
 function targetLabel(project,s){
  const a=resolveEditTarget(project,s);
  if(a.kind==='track')return {title:`音轨 · ${a.track.name}`,detail:`${a.track.clips.length} 个音乐块 · 音色与设置作用于整轨`};
  if(a.kind==='clips')return {title:a.ids.length?`${a.ids.length} 个音乐块`:'编排空位',detail:a.ids.length===1?`${a.items[0].pattern.name} · ${positionLabel(a.items[0].clip.bar*G.BAR)}`:`粘贴落点：${positionLabel(s.arrangeCursor?.tick||0)}`};
  if(a.kind==='range')return {title:'音乐时间范围',detail:`${a.pattern.name} · ${Number((a.range.end-a.range.start)/G.PPQ).toFixed(2).replace(/\.00$/,'')} 拍（含休止）`};
  if(a.kind==='notes')return {title:a.ids.length?`${a.ids.length} 个音符`:'音符画板',detail:`${a.pattern.name} · ${a.track.name}`};
  return {title:'选择要编辑的内容',detail:'点音乐块、轨道或音符，再使用右侧操作'};
 }
 Object.assign(G,{resolveEditTarget,editTargetData,setEditTarget,reconcileEditTarget,activateNotes,activateClips,activeEditTrack:activeTrack,editPositionLabel:positionLabel,editTargetLabel:targetLabel});
})(globalThis.GridTone ||= {});
