/** A batch has an ordered, inspectable placement plan. Preview, audio and commit use it unchanged. */
(function(G){'use strict';
 function suggestBatchTargets(project,templates,bar){
  const reserved=new Set();return templates.map(item=>{
   const candidates=project.tracks.filter(t=>!reserved.has(t.id)&&t.kind===item.kind&&G.canPlace(t,item,bar,Math.max(project.bars,bar+item.bars))).sort((a,b)=>Number(b.role===item.role)-Number(a.role===item.role));
   const id=candidates[0]?.id||'new-track';if(id!=='new-track')reserved.add(id);return id;
  });
 }
 function batchContextHash(project,targets){
  const ids=new Set(targets.filter(x=>x&&x!=='new-track'));
  return G.contentHash({id:project.id,key:project.key,scale:project.scale,bpm:project.bpm,swing:project.swing,master:project.master,tracks:project.tracks.filter(t=>ids.has(t.id)),assets:project.assets,catalog:project.catalog});
 }
 function planBatchPlacement(project,templates,{mode='series',trackId,bar=0,targets,adapt='original'}={}){
  if(!['series','parallel'].includes(mode)||!Number.isInteger(bar)||bar<0)throw Error('批量放置位置无效。');
  if(!['original','key'].includes(adapt))throw Error('批量调性方式无效。');
  if(!Array.isArray(templates)||!templates.length||templates.length>16)throw Error('请选择1—16个音乐模板。');
  if(templates.some(t=>t?.type!=='pattern'))throw Error('批量放置仅适用于单块音乐模板。整套组合、示例和音色请分别使用。');
  const span=mode==='series'?templates.reduce((s,t)=>s+t.bars,0):Math.max(...templates.map(t=>t.bars));
  if(bar+span>G.LIMITS.bars)throw Error('放入后超过256小节。');
  let p=G.clone(project),cursor=bar;const ids=[],tracks=[],placements=[];
  p.bars=Math.max(p.bars,bar+span);
  const mapped=mode==='series'?templates.map(()=>trackId):targets??templates.map(()=>'new-track');
  if(!Array.isArray(mapped)||mapped.length!==templates.length||mapped.some(id=>typeof id!=='string'||!id))throw Error('请为每块材料指定目标音轨。');
  if(mode==='series'&&new Set(templates.map(x=>x.kind)).size>1)throw Error('“接着放”需要同类型材料。不同声部请选择“一起放”。');
  let seriesNew=null;
  for(let i=0;i<templates.length;i++){
   const item=templates[i],destination=mode==='series'&&seriesNew?seriesNew:mapped[i],isNew=destination==='new-track',at=mode==='series'?cursor:bar;
   if(!isNew){const t=p.tracks.find(t=>t.id===destination);if(!t)throw Error('目标音轨已删除，请重新分配。');if(t.kind!==item.kind)throw Error(`「${item.name}」需要${item.kind==='drum'?'鼓':'旋律'}音轨。`);}
   const result=G.applyTemplate(p,item,{mode:isNew?'new-track':'new',trackId:isNew?undefined:destination,bar:at,adapt,applySound:false});
   p=result.project;ids.push(result.clipId);tracks.push(result.trackId);
   if(mode==='series'&&isNew)seriesNew=result.trackId;
   const t=p.tracks.find(t=>t.id===result.trackId);placements.push({index:i,materialId:item.id,name:item.name,trackId:t.id,trackName:t.name,newTrack:!project.tracks.some(x=>x.id===t.id),kind:item.kind,bar:at,bars:item.bars,key:adapt==='key'?project.key:item.key,scale:item.scale,clipId:result.clipId,patternId:result.patternId});
   if(mode==='series')cursor+=item.bars;
  }
  p.bars=Math.max(project.bars,bar+span);
  return {project:G.validateProject(p),trackId:tracks[0],patternId:placements[0].patternId,clipId:ids[0],clipIds:ids,trackIds:[...new Set(tracks)],placements,range:[bar*G.BAR,(bar+span)*G.BAR],newTrackCount:new Set(placements.filter(x=>x.newTrack).map(x=>x.trackId)).size,mode};
 }
 Object.assign(G,{planBatchPlacement,suggestBatchTargets,batchContextHash});
})(globalThis.GridTone ||= {});
