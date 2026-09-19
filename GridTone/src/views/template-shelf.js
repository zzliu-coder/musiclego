(function(G){'use strict';
 class TemplateShelf{
  constructor(context,catalog){this.c=context;this.catalog=catalog;this.selected=null;this.pending=null;this.activePlacement=null;this.browsedId=null;this.collapsed=false;try{this.preferences=JSON.parse(localStorage.getItem('legou.catalog.preferences'))||{};}catch{this.preferences={};}this.preferences.favorites||=[];this.preferences.recent||=[];this.filter=['favorites','recent'].includes(this.preferences.filter)?'all':(this.preferences.filter||'all');if(['favorites','recent'].includes(this.preferences.filter))this.preferences.browse=this.preferences.filter;this.catalog.search=this.preferences.search||this.catalog.search;this.install();}
  save(){try{localStorage.setItem('legou.catalog.preferences',JSON.stringify(this.preferences));}catch{}}
  all(){const key=this.c.getProject().key+':'+G.catalogRevision();if(this.cache?.key===key)return this.cache.items;const items=[...G.catalogTemplates().map(t=>t.type==='song'?{...t,bars:t.project.bars}:t),...[...G.RECIPES,...(G.STUDIO_COMBOS||[])].map(r=>({...r,type:'recipe',role:'song',bars:r.bars|| (r.answer?8:(G.PROGRESSIONS.find(p=>p.id==='progression.'+r.progression)?.bars||4))})),...G.PROGRESSIONS.map(r=>{const texture=G.generateProgression(r.id,{key:this.c.getProject().key,rhythm:'arp'}).template;return {...texture,id:texture.id+'.texture',name:r.name+' · 分解伴奏',role:'texture'};})];this.cache={key,items};return items;}

  item(id){return this.all().find(x=>x.id===id);}
  visual(item){
   const key=item.id+':'+this.c.getProject().key+':'+G.catalogRevision();this.visuals||=new Map();
   if(!this.visuals.has(key))this.visuals.set(key,G.ui.musicBlock.model(item,{key:this.c.getProject().key,seed:1}));
   return this.visuals.get(key);
  }
  render(){const {button,esc}=this.c;
   if(this.c.getSession().workflowLibraryOnly!==false){if(this.activePlacement&&this.activePlacement.projectId!==this.c.getProject().id)this.finishPlacement('project-changed',{render:false});return this.selected?`<div class="placement-hud" role="status"><strong>已拿起：${esc(this.selectedItem?.name||'音乐模板')}</strong><span>点编排空位放入，或点画板选择范围。Esc取消。</span>${button('shelf-current','放入当前块','plus','soft-btn small-btn')}${button('shelf-cancel','取消拿取','close','quiet small-btn')}</div>`:'';}
   if(this.activePlacement&&this.activePlacement.projectId!==this.c.getProject().id)this.finishPlacement('project-changed',{render:false});
   if(this.collapsed)return `<aside class="template-shelf collapsed">${button('shelf-toggle','素材','grid','quiet small-btn','aria-label="展开音乐素材架"')}</aside>`;
   const q=this.catalog.search.toLowerCase(),browse=this.preferences.browse||'tray';
   const tray=this.preferences.tray||G.studioDefaults?.()||[],project=this.c.getProject();
   const used=new Set(project.tracks.flatMap(t=>[t.preset,...t.patterns.flatMap(p=>[p.material?.id,...(p.attributions||[]).map(a=>a.id),p.generation?.recipeId].filter(Boolean))]));
   const allItems=this.all().filter(t=>(this.filter==='all'||this.filter==='song'&&t.type==='song'||this.filter==='recipe'&&t.type==='recipe'||t.type==='pattern'&&this.catalog.roleOf(t)===this.filter)&&(browse==='used'&&used.has(t.id)||browse==='all'||browse==='tray'&&tray.includes(t.id)||browse==='favorites'&&this.preferences.favorites.includes(t.id)||browse==='recent'&&this.preferences.recent.includes(t.id))&&(!q||[t.name,t.description,...(t.tags||[])].join(' ').toLowerCase().includes(q)));
   const soundIds=browse==='used'?[...used]:browse==='tray'?tray:[];
   const soundItems=soundIds.map(id=>G.studioItem?.(id,project)).filter(x=>x?.type==='sound'&&(this.filter==='all'||this.filter==='drums'&&x.engine==='drum'||this.filter==='bass'&&x.category==='低音')&&(!q||(x.name+' '+x.category).toLowerCase().includes(q))).slice(0,12);
   allItems.sort((a,b)=>browse==='recent'?this.preferences.recent.indexOf(a.id)-this.preferences.recent.indexOf(b.id):browse==='tray'?tray.indexOf(a.id)-tray.indexOf(b.id):(a.type==='song'?2:a.type==='recipe'?1:0)-(b.type==='song'?2:b.type==='recipe'?1:0));
   const items=allItems.slice(0,Math.max(0,12-soundItems.length));
   const listening=this.c.playback.context?.audition&&this.c.playback.auditionProject?this.listeningId:null;
   return `<aside class="template-shelf" aria-label="音乐素材架"><header><div><span class="shelf-eyebrow">从这里开始</span><h2>本次素材托盘</h2></div>${button('shelf-toggle','收起','','quiet small-btn','aria-label="收起音乐素材架"')}</header>${button('library-open','浏览完整素材库','grid','soft-btn','data-kind="rhythm"')}<label class="shelf-search">${G.ui.icon('search',15)}<input type="search" data-field="shelf-search" aria-label="搜索音乐模板" placeholder="找旋律、鼓点、和弦…" value="${esc(this.catalog.search)}"></label><nav class="shelf-browse" aria-label="浏览方式">${[['tray','托盘'],['favorites','收藏'],['recent','最近'],['used','正在用']].map(([id,label])=>button('shelf-browse',label,'',browse===id?'active small-btn':'quiet small-btn',`data-browse="${id}" aria-pressed="${browse===id}"`)).join('')}</nav><nav class="shelf-filters" aria-label="音乐材料类别">${[['all','全部'],['chords','和弦'],['drums','鼓点'],['melody','旋律'],['bass','贝斯'],['texture','伴奏'],['recipe','组合'],['song','示例作品']].map(([id,label])=>button('shelf-filter',label,'',this.filter===id?'active small-btn':'quiet small-btn',`data-filter="${id}" aria-pressed="${this.filter===id}"`)).join('')}</nav><p class="shelf-hint" role="status">${esc(this.message||(this.selected?'已拿起：点画板空位即可放入。':'把一块音乐拖到画板，听一听。'))}</p>${this.selected?`<div class="shelf-placement">${button('shelf-current','放入当前块','plus','soft-btn small-btn')}${button('shelf-cancel','取消拿取','','quiet small-btn')}</div>`:''}<div class="shelf-cards">${soundItems.map(x=>`<article class="tray-sound"><span>${G.ui.icon('piano',18)}</span><div><strong>${esc(x.name)}</strong><small>音色 · ${esc(x.category)}</small></div>${button('library-open','选择 / 试听','','quiet small-btn',`data-kind="sound" data-id="${esc(x.id)}"`)}${browse==='tray'?button('shelf-unpin','从托盘移除','close','quiet small-btn',`data-id="${esc(x.id)}"`):''}</article>`).join('')}${items.map(t=>G.ui.musicBlock.card(this.visual(t),{picked:this.selected===t.id,favorite:this.preferences.favorites.includes(t.id),audition:listening===t.id,removable:browse==='tray'})).join('')||G.ui.InlineNotice({title:'还没有匹配的素材',text:'换个关键词，或回到全部素材。',actions:button('shelf-reset','显示全部','','soft-btn small-btn')})}</div><footer><span class="shelf-count">${items.length+soundItems.length} / ${allItems.length+soundItems.length} 项 · 更多请在完整库挑选</span>${button('library-open','声音与组合','piano','quiet small-btn','data-kind="sound"')}${button('catalog','管理与导入','folder','quiet small-btn')}</footer></aside>`;
  }
  feedback(message){this.message=message;this.c.render();}
  finishPlacement(reason='cancelled',{render=true,message=''}={}){
   if(this.activePlacement)this.activePlacement.phase=reason;
   this.activePlacement=null;this.selected=null;this.selectedItem=null;this.pending=null;this.dragProject=null;
   this.nativeDragging=false;this.nativeDropHandled=false;this.ghostKey=null;this.replacement=null;
   this.replacementProject=null;this.replacementFingerprint=null;this.longTarget=null;
   this.clearGhost();this.dragImage?.remove();this.dragImage=null;document.querySelectorAll('.shelf-card.is-picked').forEach(e=>e.classList.remove('is-picked'));this.c.playback.endAudition();this.message=message;if(render)this.c.render();this.onFinish?.(reason);
  }
  cancel(){this.finishPlacement('cancelled');}
  choose(id,{native=false,render=true}={}){
   if(this.activePlacement?.phase==='applying')return false;
   const item=this.item(id);if(item?.type==='song'){if(native)return false;this.openExample(id);return false;}if(!item)throw Error('素材已不存在，请重新选择。');
   this.finishPlacement('replaced',{render:false});this.browsedId=id;
   this.activePlacement={token:G.uid('placement'),projectId:this.c.getProject().id,item:G.clone(item),native,phase:'armed'};
   this.selected=id;this.selectedItem=this.activePlacement.item;this.dragProject=this.activePlacement.projectId;
   this.message='已拿起「'+item.name+'」';if(render)this.c.render();return true;
  }
  place(options){
   const p=this.c.getProject(),active=this.activePlacement;
   if(!active||active.phase!=='armed')throw Error('请先重新拿起素材。');
   if(active.projectId!==p.id)throw Error('作品已切换，请重新拿起素材。');
   const result=G.planPlacement(p,active.item,options);
   const flow=new G.CandidateSession(p,'placement',options.clipId?{trackId:options.trackId,clipId:options.clipId}:{},options);
   flow.begin();if(result.project.id===p.id)flow.ready([result]);
   this.pending={id:active.item.id,options,result,flow};return result;
  }
  async apply(options){
   const active=this.activePlacement;if(!active||active.phase==='applying')return;
   try{
    const result=this.place(options),id=active.item.id;active.phase='applying';
    const commit=await this.c.commit(result);if(commit?.ok===false)throw Error(commit.error.message);
    this.preferences.recent=[id,...this.preferences.recent.filter(x=>x!==id)].slice(0,20);this.collections?.touch(id);this.save();
    if(this.activePlacement===active)this.finishPlacement('applied',{message:'已放入，可继续搭建或撤销。'});
   }catch(e){if(this.activePlacement===active)this.finishPlacement('failed',{message:e.message});else this.c.toast(e.message);}
  }
  current(at){const p=this.c.getProject(),s=this.c.getSession(),t=p.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),item=this.selectedItem||this.item(this.selected);if(!this.activePlacement||!item)throw Error('请先重新拿起素材。');if(item.type!=='pattern')throw Error('整套素材请放到编排中的起始小节。');const start=G.snapTime(Math.max(0,at??s.cursor),s),end=start+item.bars*G.BAR,options={trackId:t.id,patternId:pat.id,clipId:s.clipId,start,end};const overlap=pat.notes.some(n=>n.start<end&&n.start+n.duration>start);if(end>pat.bars*G.BAR){this.longTarget={trackId:t.id,projectId:p.id};const clip=t.clips.find(c=>c.id===s.clipId),bar=Math.min(G.LIMITS.bars-item.bars,(clip?.bar||0)+pat.bars);this.c.openModal('素材比当前音乐块更长',`<p>素材 ${item.bars} 小节，当前音乐块 ${pat.bars} 小节。可以在明确的编排位置新建独立音乐块；原音乐块及其他关联位置保留。</p><label>新音乐块从第几小节开始<input id="shelf-new-bar" type="number" min="1" max="${G.LIMITS.bars-item.bars+1}" value="${bar+1}"></label><div class="modal-actions">${this.c.button('shelf-new-independent','新建独立音乐块','plus','dark-btn')}${this.c.button('close-modal','取消','','quiet')}</div>`);return;}
   if(overlap){this.replacement=options;this.replacementProject=p.id;this.replacementFingerprint=G.targetFingerprint(p,{trackId:t.id,clipId:s.clipId});this.c.openModal('替换这段范围？',`<p>${G.ui.format.range(start,end)} · 放入 ${item.bars} 小节。当前位置的音乐块会独立修改；范围外内容保留。</p><p>跨越边界的长音默认保留并阻止替换。可以扩大选区，或明确拆分。</p><div class="modal-actions">${this.c.button('shelf-replace','替换选区','check','dark-btn')}${this.c.button('shelf-split-replace','拆分边界长音并替换','','soft-btn')}${this.c.button('close-modal','取消','','quiet')}</div>`);}
   else void this.apply(options);
  }
  openExample(id){const item=this.item(id);if(!item||item.type!=='song')return;this.finishPlacement('example',{render:false});this.catalog.select('templates',id);}
  reflectAudition(){const active=this.c.playback.engine?.playing&&this.c.playback.auditionProject&&this.c.playback.context?.audition?.startsWith('素材试听')?this.listeningId:null;
   document.querySelectorAll('.shelf-card').forEach(card=>{const on=card.dataset.shelfId===active;card.classList.toggle('is-auditioning',on);const b=card.querySelector('[data-action="shelf-preview"]');if(b){const was=b.getAttribute('aria-pressed')==='true';b.setAttribute('aria-pressed',String(on));if(on!==was){const svg=b.querySelector('svg');if(svg)svg.outerHTML=G.ui.icon(on?'stop':'play');b.setAttribute('aria-label',(on?'停止试听 ':'试听 ')+(card.querySelector('.block-name')?.textContent||''));}const text=b.querySelector('span');if(text&&text.textContent!==(on?'正在试听':'试听'))text.textContent=on?'正在试听':'试听';}});
  }
  async preview(id){try{
   if(this.listeningId===id&&this.c.playback.auditionProject){this.c.playback.endAudition();this.listeningId=null;this.c.render();return;}
   const p=this.c.getProject(),item=this.item(id);let result,context;
   if(item.type==='recipe'){const host={...G.clone(p),tracks:[],bars:1};result={project:G.applyRecipe(host,id,{bar:0,key:p.key,seed:1}).project};context='组合模板 · 当前作品速度与律动';}
   else if(item.type==='song'){result=G.applyTemplate(G.blankProject(),item);context='示例作品 · 原版声音与速度';}
   else{const current=p.tracks.find(t=>t.id===this.c.getSession().trackId);if(current?.kind===item.kind){const preview=G.clone(p);preview.tracks=[G.clone(current)];preview.tracks[0].clips=[];preview.bars=item.bars;result=G.applyTemplate(preview,item,{mode:'new',trackId:current.id,bar:0,applySound:false});context='使用本轨音色 · '+current.name;}else{result=G.applyTemplate(G.blankProject(),item,{mode:'new-track',bar:0});context='使用模板建议音色';}}
   this.listeningId=id;this.message='试听「'+item.name+'」 · '+context;this.c.render();
   await this.c.playback.audition(result.project,result.trackId?{kind:'pattern',trackId:result.trackId,patternId:result.patternId,ignoreMute:true}:{kind:'song'},'素材试听 · '+item.name+' · '+context);this.reflectAudition();
  }catch(e){this.feedback(e.message);}}
  handleField(el){if(el.dataset.field!=='shelf-search')return false;this.catalog.search=el.value;this.preferences.search=el.value;this.save();this.c.render();return true;}
  handleAction(action,el){if(!action.startsWith('shelf-'))return false;try{if(action==='shelf-open-song'){this.openExample(el.dataset.id);return true;}if(action==='shelf-unpin'){this.preferences.tray=(this.preferences.tray||G.studioDefaults()).filter(id=>id!==el.dataset.id);if(this.selected===el.dataset.id)this.finishPlacement('cancelled',{render:false});this.save();this.c.render();return true;}if(action==='shelf-browse'){this.preferences.browse=el.dataset.browse;this.save();this.c.render();return true;}if(action==='shelf-reset'){this.filter='all';this.preferences.browse='all';this.catalog.search='';this.save();this.c.render();return true;}if(action==='shelf-toggle'){this.collapsed=!this.collapsed;this.c.render();}if(action==='shelf-pick')this.choose(el.dataset.id);if(action==='shelf-cancel')this.cancel();if(action==='shelf-preview')void this.preview(el.dataset.id);if(action==='shelf-current')this.current();if(action==='shelf-new-independent'){if(this.c.getProject().id!==this.longTarget.projectId)throw Error('作品已切换，请重新拿取素材。');const bar=Number(document.querySelector('#shelf-new-bar').value)-1;this.place({trackId:this.longTarget.trackId,bar});this.c.closeModal();void this.apply({trackId:this.longTarget.trackId,bar});}if(action==='shelf-filter'){this.filter=el.dataset.filter;this.preferences.filter=this.filter;this.preferences.browse='all';this.save();this.c.render();}if(action==='shelf-favorite'){const id=el.dataset.id;this.preferences.favorites=this.preferences.favorites.includes(id)?this.preferences.favorites.filter(x=>x!==id):[...this.preferences.favorites,id];this.save();this.c.render();}if(action==='shelf-replace'||action==='shelf-split-replace'){if(this.c.getProject().id!==this.replacementProject||G.targetFingerprint(this.c.getProject(),{trackId:this.replacement.trackId,clipId:this.replacement.clipId})!==this.replacementFingerprint)throw Error('目标已变化，请重新选择替换范围。');this.c.closeModal();void this.apply({...this.replacement,replace:true,splitBoundary:action==='shelf-split-replace'});}}catch(e){this.feedback(e.message);}return true;}
  clearGhost(){document.querySelectorAll('.shelf-drop-ghost').forEach(e=>e.remove());}
  location(e){if(e.target.closest('[data-pitch-axis]'))return null;const svg=e.target.closest('#note-grid');if(svg){const box=svg.getBoundingClientRect(),scale=Number(svg.getAttribute('width'))/box.width,left=Number(svg.dataset.left),cw=Number(svg.dataset.cellWidth),x=(e.clientX-box.left)*scale;if(x<left||(e.clientY-box.top)*Number(svg.getAttribute('height'))/box.height<28)return null;const s=this.c.getSession(),p=this.c.getProject(),t=p.tracks.find(t=>t.id===s.trackId),pat=t.patterns.find(p=>p.id===s.patternId),win=G.gridWindow(s,pat),start=G.snapTime((x-left)/cw*G.STEP+win.offset,s);return {svg,start,trackId:t.id,key:'grid:'+pat.id+':'+start,x:left+(start-win.offset)/G.STEP*cw,cw};}const lane=e.target.closest('.arrange-lane');if(!lane)return null;const box=lane.getBoundingClientRect(),bars=Number(lane.dataset.bars);return {lane,trackId:lane.dataset.track,bar:Math.max(0,Math.min(bars-1,Math.floor((e.clientX-box.left)/box.width*bars)))};}
  ownsDrag(e,read=false){
   const active=this.activePlacement,dt=e.dataTransfer;
   if(!active||!active.native||active.phase!=='armed'||active.projectId!==this.c.getProject().id||!dt)return false;
   if(!Array.from(dt.types||[]).includes('application/x-legou-template'))return false;
   if(!read)return true;
   try{const payload=JSON.parse(dt.getData('application/x-legou-template'));return payload.token===active.token&&payload.projectId===active.projectId&&payload.id===active.item.id;}catch{return false;}
  }
  install(){
   document.addEventListener('dragstart',e=>{
    const card=e.target.closest('[data-shelf-id]');if(!card||!e.dataTransfer)return;
    if(!this.choose(card.dataset.shelfId,{native:true,render:false})){e.preventDefault();return;}
    this.nativeDragging=true;this.nativeDropHandled=false;
    e.dataTransfer.setData('application/x-legou-template',JSON.stringify({token:this.activePlacement.token,projectId:this.dragProject,id:this.selected}));
    e.dataTransfer.effectAllowed='copy';
    const m=this.visual(this.activePlacement.item),img=document.createElement('div');img.className='music-block block-in-hand';img.style.cssText='position:fixed;left:-1000px;top:0;width:240px;pointer-events:none;'+G.ui.musicStyle(null,m.role);img.innerHTML=G.ui.musicBlock.body(m);document.body.append(img);this.dragImage=img;e.dataTransfer.setDragImage(img,34,24);card.classList.add('is-picked');
   });
   document.addEventListener('dragover',e=>{
    if(!this.ownsDrag(e))return;const target=this.location(e);if(!target)return;e.preventDefault();
    e.dataTransfer.dropEffect='copy';
    const scroll=e.target.closest('[data-scroll]');if(scroll){const r=scroll.getBoundingClientRect();if(e.clientX>r.right-36)scroll.scrollLeft+=18;else if(e.clientX<r.left+36)scroll.scrollLeft-=18;}
    const item=this.activePlacement.item,key=target.key||target.trackId+':'+target.bar;
    if(this.ghostKey===key&&document.querySelector('.shelf-drop-ghost'))return;this.clearGhost();this.ghostKey=key;
    const m=this.visual(item),host=this.c.getProject();let valid=true,label='';
    try{if(target.svg){const ss=this.c.getSession(),tr=host.tracks.find(t=>t.id===target.trackId),pat=tr.patterns.find(p=>p.id===ss.patternId),has=pat.notes.some(n=>n.start<target.start+item.bars*G.BAR&&n.start+n.duration>target.start);if(item.type!=='pattern')throw Error('组合模板请放在上方编排');G.planPlacement(host,item,{trackId:tr.id,clipId:ss.clipId,patternId:pat.id,start:target.start,replace:has});label=G.ui.format.range(target.start,target.start+item.bars*G.BAR)+(has?' · 放下后确认替换':' · 放入音符');}
    else{G.planPlacement(host,item,{trackId:target.trackId,bar:target.bar});label=G.ui.format.range(target.bar*G.BAR,(target.bar+m.bars)*G.BAR)+(item.type==='recipe'?' · 新增 '+m.tracks.length+' 轨':' · 新建音乐块');}}
    catch(error){valid=false;label=error.message;}
    e.dataTransfer.dropEffect=valid?'copy':'none';
    if(target.svg){const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','shelf-drop-ghost');g.setAttribute('pointer-events','none');g.style.pointerEvents='none';g.dataset.valid=String(valid);const h=Number(target.svg.getAttribute('height'))-102,w=m.bars*16*target.cw;
     g.innerHTML=`<rect x="${target.x}" y="28" width="${w}" height="${h}" rx="5" fill="var(--selected)" fill-opacity=".65" stroke="${valid?'var(--brand)':'var(--danger)'}" stroke-width="2" stroke-dasharray="6 4"/><foreignObject x="${target.x+4}" y="33" width="${Math.max(40,w-8)}" height="${Math.min(110,h)}"><div xmlns="http://www.w3.org/1999/xhtml">${G.ui.musicBlock.projection(m,label,valid)}</div></foreignObject>`;target.svg.append(g);return;}
    const g=document.createElement('div');g.className='shelf-drop-ghost';g.dataset.valid=String(valid);g.innerHTML=G.ui.musicBlock.projection(m,label,valid);g.style.left=target.bar/Number(target.lane.dataset.bars)*100+'%';g.style.width=m.bars/Number(target.lane.dataset.bars)*100+'%';target.lane.append(g);
   });
   document.addEventListener('drop',e=>{
    if(!this.ownsDrag(e,true))return;const target=this.location(e);this.clearGhost();e.preventDefault();
    if(!target){this.finishPlacement('cancelled');return;}this.nativeDropHandled=true;
    // The browser's native gesture ends here; replacement confirmation is a separate phase.
    this.activePlacement.native=false;this.nativeDragging=false;
    if(target.svg){try{this.current(target.start);}catch(error){this.finishPlacement('failed',{message:error.message});}}
    else void this.apply({trackId:target.trackId,bar:target.bar});
   });
   document.addEventListener('dragend',()=>{this.dragImage?.remove();this.dragImage=null;document.querySelectorAll('.shelf-card.is-picked').forEach(e=>e.classList.remove('is-picked'));const cancelled=this.nativeDragging&&!this.nativeDropHandled;this.nativeDragging=false;this.nativeDropHandled=false;this.clearGhost();if(cancelled)this.finishPlacement('cancelled');});
   // Native HTML dragging emits pointercancel when the browser takes over the pointer.
   document.addEventListener('pointercancel',()=>{if(this.nativeDragging)return;if(this.activePlacement?.phase==='armed')this.finishPlacement('cancelled');});
   document.addEventListener('pointerdown',e=>{if(!this.selected||this.c.getSession().modal)return;const target=this.location(e);if(!target?.svg)return;e.preventDefault();e.stopImmediatePropagation();try{this.current(target.start);}catch(error){this.finishPlacement('failed',{message:error.message});}},true);
   document.addEventListener('click',e=>{if(!this.selected||this.c.getSession().modal)return;const target=e.target.closest('.empty-bar');if(target){e.preventDefault();e.stopImmediatePropagation();void this.apply({trackId:target.dataset.track,bar:Number(target.dataset.bar)});}},true);
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.selected){e.preventDefault();const owned=!!(this.replacement||this.longTarget);this.finishPlacement('cancelled');if(owned)this.c.closeModal();}});
   window.addEventListener('blur',()=>{if(!this.activePlacement||this.activePlacement.phase==='applying')return;const owned=!!(this.replacement||this.longTarget);this.finishPlacement('cancelled',{message:'已结束本次拿取，可重新选择素材。'});if(owned)this.c.closeModal();});
  }
 }
 G.TemplateShelf=TemplateShelf;
})(globalThis.GridTone ||= {});
