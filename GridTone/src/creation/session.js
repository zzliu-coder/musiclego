/** Frozen candidates with field-level, conflict-checked application. */
(function(G){'use strict';
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const keyed=a=>Array.isArray(a)&&a.every(x=>x&&typeof x==='object'&&typeof x.id==='string');
 function candidatePatch(before,after,path=[],out=[]){
  if(equal(before,after))return out;
  if(keyed(before)&&keyed(after)){
   for(const id of new Set([...before,...after].map(x=>x.id)))candidatePatch(before.find(x=>x.id===id),after.find(x=>x.id===id),[...path,{id}],out);
   if(!equal(before.map(x=>x.id),after.map(x=>x.id)))out.push({path,orderBefore:before.map(x=>x.id),orderAfter:after.map(x=>x.id)});
  }else if(before&&after&&!Array.isArray(before)&&!Array.isArray(after)&&typeof before==='object'&&typeof after==='object'){
   for(const key of new Set([...Object.keys(before),...Object.keys(after)]))candidatePatch(before[key],after[key],[...path,key],out);
  }else out.push({path,before:G.clone(before??null),after:G.clone(after??null),remove:after===undefined,add:before===undefined});
  return out;
 }
 function locate(root,path){let value=root;for(const key of path)value=typeof key==='object'?value?.find(x=>x.id===key.id):value?.[key];return value;}
 function applyCandidatePatch(current,patch){
  const next=G.clone(current);
  for(const change of patch){if(change.orderAfter)continue;const value=locate(current,change.path);if(!equal(value,change.add?undefined:change.before))throw Error('目标内容已变化，请重新生成。');}
  for(const change of patch){if(change.orderAfter){const list=locate(next,change.path),old=locate(current,change.path)||[],common=new Set(change.orderBefore);if(list&&equal(old.filter(x=>common.has(x.id)).map(x=>x.id),change.orderBefore.filter(id=>old.some(x=>x.id===id)))){const rank=new Map(change.orderAfter.map((id,i)=>[id,i]));list.sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));}continue;}const parent=locate(next,change.path.slice(0,-1)),key=change.path.at(-1);if(!parent)throw Error('目标已删除，请重新选择。');
   if(typeof key==='object'){const i=parent.findIndex(x=>x.id===key.id);if(change.remove){if(i>=0)parent.splice(i,1);}else if(i<0)parent.push(G.clone(change.after));else parent[i]=G.clone(change.after);}
   else if(change.remove)delete parent[key];else parent[key]=G.clone(change.after);
  }
  return G.validateProject(next);
 }
 function targetFingerprint(project,target){
  if(!target?.clipId)return G.contentHash({id:project.id});
  const t=project.tracks.find(t=>t.id===target.trackId),c=t?.clips.find(c=>c.id===target.clipId),p=t?.patterns.find(p=>p.id===c?.patternId);
  return G.contentHash({id:project.id,clip:c,pattern:p?{id:p.id,bars:p.bars,notes:p.notes,retention:p.retention,harmony:p.harmony}:null,pipeline:t?.pipeline,kind:t?.kind,drumMapping:t?.kind==='drum'?G.drumMappingHash(project,t):undefined});
 }
 class CandidateSession{
  constructor(project,operationId,target={},parameters={}){this.projectId=project.id;this.operationId=operationId;this.target=G.clone(target);this.base=G.clone(project);this.baseRevision=G.contentHash(project);this.relevantInputFingerprint=targetFingerprint(project,target);this.parameterFingerprint=G.contentHash(parameters);this.parameters=G.clone(parameters);this.effectiveInputs=G.contentHash(G.creationEffectiveInputs?.(project,operationId,this.parameters)||{});this.state='idle';this.requestId=0;this.candidates=[];this.message='';}
  invalidate(message='参数已变化，请重新生成。'){this.requestId++;this.state='stale';this.message=message;this.candidates=[];}
  cancel(){this.requestId++;this.state='cancelled';this.candidates=[];}
  begin(){this.state='computing';this.message='';this.candidates=[];return ++this.requestId;}
  fail(error){this.state='failed';this.message=error.message;this.candidates=[];}
  ready(results,requestId=this.requestId){if(requestId!==this.requestId||this.state!=='computing')return false;
   this.candidates=results.map(result=>{const patch=candidatePatch(this.base,result.project),affectedTrackIds=result.trackIds||[...new Set(patch.map(c=>c.path[0]==='tracks'?c.path[1]?.id:null).filter(Boolean))];
    const refs=affectedTrackIds.flatMap(id=>result.project.tracks.find(t=>t.id===id)?.patterns.flatMap(p=>(p.generation?.sources||[]).map(ref=>({...ref,...(p.generation.settings.drumReferenceTrackId===ref.trackId?{roleMapHash:p.generation.settings.drumReferenceMapHash}:{})})))||[]);
    const dependencies=refs.filter(ref=>this.base.tracks.some(t=>t.id===ref.trackId)).map(ref=>({...ref,hash:G.dependencyHash(this.base,this.base.tracks.find(t=>t.id===ref.trackId),ref),...(ref.roleMapHash!==undefined?{roleMapHash:G.drumMappingHash(this.base,this.base.tracks.find(t=>t.id===ref.trackId))}:{})}));
    const t=result.project.tracks.find(t=>t.id===result.trackId),c=t?.clips.find(c=>c.id===result.clipId),p=t?.patterns.find(p=>p.id===c?.patternId);
    return {...result,candidateId:G.uid('candidate'),projectId:this.projectId,operationId:this.operationId,target:this.target,patch,dependencies,affectedTrackIds,outputRange:result.range|| (c&&p?[c.bar*G.BAR,(c.bar+p.bars)*G.BAR]:[0,result.project.bars*G.BAR])};});
   this.state=this.candidates.length?'ready':'idle';return true;
  }
  validate(current,candidate){if(this.state!=='ready'||!candidate)throw Error(this.message||'请先生成候选。');if(current.id!==this.projectId)throw Error('作品已切换，请重新生成。');if(targetFingerprint(current,this.target)!==this.relevantInputFingerprint)throw Error('目标内容已变化，请重新生成。');
   if(G.contentHash(G.creationEffectiveInputs?.(current,this.operationId,this.parameters)||{})!==this.effectiveInputs)throw Error('创作参考输入已变化，请重新生成。');
   for(const ref of candidate.dependencies){const track=current.tracks.find(t=>t.id===ref.trackId);if(!G.dependencyMatches(current,track,ref))throw Error('参考内容已变化，请重新生成。');}
  }
  materialize(current,index=0){const candidate=this.candidates[index];this.validate(current,candidate);return {...candidate,project:applyCandidatePatch(current,candidate.patch)};}
 }
 Object.assign(G,{CandidateSession,candidatePatch,applyCandidatePatch,targetFingerprint});
})(globalThis.GridTone ||= {});
