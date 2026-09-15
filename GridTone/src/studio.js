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
 // Keyed DOM reconciliation keeps scroll containers, capture targets and focus alive.
 G.patchDOM=function(parent,markup){
  const tpl=document.createElement('template');tpl.innerHTML=markup;
  const key=n=>n.nodeType===1?(n.id?'id:'+n.id:n.hasAttribute('data-note')?'note:'+n.getAttribute('data-note'):n.hasAttribute('data-clip')?'clip:'+n.getAttribute('data-clip'):n.hasAttribute('data-row-key')?'row:'+n.getAttribute('data-row-key'):null):null;
  function sync(a,b){
   if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){const fresh=b.cloneNode(true);a.replaceWith(fresh);return fresh;}
   if(a.nodeType!==1){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return a;}
   for(const attr of [...a.attributes])if(!b.hasAttribute(attr.name))a.removeAttribute(attr.name);
   for(const attr of [...b.attributes])if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);
   if(a instanceof HTMLInputElement){if(document.activeElement!==a)a.value=b.value;a.checked=b.checked;}
   if(a.id!=='grid-inner')children(a,b);
   if(a instanceof HTMLSelectElement&&document.activeElement!==a)a.value=b.value;return a;
  }
  function children(a,b){
   const keyed=new Map([...a.childNodes].map(n=>[key(n),n]).filter(([k])=>k));let cursor=a.firstChild;
   for(const desired of [...b.childNodes]){
    const k=key(desired);let node=k?keyed.get(k):cursor&&!key(cursor)?cursor:null;
    if(!node){node=desired.cloneNode(true);a.insertBefore(node,cursor);}
    else {if(node!==cursor)a.insertBefore(node,cursor);node=sync(node,desired);}
    cursor=node.nextSibling;
   }
   while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
  }
  children(parent,tpl.content);
 };
})(globalThis.GridTone ||= {});
