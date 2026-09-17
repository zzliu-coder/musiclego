/** One visual state system. Never delays or mutates an audio command. */
(function(G){'use strict';
 const reduced=()=>document.documentElement.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
 let panelKey='',beat=-1,sounding=new Set(),lastSong=null,processed=null,processedKey='',lastTrack='';
 function pulse(el,name){if(!el||reduced())return;el.classList.remove(name);void el.getBoundingClientRect();el.classList.add(name);el.addEventListener('animationend',()=>el.classList.remove(name),{once:true});}
 function clearDrag(){document.querySelectorAll('.clip-origin,.clip-target').forEach(n=>n.remove());const shell=document.querySelector('.legou-shell');if(shell)delete shell.dataset.gesture;}
 function clip(d,e,project){
  const shell=document.querySelector('.legou-shell');if(shell)shell.dataset.gesture='clip';
  const items=G.clipSelection(d.before,d.ids);
  for(const item of items){
   const el=document.querySelector(`[data-clip="${item.clip.id}"]`);if(!el)continue;
   const lane=el.parentElement;
   let origin=lane.querySelector(`[data-origin="${item.clip.id}"]`);
   if(!origin){origin=document.createElement('div');origin.className='clip-origin';origin.dataset.origin=item.clip.id;origin.style.left=el.style.left;origin.style.width=el.style.width;lane.append(origin);}
   const targetLane=d.targetId!==d.trackId?document.querySelector(`.arrange-lane[data-track="${d.targetId}"]`):lane;
   let target=document.querySelector(`[data-target="${item.clip.id}"]`);
   if(!target){target=document.createElement('div');target.className='clip-target';target.dataset.target=item.clip.id;}
   if(targetLane){targetLane.append(target);target.style.left=`calc(${(item.clip.bar+d.delta)*100/project.bars}% + 4px)`;target.style.width=`calc(${item.pattern.bars*100/project.bars}% - 8px)`;target.classList.toggle('invalid',!d.valid);target.replaceChildren();if(item===items[0]){const label=document.createElement('span');label.className='clip-target-label';label.textContent=d.valid?`${d.copy?'复制到':'移动到'}第 ${item.clip.bar+d.delta+1} 小节`:(d.invalidReason||'此处不能放置');target.append(label);}}
   const dy=targetLane?targetLane.getBoundingClientRect().top-lane.getBoundingClientRect().top:0;
   el.style.transform=`translate(${e.clientX-d.clientX}px,${dy}px)`;
  }
 }
 function settle(d){clearDrag();const ids=d.type==='clip'?d.resultIds||d.ids:d.ids||[...(d.notes?.keys()||[])];for(const id of ids||[]){const el=document.querySelector(d.type==='clip'?`[data-clip="${id}"]`:`#note-layer [data-note="${id}"]`);pulse(el,'is-settling');}}
 function afterRender(S){processed=null;if(lastTrack!==S.trackId+':'+innerWidth){const active=document.querySelector('.sound-track.current'),list=document.querySelector('.sound-track-list');if(active&&list){const a=active.getBoundingClientRect(),l=list.getBoundingClientRect();if(a.bottom>l.bottom)list.scrollTop+=a.bottom-l.bottom;if(a.top<l.top)list.scrollTop-=l.top-a.top;if(a.right>l.right)list.scrollLeft+=a.right-l.right;if(a.left<l.left)list.scrollLeft-=l.left-a.left;}lastTrack=S.trackId+':'+innerWidth;}const next=`${S.view}:${S.editorTab}:${S.editorOpen}:${S.editorExpanded}`;if(panelKey&&next!==panelKey)pulse(document.querySelector(S.view==='mix'?'.mix-workspace':'.creation-workspace'),'panel-enter');panelKey=next;}
 function playback({project,S,B,engine,position}){
  const layer=document.querySelector('#note-layer');const t=project.tracks.find(t=>t.id===S.trackId),p=t?.patterns.find(p=>p.id===S.patternId);let tick=position,active=engine.playing&&!B.audition;
  if(B.target==='bar')tick+=S.page*G.BAR;
  if(['song','tracks'].includes(B.target)){const clip=t?.clips.find(c=>c.patternId===p?.id&&position>=c.bar*G.BAR&&position<(c.bar+(p?.bars||0))*G.BAR);if(!clip)active=false;else tick-=clip.bar*G.BAR;if(t?.mute||(B.soloIds.length&&!B.soloIds.includes(t?.id))||(B.target==='tracks'&&!B.selectedTrackIds.includes(t?.id)))active=false;}
  if(lastSong!==layer){sounding=new Set();lastSong=layer;}
  if(p&&(!processed||processedKey!==p.id)){processed=G.processPattern(p,t,project);processedKey=p.id;}
  const next=new Set(active&&p?processed.filter(e=>tick>=e.start&&tick<e.start+e.duration).map(e=>e.id.replace(/_arp\d+$/,'')):[]);
  for(const id of sounding)if(!next.has(id))layer?.querySelector(`[data-note="${id}"]`)?.classList.remove('is-sounding');
  for(const id of next)layer?.querySelector(`[data-note="${id}"]`)?.classList.add('is-sounding');sounding=next;
  const b=engine.playing?Math.floor(position/G.PPQ):-1;
  if(b!==beat){beat=b;document.querySelectorAll('.ruler-bars>div').forEach((el,i)=>el.classList.toggle('current-bar',b>=0&&i===Math.floor(position/G.BAR)));}
 }
 G.motion={reduced,clip,clearDrag,settle,afterRender,playback};
})(globalThis.GridTone ||= {});
