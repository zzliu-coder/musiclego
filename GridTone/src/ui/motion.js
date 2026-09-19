/** Surface feedback only. Commands, hit geometry and audio never depend on a timer. */
(function(G){'use strict';
 const reduced=()=>document.documentElement.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const settling=new Map();let beat=-1,sounding=new Set(),lastLayer=null,processed=null,processedKey='';
 function clearDrag(){document.querySelectorAll('.clip-origin,.clip-target').forEach(n=>n.remove());const s=document.querySelector('.legou-shell');if(s)delete s.dataset.gesture;}
 function clip(d,e,project){
  const shell=document.querySelector('.legou-shell');if(shell)shell.dataset.gesture='clip';
  const items=G.clipSelection(d.before,d.ids);
  for(const [index,item] of items.entries()){
   const el=document.querySelector(`[data-clip="${item.clip.id}"]`);if(!el)continue;
   const lane=el.parentElement;let origin=lane.querySelector(`[data-origin="${item.clip.id}"]`);
   if(!origin){origin=document.createElement('div');origin.className='clip-origin';origin.dataset.origin=item.clip.id;origin.style.left=el.style.left;origin.style.width=el.style.width;lane.append(origin);}
   const dest=d.targetId!==d.trackId?document.querySelector(`.arrange-lane[data-track="${d.targetId}"]`):lane;
   let target=document.querySelector(`[data-target="${item.clip.id}"]`);
   if(!target){target=document.createElement('div');target.className='clip-target';target.dataset.target=item.clip.id;}
   if(dest){if(target.parentElement!==dest)dest.append(target);target.style.left=`calc(${(item.clip.bar+d.delta)*100/project.bars}% + 4px)`;target.style.width=`calc(${item.pattern.bars*100/project.bars}% - 8px)`;target.classList.toggle('invalid',!d.valid);
    if(index===0){let label=target.querySelector('span');if(!label){label=document.createElement('span');label.className='clip-target-label';target.append(label);}const text=d.valid?`${d.copy?'复制到':'移动到'}第 ${item.clip.bar+d.delta+1} 小节`:(d.invalidReason||'此处不能放置');if(label.textContent!==text)label.textContent=text;}
   }
   const dy=dest?dest.getBoundingClientRect().top-lane.getBoundingClientRect().top:0;
   // Raw pointer position; no CSS transition on this element or its ancestors.
   el.style.transform=`translate(${e.clientX-d.clientX}px,${dy}px)`;
  }
 }
 function settle(d){
  clearDrag();if(reduced())return;
  const ids=d.type==='clip'?d.resultIds||d.ids:d.ids||[...(d.notes?.keys()||[])];
  for(const id of ids||[]){const el=document.querySelector(d.type==='clip'?`[data-clip="${id}"]`:`#note-layer [data-note="${id}"]`);if(!el)continue;
   if(settling.has(el))clearTimeout(settling.get(el));el.classList.add('is-settling');
   settling.set(el,setTimeout(()=>{el.classList.remove('is-settling');settling.delete(el);},100));
  }
 }
 function afterRender(){processed=null;}
 function playback({project,S,B,engine,position}){
  const layer=document.querySelector('#note-layer'),t=project.tracks.find(t=>t.id===S.trackId),p=t?.patterns.find(p=>p.id===S.patternId);let tick=position,active=engine.playing&&!B.audition;
  if(B.target==='bar')tick+=S.page*G.BAR;
  if(['song','tracks'].includes(B.target)){
   const c=t?.clips.find(c=>c.patternId===p?.id&&position>=c.bar*G.BAR&&position<(c.bar+(p?.bars||0))*G.BAR);
   if(!c)active=false;else tick-=c.bar*G.BAR;
   if(t?.mute||(B.soloIds.length&&!B.soloIds.includes(t?.id))||(B.target==='tracks'&&!B.selectedTrackIds.includes(t?.id)))active=false;
  }
  if(lastLayer!==layer){sounding=new Set();lastLayer=layer;}
  if(p&&(!processed||processedKey!==p.id)){processed=G.processPattern(p,t,project);processedKey=p.id;}
  const next=new Set(active&&p?processed.filter(n=>tick>=n.start&&tick<n.start+n.duration).map(n=>n.id.replace(/_arp\d+$/,'')):[]);
  for(const id of sounding)if(!next.has(id))layer?.querySelector(`[data-note="${id}"]`)?.classList.remove('is-sounding');
  for(const id of next)if(!sounding.has(id))layer?.querySelector(`[data-note="${id}"]`)?.classList.add('is-sounding');sounding=next;
  const b=engine.playing?Math.floor(position/G.PPQ):-1;
  if(b!==beat){beat=b;document.querySelectorAll('.ruler-bars>div').forEach((el,i)=>el.classList.toggle('current-bar',b>=0&&i===Math.floor(position/G.BAR)));}
 }
 G.motion={reduced,clip,clearDrag,settle,afterRender,playback};
})(globalThis.GridTone ||= {});
