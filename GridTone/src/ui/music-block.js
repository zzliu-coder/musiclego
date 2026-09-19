/** One musical identity at rest, in the hand, over a target, and in the timeline.
 * Projection markup is read-only and contains no note/clip hit-target attributes. */
(function(G){'use strict';
 const esc=s=>G.ui.esc(s),roleOf=item=>item.role||(item.kind==='drum'?'drums':item.type==='song'||item.type==='recipe'?'song':'melody');
 const role=item=>G.ui.roles[roleOf(item)]||G.ui.roles.unspecified;
 function tracksFor(item,{key=0,seed=1}={}){
  if(item.type==='recipe'){const p=G.recipeProject(item.id,{key,seed});return {tracks:p.tracks,bars:p.bars};}
  if(item.type==='song')return {tracks:item.project.tracks,bars:item.project.bars};
  return {bars:item.bars,tracks:[{kind:item.kind,role:roleOf(item),name:role(item).label,patterns:[item],clips:[{patternId:item.id,bar:0}]}]};
 }
 function model(item,context){const {tracks,bars}=tracksFor(item,context);return {name:item.name,id:item.id,role:roleOf(item),bars,type:item.type,tracks};}
 function rangeModel(project,trackIds,range,name='音乐方案'){
  const [start,end]=range,bars=(end-start)/G.BAR;if(!Number.isFinite(bars)||bars<=0)throw Error('方案范围无效。');
  const tracks=project.tracks.filter(t=>!trackIds||trackIds.includes(t.id)).map(t=>{const id='preview.'+t.id,notes=t.clips.flatMap(c=>{const pat=t.patterns.find(p=>p.id===c.patternId);return (pat?.notes||[]).flatMap(n=>{const a=n.start+c.bar*G.BAR,b=a+n.duration,lo=Math.max(a,start),hi=Math.min(b,end);return hi>lo?[{...n,start:lo-start,duration:hi-lo}]:[];});});return {id:t.id,name:t.name,kind:t.kind,role:t.role,color:t.color,patterns:[{id,notes,bars}],clips:[{bar:0,patternId:id}]};});
  return {name,id:'preview',type:'recipe',role:'song',bars,tracks};
 }
 function drawing(m,width=220,height=46){
  const tracks=m.tracks,lane=Math.max(6,height/tracks.length),length=m.bars*G.BAR;
  let paths='';
  tracks.forEach((t,i)=>{const ns=t.clips.flatMap(c=>{const p=t.patterns.find(p=>p.id===c.patternId);return (p?.notes||[]).map(n=>({...n,start:n.start+c.bar*G.BAR}));}),lo=ns.length?Math.min(...ns.map(n=>n.pitch)):48,hi=Math.max(lo+7,...ns.map(n=>n.pitch));const color=G.ui.musicPalette(t.color,t.role|| (t.kind==='drum'?'drums':'melody')).ink;
   paths+=`<path d="M0 ${i*lane+lane-.5}H${width}" stroke="currentColor" opacity=".07"/>`;
   if(!ns.length)paths+=`<path d="M4 ${i*lane+lane/2}H${width-4}" stroke="${color}" stroke-dasharray="3 5" opacity=".35"/>`;
   else for(const n of ns.slice(0,400))paths+=`<rect x="${n.start/length*width}" y="${i*lane+2+(hi-n.pitch)/(hi-lo)*Math.max(1,lane-7)}" width="${Math.max(1.5,n.duration/length*width-1)}" height="${tracks.length>1?2:3}" rx="1" fill="${color}" opacity="${.70+n.velocity*.30}"/>`;
  });
  return `<svg class="block-score" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
 }
 function body(m,{stage='shelf'}={}){const r=G.ui.roles[m.role]||G.ui.roles.unspecified,kind=m.type==='song'?'示例作品':m.type==='recipe'?'组合模板':r.label;return `<span class="block-meta">${G.ui.icon(m.type==='song'||m.type==='recipe'?'arrange':r.icon,14)}<span>${esc(kind)}</span><span>${m.bars} 小节</span></span><strong class="block-name">${esc(m.name)}</strong>${drawing(m,220,m.tracks.length>1?Math.min(72,m.tracks.length*13):42)}${m.tracks.length>1?`<span class="block-composition">${m.tracks.length} 轨 · ${esc(m.tracks.map(t=>t.name).join(' / '))}</span>`:''}`;}
 function card(m,{picked=false,favorite=false,audition=false,removable=false}={}){const r=G.ui.roles[m.role]||G.ui.roles.unspecified,isSong=m.type==='song',B=G.ui.button;return `<article class="shelf-card music-block ${picked?'selected is-picked':''} ${audition?'is-auditioning':''}" data-component="music-block" data-stage="shelf" data-material-type="${m.type}" data-musical-role="${m.role}" draggable="${!isSong}" data-shelf-id="${esc(m.id)}" style="${G.ui.musicStyle(null,m.role)}"><button type="button" class="shelf-card-pick" data-action="${isSong?'shelf-open-song':'shelf-pick'}" data-id="${esc(m.id)}" aria-label="${isSong?'用示例新建作品':'拿起'} ${esc(m.name)} · ${m.bars} 小节" aria-pressed="${picked}">${body(m)}<span class="block-affordance">${G.ui.icon(isSong?'file':'hand',12)}${isSong?'新建作品，保留当前作品':'拖到画板 · 或点按放入'}</span></button><div class="block-actions">${B('shelf-preview',audition?'正在试听':'试听',audition?'stop':'play','quiet small-btn',`data-id="${esc(m.id)}" aria-label="${audition?'停止试听':'试听'} ${esc(m.name)}" aria-pressed="${audition}"`)}${B('shelf-favorite',favorite?'已收藏':'收藏',favorite?'check':'plus','quiet small-btn',`data-id="${esc(m.id)}" aria-label="${favorite?'取消收藏':'收藏'} ${esc(m.name)}" aria-pressed="${favorite}"`)}${removable?B('shelf-unpin','','close','quiet icon-btn small-btn',`data-id="${esc(m.id)}" aria-label="从托盘移除 ${esc(m.name)}" title="从托盘移除，不影响作品"`):''}</div></article>`;}
 function projection(m,label,valid=true){return `<div class="music-block block-projection" data-component="music-block" data-stage="projection" data-valid="${valid}" style="${G.ui.musicStyle(null,m.role)}">${body(m,{stage:'projection'})}<span class="projection-label">${G.ui.icon(valid?'check':'info',12)}${esc(label)}</span></div>`;}
 G.ui.musicBlock={model,rangeModel,body,drawing,card,projection,roleOf};
})(globalThis.GridTone ||= {});
