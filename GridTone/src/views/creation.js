/** One disposable candidate session for recipes, notes, ensemble and arrangement. */
(function(G){'use strict';
 const LABELS=G.ui.operationLabels;
 class CreationUI{
  constructor(context){this.c=context;this.session=null;}
  open(mode){
   this.session?.flow?.cancel();this.c.playback.endAudition();this.c.closeModal?.();
   const p=this.c.getProject(),s=this.c.getSession(),t=p.tracks.find(t=>t.id===s.trackId)||p.tracks[0],c=t.clips.find(c=>c.id===s.clipId)||t.clips.find(c=>c.patternId===s.patternId),pat=t.patterns.find(x=>x.id===c?.patternId)||t.patterns.find(x=>x.id===s.patternId)||t.patterns[0];
   mode??=t.kind==='drum'?'drums':t.role==='bass'?'bass':'generate';
   const sources=p.tracks.filter(t=>t.patterns.some(p=>p.harmony));
   this.session={base:G.clone(p),token:G.contentHash(p),target:{trackId:t.id,clipId:c?.id},patternId:pat.id,mode,sourceTrackId:sources.filter(v=>v.id!==t.id).length===1?sources.find(v=>v.id!==t.id).id:'',referenceTrackId:'',seed:42,low:t.role==='bass'?36:60,high:t.role==='bass'?55:84,start:0,end:Math.min(pat.bars,8)*G.BAR,bar:mode==='arrange'?p.bars:0,bars:mode==='ensemble'?pat.bars:8,sourceBar:c?.bar||0,strategy:mode==='arrange'?'variation':mode==='bass'?'align':'support',rhythmTemplateId:'',color:'none',intent:'loop',drumRole:'closedHat',drumStyle:'straight',velocityStyle:'balanced',textureStyle:'sustain',density:'normal',recipeId:G.RECIPES[0].id,tempo:false,retention:G.clone(pat.retention||{notes:[],ranges:[]}),selected:[...s.selected],parameterDrafts:{},candidates:[],chosen:0,message:''};this.render();
  }
  current(){
   const x=this.session;if(!x)return {};
   const local=G.CREATION_OPERATIONS[x.mode].scope==='instance';
   const t=x.base.tracks.find(t=>t.id===x.target.trackId)||(!local?x.base.tracks[0]:null);
   const p=t?.patterns.find(p=>p.id===x.patternId)||(!local?t?.patterns[0]:null);
   return {x,t,p};
  }
  fresh(){const x=this.session;if(!x||x.token!==G.contentHash(x.base))throw Error('原稿或参考内容已变化，请重新做几版。');if(this.c.getProject().id!==x.base.id)throw Error('作品已切换，请重新生成。');if(x.flow?.state==='ready')x.flow.validate(this.c.getProject(),x.candidates[x.chosen]);}
  close(){this.session?.flow?.cancel();this.session=null;this.c.playback.endAudition();this.c.closeCreation?.('creation');}
  refresh(){
   if(!this.session)return;const x=this.session,current=this.c.getProject();
   if(current.id!==x.base.id){this.close();return;}
   if(x.flow?.state==='applying')return;
   const local=G.CREATION_OPERATIONS[x.mode].scope==='instance';
   const track=current.tracks.find(t=>t.id===x.target.trackId),clip=track?.clips.find(c=>c.id===x.target.clipId);
   if(local&&(!track||!track.patterns.some(p=>p.id===x.patternId)||(x.target.clipId&&!clip))){
    this.close();this.c.toast('生成目标已删除，请选择另一个音乐块。');return;
   }
   try{if(x.flow?.state==='ready')x.flow.materialize(current,x.chosen);}
   catch(e){x.flow.invalidate(e.message);x.candidates=[];x.message=e.message;this.c.playback.endAudition();}
   const selection=this.c.getSession();
   if(selection.trackId===x.target.trackId&&selection.clipId===x.target.clipId)x.selected=[...selection.selected];
   if(x.flow?.state!=='ready'){
    if(!x.sourceTrackId&&!x.sourceManuallyChosen&&G.CREATION_OPERATIONS[x.mode].requiredInputs.includes('harmony')){const sources=current.tracks.filter(t=>t.id!==x.target.trackId&&t.patterns.some(p=>p.harmony));if(sources.length===1)x.sourceTrackId=sources[0].id;}
    x.base=G.clone(current);x.token=G.contentHash(x.base);
    if(!local){const anchor=track||current.tracks[0];x.target={trackId:anchor.id,clipId:anchor.clips[0]?.id};x.patternId=anchor.patterns[0].id;}
    else if(clip)x.patternId=clip.patternId;
   }
   this.render();
  }
  prerequisites(){
   const {x,t,p}=this.current();if(!x||!t||!p)return '目标内容已不存在，请重新选择音乐块。';
   const op=G.CREATION_OPERATIONS[x.mode];
   if(Object.keys(x.fieldErrors||{}).length)return Object.values(x.fieldErrors)[0];
   if(op.scope==='instance'&&(x.start<0||x.end<=x.start||x.end>p.bars*G.BAR))return '请选择音乐块以内的范围，终点要晚于起点。';
   if(op.scope==='instance'&&t.kind!=='drum'&&x.low>x.high)return '最低音需要低于或等于最高音。';
   if(op.scope==='instance'&&!x.target.clipId)return '先把这个音乐块放进编排，再围绕它做变化。';
   if(['generate','rhythm','anchors','ending','answer'].includes(x.mode)&&![4,8,16].includes(p.bars))return '旋律生成需要 4 或 8 小节的范围。当前音乐块仍可手绘或套用模板。';
   if(['generate','rhythm','anchors','ending','answer'].includes(x.mode)&&![4,8].includes((x.end-x.start)/G.BAR))return '请选择连续 4 或 8 小节来生成；当前音乐块保持原样。';
   if(op.requiredInputs.includes('harmony')&&op.scope==='instance'){
    if(!x.sourceTrackId)return '先选一段和弦，旋律和低音就有了落点。';
    try{G.resolveHarmony(this.c.getProject(),{...x.target,sourceTrackId:x.sourceTrackId,start:x.start,end:x.end});}catch(e){return e.message;}
   }
   return '';
  }
  projection(){
   const x=this.session;if(!x||x.flow?.state!=='ready'||G.CREATION_OPERATIONS[x.mode].scope!=='instance'||x.overlay==='original')return null;
   const ss=this.c.getSession();if(ss.rightPanel!=='creation'||ss.trackId!==x.target.trackId||ss.clipId!==x.target.clipId)return null;
   try{const r=x.flow.materialize(this.c.getProject(),x.chosen),t=r.project.tracks.find(t=>t.id===r.trackId),p=t?.patterns.find(p=>p.id===r.patternId),original=this.c.getProject().tracks.find(t=>t.id===x.target.trackId)?.patterns.find(p=>p.id===x.patternId);if(!p||!original)return null;return {notes:p.notes,original:original.notes,retention:p.retention||x.retention,name:LABELS[x.mode],index:x.chosen,range:[x.start,x.end]};}catch{return null;}
  }
  render(){
   if(!this.session)return;
   const {x,t,p}=this.current(),{button,esc}=this.c,U=G.ui,F=U.format,op=G.CREATION_OPERATIONS[x.mode],instance=op.scope==='instance',melody=['generate','rhythm','anchors','ending','answer'].includes(x.mode);
   const select=(name,items,value)=>`<select data-field="creation-${name}" aria-label="${esc(U.fieldLabels[name]||name)}">${items.map(([v,l])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
   const number=(name,label,value,min,max)=>U.Field({field:'creation-'+name,label,value,type:'number',min,max});
   const sources=x.base.tracks.filter(t=>t.patterns.some(p=>p.harmony)),source=sources.find(t=>t.id===x.sourceTrackId),candidate=x.candidates[x.chosen],selected=this.c.getSession(),wrongTarget=instance&&(selected.trackId!==x.target.trackId||selected.clipId!==x.target.clipId);
   const choices=Object.entries(LABELS).filter(([id])=>id===x.mode||instance&&G.CREATION_OPERATIONS[id].scope==='instance'&&(t.kind==='drum'?id==='drums':t.role==='bass'?id==='bass':['texture','chords'].includes(t.role)?id==='accompaniment':['generate','rhythm','anchors','ending','answer'].includes(id)));
   const primaryChoices=choices.filter(([id])=>['generate','rhythm','ending'].includes(id)||id===x.mode);
   const captureOpen=id=>document.querySelector('#'+id)?.open||false;
   const prerequisite=this.prerequisites(),unsupported=melody&&![4,8,16].includes(p.bars);
   let settings='',advanced='',results='',actions='';
   const tasks=choices.length>1?`<div class="task-picker" role="group" aria-label="选择音乐变化">${primaryChoices.map(([id,label])=>`<button type="button" class="task-choice" data-action="creation-mode-choice" data-mode="${id}" aria-pressed="${x.mode===id}">${U.icon(id==='ending'?'arrow':id==='rhythm'?'wave':'melody',16)}<strong>${esc(label)}</strong></button>`).join('')}</div><details id="creation-all-modes" ${captureOpen('creation-all-modes')?'open':''}><summary>更多变化</summary><label>这次做什么${select('mode',choices,x.mode)}</label></details>`:'';
   if(op.requiredInputs.includes('harmony')&&instance)settings+=`<label>跟随哪段和弦${select('sourceTrackId',[['','选择一条和弦轨道'],...sources.filter(v=>v.id!==t.id).map(v=>[v.id,v.name])],x.sourceTrackId)}</label>`;
   if(op.parameters.includes('density')&&(!melody||!x.rhythmTemplateId))settings+=`<label>音符多少${select('density',[['sparse','少一点 · 留些空白'],['normal','适中'],['dense','多一点 · 连续流动']],x.density)}</label>`;
   if(x.mode==='recipe')settings+=`<label>组合模板${select('recipeId',G.RECIPES.map(r=>[r.id,r.name]),x.recipeId)}</label><p class="field-note">${esc(G.RECIPES.find(r=>r.id===x.recipeId).description)}</p>${number('bar','从第几小节放入',x.bar+1,1,256)}${U.Toggle({field:'creation-tempo',label:'采用模板速度与 Swing · 全曲',checked:x.tempo})}`;
   if(x.mode==='arrange')settings+=`<div class="form-grid">${number('bar','放到第几小节',x.bar+1,1,256)}${number('sourceBar','材料从第几小节起',x.sourceBar+1,1,256)}</div><label>发展长度${select('bars',[[8,'8 小节'],[16,'16 小节']],x.bars)}</label><label>组织方式${select('strategy',[['variation','主题 → 变化 → 结尾'],['entry','先伴奏，后旋律'],['repeat','关联重复']],x.strategy)}</label><p class="field-note">优先使用已选音乐块，保留它们之间的位置关系。</p>`;
   if(x.mode==='ensemble')settings+=`${number('sourceBar','从第几小节开始',x.sourceBar+1,1,256)}<label>变化范围${select('bars',G.PATTERN_BARS.map(n=>[n,n+' 小节']),x.bars)}</label><p class="field-note">先准备鼓点，再让贝斯和伴奏跟随；各声部使用自己的音域。</p>`;
   if(x.mode==='mix')settings+=U.InlineNotice({title:'先比较，再决定',text:'为已指定角色的轨道准备音量和左右位置；音符与音色保持。'});
   if(['bass','accompaniment'].includes(x.mode))settings+=`<label>配合哪条声部${select('referenceTrackId',[['','仅跟随和弦'],...x.base.tracks.filter(v=>v.id!==t.id&&(x.mode==='bass'?v.kind==='drum':v.role==='melody')).map(v=>[v.id,v.name])],x.referenceTrackId)}</label><label>配合方式${select('strategy',x.mode==='bass'?[['align','与底鼓一起发力'],['answer','呼应底鼓']]:[['support','承托，给旋律留空间'],['answer','在空白处回答'],['together','同拍加强']],x.strategy)}</label>`;
   if(x.mode==='accompaniment')settings+=`<label>怎么弹${select('textureStyle',[['sustain','长音铺底'],['pulse','一拍一弹'],['arp','分解流动']],x.textureStyle)}</label>`;
   if(x.mode==='drums')settings+=`<label>基础节奏${select('drumStyle',[['straight','直拍'],['half','半拍'],['four','四拍底鼓']],x.drumStyle)}</label><label>力度${select('velocityStyle',[['soft','轻柔'],['balanced','均衡'],['punch','有力']],x.velocityStyle)}</label><label>主要改变哪个鼓件${select('drumRole',[...G.drumMap(x.base,t)].map(([r])=>[r,({kick:'底鼓',snare:'军鼓',closedHat:'闭镲',openHat:'开镲',clap:'拍手',tom:'通鼓',crash:'吊镲',rim:'边击'})[r]||r]),x.drumRole)}</label>${U.Toggle({field:'creation-lastBeat',label:'只改最后一拍',checked:x.lastBeat})}`;
   if(instance)advanced+=`<p class="field-note">位置写作“小节.拍”，如 2.3；末端位置不包含在选区内。</p><div class="form-grid">${U.Field({field:'creation-start',label:'起点 · 小节.拍',value:x.positionDrafts?.start??F.position(x.start)})}${U.Field({field:'creation-end',label:'终点 · 不含',value:x.positionDrafts?.end??F.position(x.end)})}</div>`;
   if(instance&&x.mode!=='drums')advanced+=`<h3>音域</h3><p class="field-note">当前建议 ${G.noteName(x.low)}—${G.noteName(x.high)}，可按需要调整。</p><div class="form-grid"><label>最低音${select('low',Array.from({length:128},(_,n)=>[n,G.noteName(n)]),x.low)}</label><label>最高音${select('high',Array.from({length:128},(_,n)=>[n,G.noteName(n)]),x.high)}</label></div>`;
   if(op.parameters.includes('rhythmTemplateId'))advanced+=`<label>节奏起点${select('rhythmTemplateId',[['','根据音符多少来安排'],...G.RECIPES.map(r=>['rhythm.'+r.id,r.name+' · 节奏']),...G.catalogTemplates().filter(v=>v.type==='pattern'&&v.kind==='melodic').map(v=>[v.id,v.name])],x.rhythmTemplateId)}</label>`;
   if(op.parameters.includes('intent'))advanced+=`<label>句尾走向${select('intent',[['loop','接回开头，继续循环'],['ending','停下来，收个结尾']],x.intent)}</label>`;
   if(op.parameters.includes('color'))advanced+=`<label>音与音怎么连接${select('color',[['none','紧贴和弦'],['diatonic','加入调内经过音'],['chromatic','半音靠近下一个落点']],x.color)}</label>`;
   if(op.random)advanced+=number('seed','随机种子 · 复现这一版',x.seed,0,4294967295);
   if(instance&&t.kind!=='drum')advanced+=button('harmony-editor',source?'复核参考和弦':'标注本块和弦','piano','quiet small-btn');
   const rangeIssue=Object.keys(x.fieldErrors||{}).length||instance&&(x.start<0||x.end<=x.start||x.end>p.bars*G.BAR||x.low>x.high)||melody&&!unsupported&&![4,8].includes((x.end-x.start)/G.BAR);
   let blocked='';if(prerequisite){blocked=U.InlineNotice({tone:'warning',title:rangeIssue?'检查调整范围':'还需要一点材料',text:prerequisite,actions:rangeIssue?button('creation-open-options','调整范围与细节','grid','soft-btn'):unsupported?button('creation-new-four','新建 4 小节音乐块','plus','soft-btn'):button('creation-pick-chords','选择和弦模板','chord','soft-btn')+(source?button('harmony-editor','复核和弦','piano','quiet'):'')});}
   if(candidate){
    const tr=candidate.project.tracks.find(t=>t.id===candidate.trackId),pat=tr?.patterns.find(p=>p.id===candidate.patternId),diff=pat?U.projectionDiff(p.notes,pat.notes,pat.retention||x.retention):null;
    const allPitches=x.candidates.flatMap(r=>r.project.tracks.find(t=>t.id===r.trackId)?.patterns.find(p=>p.id===r.patternId)?.notes.map(n=>n.pitch)||[]).concat(p.notes.map(n=>n.pitch));const bounds={bars:pat?.bars||p.bars,low:Math.min(48,...allPitches),high:Math.max(72,...allPitches)};
    let drawing=pat?U.NotePreview(pat.notes,bounds):'',stats=pat?`${pat.notes.length} 个音符 · ${diff.unchanged} 个保持 · ${diff.changed} 个新增或变化`:'';
    if(['recipe','arrange','ensemble'].includes(x.mode)){const model=U.musicBlock.rangeModel(candidate.project,candidate.affectedTrackIds,candidate.outputRange,LABELS[x.mode]);drawing=U.musicBlock.drawing(model,320,Math.max(60,model.tracks.length*12));stats=`本次调整 ${model.tracks.length} 条音轨 · ${F.range(...candidate.outputRange)}`;}
    if(x.mode==='mix'){drawing='<table class="mix-candidate-changes"><thead><tr><th>音轨</th><th>音量</th><th>左右位置</th></tr></thead><tbody>'+candidate.project.tracks.map(tr=>{const old=x.base.tracks.find(v=>v.id===tr.id);return old&&(old.volume!==tr.volume||old.pan!==tr.pan)?`<tr><th>${esc(tr.name)}</th><td>${F.percent(old.volume)} → ${F.percent(tr.volume)}</td><td>${F.pan(old.pan)} → ${F.pan(tr.pan)}</td></tr>`:'';}).join('')+'</tbody></table>';stats='仅改变音量和左右位置';}
    actions=`${U.PreviewControls({actions:button('creation-preview','连伴奏听','headphones','soft-btn')+button('creation-preview-solo',instance?'只听这一轨':'只听方案声部','play','quiet small-btn')+button('creation-preview-original','听原稿','','quiet small-btn')+button('stop','停止','stop','quiet small-btn'),context:'方案和原稿使用相同的音乐范围。'})}<div class="candidate-commit">${button('creation-apply','用这版','check','dark-btn',wrongTarget?'disabled title="请先回到原来的音乐块"':'')}${button('creation-generate',op.random?'再来一组':'重新计算','spark','quiet')}</div>`;
    results=`<section class="candidate-bar" data-component="candidate" data-phase="compare"><header><strong>挑一版，听听看</strong><small>尚未写入作品</small></header>${U.SegmentedControl({label:'方案版本',action:'creation-choose',attribute:'index',value:x.chosen,items:x.candidates.map((_,i)=>[i,'方案 '+(i+1)])})}<div class="candidate-preview">${drawing}</div><p class="candidate-stats">${stats}</p>${instance?`<div class="candidate-preview-mode"><span>画板对照</span>${button('creation-overlay','方案','layers','small-btn '+(x.overlay==='original'?'quiet':'active'),'data-overlay="candidate"')}${button('creation-overlay','原稿','','small-btn '+(x.overlay==='original'?'active':'quiet'),'data-overlay="original"')}${button('creation-fit','看全方案','grid','quiet small-btn')}</div>`:''}</section>`;
   }
   const status=wrongTarget?U.InlineNotice({tone:'warning',title:'方案留在原来的音乐块',text:'当前选择已经改变；先回到原目标，再采用这版。',actions:button('creation-return','回到原音乐块','arrow','soft-btn')}):(!candidate&&x.message&&!prerequisite?U.InlineNotice({tone:x.flow?.state==='failed'?'error':'info',title:x.flow?.state==='stale'?'设置有变化':x.flow?.state==='failed'?'这次没有生成':'当前状态',text:x.message}):'');
   const keep=instance?`<details class="retention-controls" ${document.querySelector('.retention-controls')?.open?'open':''}><summary>生成时保留 · ${x.retention.notes.length} 音 / ${x.retention.ranges.length} 范围</summary><p class="retention-summary">选中 ${x.selected.length} 个音符。这里只约束生成，手动编辑始终可用。</p><div class="retention-actions">${[['pitch','保留音高'],['rhythm','保留节奏'],['all','全部保留'],['clear','解除音符保留'],['range','保留范围与休止'],['clear-ranges','解除范围保留']].map(([v,l])=>button('creation-keep',l,v==='clear'||v==='clear-ranges'?'close':'lock','quiet small-btn',`data-keep="${v}" ${!['range','clear-ranges'].includes(v)&&!x.selected.length?'disabled title="先在画板选中音符"':''}`)).join('')}</div>${button('creation-save-keeps','保存保留设置','save','soft-btn small-btn')}</details>`:'';
   let insights='';if(x.selected.length&&x.sourceTrackId){try{const h=G.resolveHarmony(x.base,{...x.target,sourceTrackId:x.sourceTrackId,start:x.start,end:x.end});insights=`<div class="note-explanations"><h3>这些音的作用</h3>${p.notes.filter(n=>x.selected.includes(n.id)).slice(0,4).map(n=>{const a=G.explainNote(n,h,h.targetTranspose,p.notes);return `<p><strong>${G.noteName(n.pitch)} · ${esc(a.role)}</strong><br>${esc(a.reason)}</p>`;}).join('')}<small>以上是音乐建议；保留项由你决定。</small></div>`;}catch{}}
   const context=U.ContextCard({name:instance?t.name+' · '+p.name:'整首作品',range:instance?'块内 '+F.range(x.start,x.end)+(t.clips.find(c=>c.id===x.target.clipId)?.bar?' · 位于作品第 '+(t.clips.find(c=>c.id===x.target.clipId).bar+1)+' 小节':''):x.mode==='arrange'?F.range(x.bar*G.BAR,(x.bar+x.bars)*G.BAR):'确认后一次写入，可撤销',source:op.requiredInputs.includes('harmony')?source?.name:undefined,retained:x.retention.notes.length});
   const setup=`${tasks}<div class="creation-settings">${settings}</div>`;
   const quickKeep=instance&&x.selected.length?`<div class="quick-retention"><span>生成时保留选中的 ${x.selected.length} 音</span><div class="button-row">${[['pitch','音高'],['rhythm','节奏'],['all','全部']].map(([id,label])=>button('creation-keep',label,'lock','quiet small-btn',`data-keep="${id}"`)).join('')}</div></div>`:'';
   if(!candidate)actions=`<div class="creation-generate-row">${button('creation-generate',op.random?'做几版':'准备方案','spark','dark-btn',prerequisite?'disabled title="先补齐上方材料"':'')}</div>`;
   const body=`<div class="creation-target-contract" data-phase="${candidate?'compare':x.flow?.state||'prepare'}">${context}${quickKeep}${status}${results}${candidate?`<details id="creation-tuning" ${captureOpen('creation-tuning')?'open':''}><summary>调整方法与参数</summary>${setup}</details>`:setup+blocked+''}<p id="creation-feedback" role="status"></p>${advanced?`<details id="creation-options" ${captureOpen('creation-options')?'open':''}><summary>范围与细节${instance&&x.mode!=='drums'?' · '+G.noteName(x.low)+'—'+G.noteName(x.high):''}</summary>${advanced}</details>`:''}${keep}${insights}</div>`;
   (this.c.openCreation||this.c.openModal)(LABELS[x.mode],this.c.openCreation?{body,actions}:body+actions,'基于现有音乐做变化 · 采用前原稿保持');this.c.updateProjection?.();
  }
  generate(){
   const x=this.session;if(!x||this.c.getProject().id!==x.base.id)throw Error('作品已切换，请重新选择目标。');x.base=G.clone(this.c.getProject());const local=G.CREATION_OPERATIONS[x.mode].scope==='instance',t=x.base.tracks.find(t=>t.id===x.target.trackId)||(!local?x.base.tracks[0]:null),clip=t?.clips.find(c=>c.id===x.target.clipId);if(!t)throw Error('目标轨道已删除。');x.patternId=clip?.patternId||x.patternId;const p=t.patterns.find(p=>p.id===x.patternId)||(!local?t.patterns[0]:null);if(!p)throw Error('目标音乐块已删除。');if(!local){x.target={trackId:t.id,clipId:t.clips[0]?.id};x.patternId=p.id;}x.retention.notes=x.retention.notes.filter(n=>p.notes.some(v=>v.id===n.id));x.token=G.contentHash(x.base);x.candidates=[];x.message='';const operation=G.CREATION_OPERATIONS[x.mode];if(operation.scope==='instance'&&!x.target.clipId)throw Error('请先把当前音乐块放入编排，再生成。');const parameters=G.creationParameters(x.mode,x);x.flow=new G.CandidateSession(x.base,x.mode,operation.scope==='instance'?x.target:{},parameters);x.flow.begin();
   if(x.mode==='recipe')x.candidates=[G.applyRecipe(x.base,x.recipeId,{bar:x.bar,key:x.base.key,seed:x.seed,tempo:x.tempo})];
   else if(x.mode==='arrange'||x.mode==='mix'){const project=x.mode==='arrange'?G.arrangeSections(x.base,{bar:x.bar,bars:x.bars,sourceBar:x.sourceBar,style:x.strategy,clipIds:this.c.getSession().clipIds}):G.suggestedMix(x.base);const oldIds=new Set(x.base.tracks.flatMap(t=>t.clips.map(c=>c.id))),added=project.tracks.flatMap(tr=>tr.clips.filter(c=>!oldIds.has(c.id)).map(c=>({trackId:tr.id,patternId:c.patternId,clipId:c.id})));x.candidates=[{project,...(added[0]||{trackId:t.id,patternId:p.id,clipId:x.target.clipId}),trackIds:x.mode==='arrange'?[...new Set(added.map(c=>c.trackId))]:project.tracks.map(t=>t.id),range:x.mode==='arrange'?[x.bar*G.BAR,(x.bar+x.bars)*G.BAR]:[0,project.bars*G.BAR]}];}
   else{
    const base=G.clone(x.base),pat=base.tracks.find(v=>v.id===t.id).patterns.find(v=>v.id===p.id);pat.retention=G.clone(x.retention);
    let candidates;
    if(x.mode==='ensemble'){
     x.candidates=[G.generateEnsembleGroup(base,{...parameters,bars:x.bars,melodyTrackId:t.role==='melody'?t.id:undefined},x.seed)];x.flow.ready(x.candidates);x.candidates=x.flow.candidates;x.chosen=0;this.render();return;
    }
    if(['drums','bass','accompaniment'].includes(x.mode))candidates=[G.generateEnsemble(base,x.target,parameters,x.seed)];
    else{const harmony=G.resolveHarmony(base,{...x.target,sourceTrackId:x.sourceTrackId,start:x.start,end:x.end});const result=G.generateMelody({harmony,notes:p.notes,retention:x.retention,key:base.key,scale:base.scale},{...parameters,...(parameters.rhythmTemplateId?{rhythmTemplate:G.resolveRhythmTemplate(parameters.rhythmTemplateId)}:{})},x.seed);candidates=result.candidates;x.message=result.message;}
    x.candidates=candidates.map(c=>G.applyGenerated(base,x.target,c));
   }
   x.flow.ready(x.candidates);x.candidates=x.flow.candidates;x.chosen=0;if(!x.message)x.message='方案已准备好，先试听，再用这版。';this.render();requestAnimationFrame(()=>{const dock=document.querySelector('#creation-dock');if(dock)dock.scrollTop=0;});
  }
  keep(kind){const {x,p}=this.current();if(kind==='range'){if(x.end<=x.start)throw Error('保留范围无效。');x.retention.ranges.push({start:x.start,end:x.end});}else if(kind==='clear-ranges')x.retention.ranges=[];else{if(!x.selected.length)throw Error('请先在画板选择要保留的音符。');x.retention.notes=x.retention.notes.filter(n=>!x.selected.includes(n.id));if(kind!=='clear')for(const id of x.selected)if(p.notes.some(n=>n.id===id))x.retention.notes.push({id,[kind]:true});}x.candidates=[];x.message='保留设置已变化，请重新做几版。';x.flow?.invalidate(x.message);this.c.playback.endAudition();this.render();}
  harmonyEditor(){const {x,p,t}=this.current(),source=x.base.tracks.find(t=>t.id===x.sourceTrackId),absolute=(t.clips.find(c=>c.id===x.target.clipId)?.bar||0)*G.BAR+x.start,clip=source?.clips.find(c=>{const pat=source.patterns.find(p=>p.id===c.patternId);return absolute>=c.bar*G.BAR&&absolute<(c.bar+pat.bars)*G.BAR;}),target=clip?source.patterns.find(p=>p.id===clip.patternId):p;this.harmonyTarget={trackId:clip?source.id:t.id,patternId:target.id,clipId:clip?.id||x.target.clipId};this.harmonyProjectId=x.base.id;this.harmonyInput=G.contentHash({notes:target.notes,harmony:target.harmony});this.harmonyErrors={};this.harmonyDrafts={};this.harmonyInvalid=false;this.harmony=G.clone(target.harmony||{version:1,events:[{start:0,duration:target.bars*G.BAR,rootPitchClass:x.base.key,quality:'major'}],confirmedMusicHash:'manual'});this.renderHarmony();}
  renderHarmony(){const {button,esc,openModal}=this.c,F=G.ui.format;openModal('标注 / 复核和弦',{body:`<p class="field-note">标注这里的和弦关系，现有音符保持。位置写作“小节.拍”，从 1.1 开始。</p><div class="harmony-events">${this.harmony.events.map((e,i)=>`<div class="form-grid"><label class="form-label">起点 · 小节.拍<input type="text" data-field="harmony" data-harmony="start" data-index="${i}" value="${esc(this.harmonyDrafts?.[i+':start']??F.position(e.start))}" ${this.harmonyErrors?.[i+':start']?'aria-invalid="true"':''} aria-label="和弦 ${i+1} 的起点"></label><label class="form-label">时长 · 拍<input type="number" data-harmony="duration" data-index="${i}" value="${esc(this.harmonyDrafts?.[i+':duration']??e.duration/G.PPQ)}" ${this.harmonyErrors?.[i+':duration']?'aria-invalid="true"':''} min="0.001" step="any" aria-label="和弦 ${i+1} 的时长"></label><label class="form-label">根音<select data-harmony="rootPitchClass" data-index="${i}">${G.KEYS.map((k,n)=>`<option value="${n}" ${e.rootPitchClass===n?'selected':''}>${k}</option>`).join('')}</select></label><label class="form-label">和弦类型<select data-harmony="quality" data-index="${i}">${Object.keys(G.CHORD_SHAPES).map(q=>`<option value="${q}" ${q===e.quality?'selected':''}>${esc(F.quality(q))}</option>`).join('')}</select></label>${button('harmony-remove','移除此和弦','trash','quiet',`data-index="${i}"`)}</div>`).join('')}</div><p id="harmony-feedback" role="status">${esc(Object.values(this.harmonyErrors||{})[0]||'')}</p>`,actions:`${button('harmony-add','增加和弦','plus','soft-btn')}${button('harmony-confirm','确认和弦关系','check','dark-btn',this.harmonyInvalid?'disabled':'')}${button('close-modal','取消','','quiet')}`});}
  handleField(el){if(el.dataset.harmony){const e=this.harmony.events[Number(el.dataset.index)],key=el.dataset.harmony;const fieldKey=el.dataset.index+':'+key;this.harmonyErrors||={};this.harmonyDrafts||={};this.harmonyDrafts[fieldKey]=el.value;try{const value=key==='quality'?el.value:key==='start'?G.ui.format.parsePosition(el.value):Number(el.value)*(key==='duration'?G.PPQ:1);if(key==='duration'&&(!Number.isFinite(value)||value<1))throw Error('和弦时长至少需要 1 tick。');e[key]=value;el.removeAttribute?.('aria-invalid');delete this.harmonyErrors[fieldKey];delete this.harmonyDrafts[fieldKey];}catch(error){this.harmonyErrors[fieldKey]=error.message;el.setAttribute?.('aria-invalid','true');this.c.toast(error.message);}this.harmonyInvalid=Object.keys(this.harmonyErrors).length>0;const feedback=document.querySelector('#harmony-feedback');if(feedback)feedback.textContent=Object.values(this.harmonyErrors)[0]||'';const confirm=document.querySelector('[data-action="harmony-confirm"]');if(confirm)confirm.disabled=this.harmonyInvalid;return true;}if(!el.dataset.field?.startsWith('creation-'))return false;const key=el.dataset.field.slice(9),x=this.session;if(key==='sourceTrackId')x.sourceManuallyChosen=true;this.c.playback.endAudition();if(key==='mode'){
    const {t,p}=this.current(),mode=el.value,source=x.sourceTrackId;
    if(!G.CREATION_OPERATIONS[mode])throw Error('创作操作不存在。');
    x.fieldErrors={};x.positionDrafts={};x.parameterDrafts||={};x.parameterDrafts[x.mode]=G.creationParameters(x.mode,x);
    Object.assign(x,G.creationDefaults(mode,t,p,x.base),x.parameterDrafts[mode]||{},{mode});
    if(G.CREATION_OPERATIONS[mode].requiredInputs.includes('harmony')&&!x.sourceTrackId)x.sourceTrackId=source;
    x.candidates=[];x.flow?.invalidate();x.message='已切换操作，可以按当前设置生成。';this.render();return true;
   }if(['start','end'].includes(key)){x.positionDrafts||={};x.fieldErrors||={};try{x[key]=G.ui.format.parsePosition(el.value);delete x.positionDrafts[key];delete x.fieldErrors[key];el.removeAttribute?.('aria-invalid');}catch(e){x.positionDrafts[key]=el.value;x.fieldErrors[key]=e.message;x.candidates=[];x.flow?.invalidate(e.message);x.message=e.message;this.c.toast(e.message);this.render();return true;}}else{x[key]=el.type==='checkbox'?el.checked:el.type==='number'||['bars','low','high'].includes(key)?Number(el.value):el.value;if(['bar','sourceBar'].includes(key))x[key]--;}x.candidates=[];x.message='';x.flow?.invalidate();x.message='设置已变化，请重新生成。';if(key==='mode'){if(x.mode==='arrange'){x.bar=x.base.bars;x.strategy='variation';}if(x.mode==='bass'){x.strategy='align';x.low=36;x.high=55;}}this.render();return true;}
  handleAction(action,el){
   if(action==='creation'||action==='recipes'){this.open(action==='recipes'?'recipe':el?.dataset.mode);return true;}if(action==='creation-close'){this.close();return true;}
   if(!action.startsWith('creation-')&&!action.startsWith('harmony-'))return false;
   try{
    if(action==='creation-mode-choice')return this.handleField({dataset:{field:'creation-mode'},value:el.dataset.mode,type:'select-one'});
    if(action==='creation-pick-chords'){this.c.showTemplates?.('chords');return true;}
    if(action==='creation-open-options'){const options=document.querySelector('#creation-options');if(options){options.open=true;options.scrollIntoView({block:'nearest'});}return true;}
    if(action==='creation-return'){this.c.openTarget?.({...this.session.target,edit:true,activation:'notes'});return true;}
    if(action==='creation-overlay'){this.session.overlay=el.dataset.overlay;this.render();return true;}
    if(action==='creation-fit'){this.c.fitProjection?.();return true;}
    if(action==='creation-generate'){if(this.session.candidates.length&&G.CREATION_OPERATIONS[this.session.mode].random)this.session.seed++;this.generate();}if(action==='creation-new-four'){const {x,t}=this.current(),doc=G.clone(this.c.getProject()),tr=doc.tracks.find(v=>v.id===t.id),pat=G.newPattern('新旋律',4),bar=doc.bars;doc.bars+=4;tr.patterns.push(pat);const clip={id:G.uid('c'),patternId:pat.id,bar};tr.clips.push(clip);G.validateProject(doc);const result=this.c.commit({project:doc,trackId:tr.id,patternId:pat.id,clipId:clip.id});if(result?.ok!==false)this.open(x.mode);}
    if(action==='creation-choose'){this.c.playback.endAudition();this.session.chosen=Number(el.dataset.index);this.render();}
    if(action==='creation-keep')this.keep(el.dataset.keep);
    if(action==='creation-save-keeps'){this.fresh();const {x,p,t}=this.current(),project=G.clone(x.base);project.tracks.find(v=>v.id===t.id).patterns.find(v=>v.id===p.id).retention=G.clone(x.retention);G.validateProject(project);this.c.closeModal();this.c.commit({project:G.applyCandidatePatch(this.c.getProject(),G.candidatePatch(x.base,project)),...x.target,patternId:p.id});this.close();}
    if(action==='creation-preview-original'){this.fresh();const x=this.session,r=x.flow.materialize(this.c.getProject(),x.chosen);const original=G.clone(this.c.getProject());original.bars=Math.max(original.bars,Math.ceil(r.outputRange[1]/G.BAR));this.c.playback.audition(original,{kind:'song',range:r.outputRange,soloIds:[]},'试听原稿 · '+LABELS[x.mode]);return true;}
    if(action==='creation-preview'||action==='creation-preview-solo'){
     this.fresh();const {x,p}=this.current(),r=x.flow?.materialize(this.c.getProject(),x.chosen);if(!r)throw Error('请先生成方案。');const range=r.outputRange;
     const scope={kind:'song',range,soloIds:action.endsWith('-solo')?r.affectedTrackIds:[]};this.c.playback.audition(r.project,scope,'方案 '+(x.chosen+1)+' · '+(action.endsWith('-solo')?'只听当前轨':'连伴奏试听')+' · '+LABELS[x.mode]);
    }
    if(action==='creation-apply'){this.fresh();const x=this.session,s=this.c.getSession();if(G.CREATION_OPERATIONS[x.mode].scope==='instance'&&(s.trackId!==x.target.trackId||s.clipId!==x.target.clipId))throw Error('请返回方案的原目标音乐块，再应用这一版。');const r=x.flow?.materialize(this.c.getProject(),x.chosen);if(!r)throw Error('请先生成方案。');x.flow.state='applying';const result=this.c.commit(r);if(result?.ok===false){x.flow.fail(Error(result.error.message));x.message=result.error.message;this.render();}else this.close();}
    if(action==='harmony-editor')this.harmonyEditor();
    if(action==='harmony-add'){if(this.harmonyInvalid)throw Error('请先修正上方的和弦位置或时长。');const last=this.harmony.events.at(-1);this.harmony.events.push({start:last?last.start+last.duration:0,duration:G.BAR,rootPitchClass:0,quality:'major'});this.renderHarmony();}
    if(action==='harmony-remove'){const at=Number(el.dataset.index);this.harmony.events.splice(at,1);for(const name of ['harmonyDrafts','harmonyErrors']){const mapped={};for(const [key,v] of Object.entries(this[name]||{})){const [i,k]=key.split(':');if(+i!==at)mapped[(+i>at?+i-1:+i)+':'+k]=v;}this[name]=mapped;}this.harmonyInvalid=Object.keys(this.harmonyErrors).length>0;this.renderHarmony();}
    if(action==='harmony-confirm'){if(this.harmonyInvalid)throw Error('请先修正和弦位置。');const x=this.session,base=this.c.getProject(),project=G.clone(base),ht=this.harmonyTarget,pat=project.tracks.find(v=>v.id===ht.trackId)?.patterns.find(v=>v.id===ht.patternId);if(!pat||project.id!==this.harmonyProjectId)throw Error('和弦目标已删除或作品已切换。');if(G.contentHash({notes:pat.notes,harmony:pat.harmony})!==this.harmonyInput)throw Error('和弦来源已变化，请重新打开后复核。');G.confirmHarmony(pat,this.harmony);G.validateProject(project);this.c.closeModal();this.c.commit({project});x.candidates=[];x.flow?.invalidate('和弦关系已更新，请重新做几版。');x.base=G.clone(this.c.getProject());x.token=G.contentHash(x.base);this.render();}
   }catch(e){if(action==='creation-generate'){this.session.flow?.fail(e);this.session.candidates=[];this.session.message=e.message;this.render();}this.c.toast(e.message);const feedback=document.querySelector('#creation-feedback');if(feedback)feedback.textContent=e.message;}
   return true;
  }
 }
 G.CreationUI=CreationUI;
})(globalThis.GridTone ||= {});
