/** One placement contract for shelf clicks, keyboard and drag/drop. */
(function(G){'use strict';
 function planPlacement(project,template,options={}){
  const {trackId,clipId,patternId,bar=0,start=0,end,replace=false,splitBoundary=false,shared=false}=options;
  if(template.type==='song')return G.applyTemplate(project,template,options);
  if(template.type==='recipe')return G.applyRecipe(project,template.id,{bar,key:project.key});
  const track=project.tracks.find(t=>t.id===trackId);if(!track)throw Error('请选择目标音轨。');
  if(track.kind!==template.kind)throw Error('素材与目标轨道类型不同，请选择匹配的音轨。');
  if(!patternId&&!clipId)return G.applyTemplate(project,template,{mode:'new',trackId,bar,adapt:'original',applySound:false});
  const currentClip=track.clips.find(c=>c.id===clipId),original=track.patterns.find(p=>p.id===(currentClip?.patternId||patternId));if(!original)throw Error('目标片段不存在。');
  const finish=end??start+template.bars*G.BAR;
  if(!Number.isFinite(start)||!Number.isFinite(finish)||start<0||finish<=start||finish>original.bars*G.BAR)throw Error('素材超出当前乐句，请在编排空位新建独立片段，或先扩展乐句。');
  if(template.bars*G.BAR>finish-start)throw Error('选区小于素材原长，请扩大选区。');
  const crossing=original.notes.filter(n=>n.start<finish&&n.start+n.duration>start&&(n.start<start||n.start+n.duration>finish));
  if(replace&&crossing.length&&!splitBoundary)throw Error('有长音跨过选区边界。请扩大选区，或明确选择拆分边界音符。');
  const selected=original.notes.filter(n=>n.start<finish&&n.start+n.duration>start);
  if(selected.length&&!replace)throw Error('这里已有音符。请选择“替换选区”或另选空位。');
  const p=G.clone(project),t=p.tracks.find(t=>t.id===trackId),clip=t.clips.find(c=>c.id===clipId);let pat=t.patterns.find(x=>x.id===original.id);
  if(!shared&&t.clips.filter(c=>c.patternId===pat.id).length>1){if(!clip)throw Error('请指定要独立修改的实例。');pat=G.copyPattern(pat);pat.name+=' · 素材变化';t.patterns.push(pat);clip.patternId=pat.id;}
  const keep=[],splitReferences=[];
  for(const n of pat.notes){if(n.start>=finish||n.start+n.duration<=start){keep.push(n);continue;}if(splitBoundary){if(n.start<start)keep.push({...n,duration:start-n.start});if(n.start+n.duration>finish){const id=n.start<start?G.uid('n'):n.id;keep.push({...n,id,performanceKey:n.performanceKey||n.id,start:finish,duration:n.start+n.duration-finish});if(id!==n.id){const retention=pat.retention?.notes.find(r=>r.id===n.id);if(retention)splitReferences.push({...retention,id});}}}}
  let incoming=template.notes.map(n=>({...n,id:G.uid('n'),start:n.start+start}));
  if(t.kind==='drum')incoming=G.remapDrums(incoming,G.resolveKit(template.drumkitId||'builtin.standard',p).rows,G.drumsFor(p,t));
  pat.notes=keep.concat(incoming);if(pat.retention)pat.retention.notes=pat.retention.notes.concat(splitReferences).filter(n=>pat.notes.some(v=>v.id===n.id));delete pat.generation;
  G.mergePlacedHarmony(original,pat,template,start,finish);if(template.attributions){pat.attributions??=[];for(const ref of template.attributions)if(!pat.attributions.some(r=>r.id===ref.id))pat.attributions.push(G.clone(ref));}G.annotateStudioMaterial?.(pat,template.id);
  return {project:G.validateProject(p),trackId:t.id,patternId:pat.id,clipId:clip?.id,range:clip?[(clip.bar*G.BAR)+start,(clip.bar*G.BAR)+finish]:undefined};
 }
 G.planPlacement=planPlacement;
})(globalThis.GridTone ||= {});
