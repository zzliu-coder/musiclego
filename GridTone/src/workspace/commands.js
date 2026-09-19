/** One command vocabulary for the toolbar, contextual actions and shortcuts.
 * Pure commands return a document plus session updates; committing is the host's responsibility. */
(function(G){'use strict';
 const defs={
  cut:{label:'剪切',icon:'split',shortcut:'⌘ X',kinds:['notes','range','clips','track']},
  copy:{label:'复制',icon:'copy',shortcut:'⌘ C',kinds:['notes','range','clips','track']},
  paste:{label:'粘贴',icon:'file',shortcut:'⌘ V',kinds:['notes','range','clips','track']},
  duplicate:{label:'复制一份',icon:'copy',shortcut:'⌘ D',kinds:['notes','range','clips','track']},
  delete:{label:'删除',icon:'trash',shortcut:'Delete',kinds:['notes','range','clips','track']},
  'select-all':{label:'全选',icon:'select',shortcut:'⌘ A',kinds:['notes','range','clips']},
  unlink:{label:'转为独立',icon:'split',kinds:['clips']},
  linked:{label:'关联重复',icon:'link',kinds:['clips']},
  clear:{label:'清空音乐块内容',icon:'trash',kinds:['notes','range']},
 };
 const meaningful=a=>a.kind==='track'||a.kind==='range'||a.kind==='clips'&&a.ids.length||a.kind==='notes'&&a.ids.length;
 function commandState(project,s,id){
  const d=defs[id],a=G.resolveEditTarget(project,s);let reason='';
  if(!d)reason='未知操作';else if(s.view==='mix')reason='返回编排后编辑音乐';else if(!d.kinds.includes(a.kind))reason='先选择明确的操作对象';
  else if(id==='paste'){
   const c=s.editClipboard;if(!c)reason='先复制一段内容';
   else if(c.kind==='track'){if(project.tracks.length>=G.LIMITS.tracks)reason='已达到音轨数量上限';}
   else if(c.kind==='notes'||c.kind==='range'){
    if(!['notes','range'].includes(a.kind))reason='在音符画板点选粘贴位置';
    else if(c.trackKind!==a.track.kind)reason='鼓点与旋律需要分别粘贴到同类音轨';
   }else if(c.kind==='clips'&&!['clips','track'].includes(a.kind))reason='请在编排中指定音乐块的落点';
  }else if(['copy','cut','duplicate','delete'].includes(id)&&!meaningful(a))reason='没有选中内容';
  else if(['delete','cut'].includes(id)&&a.kind==='track'&&project.tracks.length===1)reason='至少保留一条音轨';
  else if(id==='unlink'&&(!a.items.length||!a.items.some(x=>x.track.clips.filter(c=>c.patternId===x.pattern.id).length>1)))reason='所选音乐块已相互独立';
  else if(id==='linked'&&!a.items.length)reason='先选择音乐块';
  else if(id==='clear'&&!a.pattern.notes.length)reason='音乐块已经为空';
  return {id,...d,...(G.keymap?.bindings[id]?{shortcut:G.keymap.label(id)}:{}),enabled:!reason,reason,target:G.editTargetData(a)};
 }
 function notesInRange(notes,start,end){return notes.filter(n=>n.start<end&&n.start+n.duration>start).map(n=>({...G.clone(n),start:Math.max(n.start,start)-start,duration:Math.min(n.start+n.duration,end)-Math.max(n.start,start)}));}
 function harmonyInRange(p,start,end){
  if(!p.harmony)return undefined;const events=p.harmony.events.flatMap(e=>{const a=Math.max(start,e.start),b=Math.min(end,e.start+e.duration);return b-a>=1?[{...G.clone(e),start:a-start,duration:b-a}]:[]});
  return events.length?{version:1,events,confirmedMusicHash:G.harmonyStatus(p)==='confirmed'?'pending':'stale:clipboard'}:undefined;
 }
 function captureClipboard(project,s,a){
  if(a.kind==='track')return {version:1,kind:'track',track:G.clone(a.track),assets:G.clone(project.assets),catalog:G.clone(project.catalog||{presets:[],drumkits:[]})};
  if(a.kind==='clips'){
   const from=Math.min(...a.items.map(x=>x.clip.bar));
   return {version:1,kind:'clips',span:Math.max(...a.items.map(x=>x.clip.bar+x.pattern.bars))-from,
    tracks:a.items.map(x=>({trackId:x.track.id,kind:x.track.kind,bar:x.clip.bar-from,pattern:G.clone(x.pattern),drumRows:x.track.kind==='drum'?G.clone(G.drumsFor(project,x.track)):undefined}))};
  }
  const ns=a.kind==='range'?a.pattern.notes:a.notes,start=a.kind==='range'?a.range.start:Math.min(...ns.map(n=>n.start)),end=a.kind==='range'?a.range.end:Math.max(...ns.map(n=>n.start+n.duration));
  return {version:1,kind:a.kind,trackKind:a.track.kind,span:end-start,notes:a.kind==='range'?notesInRange(ns,start,end):ns.map(n=>({...G.clone(n),start:n.start-start})),harmony:a.kind==='range'?harmonyInRange(a.pattern,start,end):undefined,drumRows:a.track.kind==='drum'?G.clone(G.drumsFor(project,a.track)):undefined};
 }
 function clipResources(project,clipboard){
  for(const [id,v]of Object.entries(clipboard.assets||{})){if(project.assets[id]&&JSON.stringify(project.assets[id])!==JSON.stringify(v))throw Error('采样编号冲突，请先导入原素材包。');project.assets[id]??=G.clone(v);}
  for(const type of ['presets','drumkits'])for(const v of clipboard.catalog?.[type]||[]){project.catalog||={presets:[],drumkits:[]};const old=project.catalog[type].find(x=>x.id===v.id);if(old&&JSON.stringify(old)!==JSON.stringify(v))throw Error('声音定义编号冲突。');if(!old)project.catalog[type].push(G.clone(v));}
 }
 function trimRange(p,start,end){
  const before=G.clone(p),out=[],ret=p.retention?.notes||[],newFlags=[];
  for(const n of p.notes){const stop=n.start+n.duration;if(stop<=start||n.start>=end){out.push(n);continue;}
   if(n.start<start)out.push({...n,duration:start-n.start});
   if(stop>end){const id=n.start<start?G.uid('n'):n.id;out.push({...n,id,performanceKey:n.performanceKey||n.id,start:end,duration:stop-end});const r=ret.find(x=>x.id===n.id);if(r&&id!==n.id)newFlags.push({...r,id});}
  }
  p.notes=out;
  if(p.retention){p.retention.notes=ret.concat(newFlags).filter(r=>out.some(n=>n.id===r.id));p.retention.ranges=p.retention.ranges.flatMap(r=>{const parts=[];if(r.start<start&&Math.min(r.end,start)>r.start)parts.push({start:r.start,end:Math.min(r.end,start)});if(r.end>end&&r.end>Math.max(end,r.start))parts.push({start:Math.max(end,r.start),end:r.end});return parts;});}
  G.mergePlacedHarmony(before,p,{bars:(end-start)/G.BAR},start,end);delete p.generation;return p;
 }
 function pasteInto(project,s,a,c,duplicate=false){
  const patch={};
  if(c.kind==='track'){
   if(project.tracks.length>=G.LIMITS.tracks)throw Error('最多支持64条音轨。');clipResources(project,c);
   const source=G.clone(c.track),oldId=source.id;source.id=G.uid('t');source.name+=' · 副本';const map=new Map();
   source.patterns=source.patterns.map(p=>{const out=G.copyPattern(p);out.name=p.name;map.set(p.id,out.id);return out;});
   source.clips=source.clips.map(c=>({...c,id:G.uid('c'),patternId:map.get(c.patternId)}));
   for(const p of source.patterns)for(const ref of p.generation?.sources||[])if(ref.trackId===oldId)ref.trackId=source.id;
   const at=project.tracks.findIndex(t=>t.id===a.trackId);project.tracks.splice(at<0?project.tracks.length:at+1,0,source);
   project.bars=Math.max(project.bars,...source.clips.map(c=>c.bar+source.patterns.find(p=>p.id===c.patternId).bars));
   patch.editTarget={kind:'track',trackId:source.id};patch.inspectorTrackId=source.id;return patch;
  }
  if(c.kind==='clips'){
   const base=duplicate?Math.max(...a.items.map(x=>x.clip.bar+x.pattern.bars)):Math.floor((s.arrangeCursor?.tick||0)/G.BAR);
   if(base+c.span>G.LIMITS.bars)throw Error('粘贴后超过256小节。');project.bars=Math.max(project.bars,base+c.span);
   const sourceTracks=[...new Set(c.tracks.map(x=>x.trackId))],destId=s.arrangeCursor?.trackId||a.trackId,ids=[];
   for(const item of c.tracks){const t=project.tracks.find(t=>t.id===(duplicate?item.trackId:sourceTracks.length===1?destId:item.trackId));if(!t)throw Error('多轨素材的原轨道已不存在，请分别粘贴。');if(t.kind!==item.kind)throw Error('音乐块需要同类型音轨。');
    const p=G.copyPattern(item.pattern);if(t.kind==='drum')p.notes=G.remapDrums(p.notes,item.drumRows,G.drumsFor(project,t));
    const bar=base+item.bar;if(!G.canPlace(t,p,bar,project.bars))throw Error('目标位置已有音乐块，请另选空位。');t.patterns.push(p);const clip={id:G.uid('c'),bar,patternId:p.id};t.clips.push(clip);ids.push(clip.id);
   }
   const first=G.clipSelection(project,ids)[0];Object.assign(patch,{clipIds:ids,editTarget:{kind:'clips',trackId:first.track.id,ids},trackId:first.track.id,patternId:first.pattern.id,clipId:first.clip.id});return patch;
  }
  if(!['notes','range'].includes(a.kind))throw Error('在音符画板指定粘贴位置。');
  const t=project.tracks.find(t=>t.id===a.trackId),p=t.patterns.find(p=>p.id===a.patternId);
  const start=duplicate?(a.kind==='range'?a.range.end:Math.max(...a.notes.map(n=>n.start+n.duration))):(a.kind==='range'?a.range.start:s.cursor||0),end=start+c.span;
  if(start<0||end>p.bars*G.BAR)throw Error('粘贴位置超出音乐块，请扩展长度或移动编辑落点。');
  let incoming=c.notes.map(n=>({...G.clone(n),id:G.uid('n'),performanceKey:n.performanceKey||n.id,start:n.start+start}));
  if(t.kind==='drum')incoming=G.remapDrums(incoming,c.drumRows,G.drumsFor(project,t));
  const before=G.clone(p);
  if(c.kind==='range'){
   const occupied=p.notes.some(n=>n.start<end&&n.start+n.duration>start);
   if(occupied&&a.kind!=='range')throw Error('时间范围中已有内容，请明确选中替换范围，或粘贴到空位。');
   if(a.kind==='range'&&a.range.end-a.range.start<c.span)throw Error('所选范围比复制内容短。');
   trimRange(p,start,end);p.notes.push(...incoming);G.mergePlacedHarmony(before,p,{bars:c.span/G.BAR,harmony:c.harmony},start,end);
  }else p.notes.push(...incoming);
  patch.cursor=start;patch.selected=incoming.map(n=>n.id);patch.noteRange=null;patch.editTarget={kind:'notes',trackId:t.id,patternId:p.id,clipId:a.clipId,ids:patch.selected};return patch;
 }
 /** Quantization is an explicit note edit; changing the visible grid alone never applies it. */
 function quantizeStarts(notes,step,length,range=null){
  if(!Number.isFinite(step)||step<=0)throw Error('先选择一个吸附网格，再对齐音符起点。');
  return notes.map(n=>{const start=Math.round(n.start/step)*step;
   if(start<0||start+n.duration>length||range&&(start<range.start||start+n.duration>range.end))throw Error('对齐后会超出编辑范围，原内容保持不变。');
   return {...n,start};
  });
 }
 function performEditCommand(project,s,id){
  const state=commandState(project,s,id);if(!state.enabled)throw Error(state.reason);
  const a=G.resolveEditTarget(project,s),patch={},p=G.clone(project);
  if(id==='cut'){const clipboard=captureClipboard(project,s,a);const result=performEditCommand(project,s,'delete');return {...result,patch:{...result.patch,editClipboard:clipboard},message:'已剪切，可在本工作台粘贴或撤销'};}
  if(id==='copy')return {document:project,patch:{editClipboard:captureClipboard(project,s,a)},changed:false,message:'已复制'+(a.kind==='range'?'时间范围（含休止）':'选中内容')};
  if(id==='select-all'){
   if(a.kind==='notes'||a.kind==='range'){patch.selected=a.pattern.notes.map(n=>n.id);patch.noteRange=null;patch.editTarget={kind:'notes',trackId:a.trackId,patternId:a.patternId,clipId:a.clipId,ids:patch.selected};}
   else{patch.clipIds=project.tracks.flatMap(t=>t.clips.map(c=>c.id));patch.editTarget={kind:'clips',trackId:a.trackId,ids:patch.clipIds};}
   return {document:project,patch,changed:false};
  }
  if(id==='paste'||id==='duplicate')Object.assign(patch,pasteInto(p,s,a,id==='duplicate'?captureClipboard(project,s,a):s.editClipboard,id==='duplicate'));
  else if(id==='delete'){
   if(a.kind==='track'){p.tracks=p.tracks.filter(t=>t.id!==a.trackId);patch.editTarget={kind:'none'};patch.inspectorTrackId=null;if(s.trackId===a.trackId)patch.editorOpen=false;}
   else if(a.kind==='clips'){
    p.tracks.forEach(t=>t.clips=t.clips.filter(c=>!a.ids.includes(c.id)));patch.clipIds=[];patch.editTarget={kind:'clips',trackId:a.trackId,ids:[]};
    if(a.ids.includes(s.clipId)){patch.clipId=null;patch.editorOpen=false;patch.selected=[];}
   }else{const pat=p.tracks.find(t=>t.id===a.trackId).patterns.find(p=>p.id===a.patternId);
    if(a.kind==='range')trimRange(pat,a.range.start,a.range.end);else pat.notes=pat.notes.filter(n=>!a.ids.includes(n.id));
    if(pat.retention)pat.retention.notes=pat.retention.notes.filter(r=>pat.notes.some(n=>n.id===r.id));
    patch.selected=[];patch.editTarget=a.kind==='range'?G.editTargetData(a):{...G.editTargetData(a),ids:[]};
   }
  }else if(id==='clear'){
   const pat=p.tracks.find(t=>t.id===a.trackId).patterns.find(p=>p.id===a.patternId);pat.notes=[];delete pat.harmony;delete pat.retention;delete pat.generation;patch.selected=[];patch.noteRange=null;patch.editTarget={kind:'notes',trackId:a.trackId,patternId:a.patternId,clipId:a.clipId,ids:[]};
  }else if(id==='unlink'){
   for(const x of a.items){const t=p.tracks.find(t=>t.id===x.track.id),c=t.clips.find(c=>c.id===x.clip.id);if(t.clips.filter(v=>v.patternId===c.patternId).length<=1)continue;const cp=G.copyPattern(t.patterns.find(v=>v.id===c.patternId));t.patterns.push(cp);c.patternId=cp.id;if(c.id===s.clipId)patch.patternId=cp.id;}
  }else if(id==='linked'){
   const from=Math.min(...a.items.map(x=>x.clip.bar)),base=Math.max(...a.items.map(x=>x.clip.bar+x.pattern.bars)),ids=[];
   const length=Math.max(...a.items.map(x=>x.clip.bar+x.pattern.bars))-from;if(base+length>G.LIMITS.bars)throw Error('关联重复超过256小节。');p.bars=Math.max(p.bars,base+length);
   for(const x of a.items){const t=p.tracks.find(t=>t.id===x.track.id),bar=base+x.clip.bar-from;if(!G.canPlace(t,x.pattern,bar,p.bars))throw Error('关联重复的位置被占用。');const c={id:G.uid('c'),patternId:x.pattern.id,bar};t.clips.push(c);ids.push(c.id);}
   patch.clipIds=ids;patch.editTarget={kind:'clips',trackId:a.trackId,ids};const first=G.clipSelection(p,ids)[0];Object.assign(patch,{trackId:first.track.id,patternId:first.pattern.id,clipId:first.clip.id});
  }
  for(const t of p.tracks)for(const pat of t.patterns)if(pat.retention)pat.retention.notes=pat.retention.notes.filter(r=>pat.notes.some(n=>n.id===r.id));
  return {document:G.validateProject(p),patch,changed:JSON.stringify(p)!==JSON.stringify(project),message:defs[id].label+'完成'};
 }
 Object.assign(G,{quantizeStarts,EDIT_COMMANDS:Object.freeze(defs),editCommandState:commandState,performEditCommand,captureEditClipboard:captureClipboard,trimPatternRange:trimRange});
})(globalThis.GridTone ||= {});
