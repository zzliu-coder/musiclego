/** Pointer transactions: threshold -> preview -> one commit, or a complete rollback. */
(function(G){'use strict';
 G.createEditorInteractions=function(C){
  const {S,track,pattern,snapshot,markChanged,render,drawGrid,preview,selectedNotes,toast}=C;
  const $=s=>document.querySelector(s);let drag=null,raf=0,pending=null;
  let geo={width:960,left:72,top:30,row:24,cw:55,rows:[],height:0,offset:0,bars:1};
  const step=()=>G.snapTicks?G.snapTicks(S):G.STEP;
  const snap=t=>Math.round(t/step())*step();
  function point(e){const r=$('#note-grid').getBoundingClientRect(),x=(e.clientX-r.left)*geo.width/r.width,y=(e.clientY-r.top)*geo.height/r.height;return {x,y,tick:G.clamp(geo.offset+(x-geo.left)/geo.cw*G.STEP,geo.offset,geo.offset+geo.bars*G.BAR-1),row:G.clamp(Math.floor((y-geo.top)/geo.row),0,geo.rows.length-1)};}
  function hit(pt){return [...pattern().notes].reverse().find(n=>n.pitch===geo.rows[pt.row]&&pt.tick>=n.start&&pt.tick<n.start+n.duration);}
  function finishCapture(d){clearTimeout(d?.timer);try{if(d?.capture?.hasPointerCapture?.(d.pointer))d.capture.releasePointerCapture(d.pointer);}catch{}}
  function cancel(){if(!drag)return;G.motion?.clearDrag();const d=drag;drag=null;pending=null;cancelAnimationFrame(raf);raf=0;finishCapture(d);if(d.before)C.setProject(d.before);if(d.selection)S.selected=d.selection;if(d.editTarget)S.editTarget=d.editTarget;if(d.type==='dock')S[d.heightKey]=d.height;if(d.type==='ruler'||d.type==='pan'&&Number.isFinite(d.low))G.viewportFor(S,track()).low=d.low;render();}
  function drawCell(pt,mode,seen){const start=Math.floor(pt.tick/step())*step(),pitch=geo.rows[pt.row],key=start+':'+pitch;if(seen.has(key))return;seen.add(key);const p=pattern(),hits=p.notes.filter(n=>n.pitch===pitch&&n.start<=start&&n.start+n.duration>start);if(mode==='erase')p.notes=p.notes.filter(n=>!hits.includes(n));else if(!hits.length)p.notes.push(G.newNote(pitch,start,Math.min(step(),p.bars*G.BAR-start)));}
  function queue(e){pending={clientX:e.clientX,clientY:e.clientY};if(!raf)raf=requestAnimationFrame(flush);}
  function flush(){raf=0;if(!pending||!drag)return;const e=pending;pending=null;const d=drag;
   if(!d.moved&&Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)>=4){d.moved=true;clearTimeout(d.timer);}
   if(!d.moved)return;
   if(d.type==='dock'){S[d.heightKey]=G.clamp(d.height+d.clientY-e.clientY,240,900);$('.studio-editor')?.style.setProperty('height',S[d.heightKey]+'px');$('.studio-shell')?.style.setProperty('--studio-dock-height',S[d.heightKey]+'px');drawGrid();return;}
   if(d.type==='time'){
    const r=d.ruler.getBoundingClientRect(),tick=G.clamp((e.clientX-r.left)/r.width*d.length,0,d.length);d.end=Math.round(tick/G.BAR)*G.BAR;
    const el=$('#loop-ghost');if(el){el.style.left=Math.min(d.start,d.end)/d.length*100+'%';el.style.width=Math.abs(d.end-d.start)/d.length*100+'%';}return;
   }
   if(d.type==='clip'){
    if(!d.ids.length)return;
    d.delta=Math.round((e.clientX-d.clientX)/d.barWidth);const lane=document.elementFromPoint(e.clientX,e.clientY)?.closest('.arrange-lane');d.targetId=lane?.dataset.track||d.trackId;
    const selected=G.clipSelection(C.getProject(),d.ids);d.delta=G.clamp(d.delta,-Math.min(...selected.map(x=>x.clip.bar)),C.getProject().bars-Math.max(...selected.map(x=>x.clip.bar+x.pattern.bars)));
    const validationKey=[d.delta,d.targetId,!!lane].join(':');let valid=d.valid;if(validationKey!==d.validationKey){d.validationKey=validationKey;valid=!!lane;d.invalidReason=lane?'':'请放入音轨';try{G.moveClips(d.before,d.ids,d.delta,d.targetId===d.trackId?null:d.targetId,d.copy);}catch(err){valid=false;d.invalidReason=err.message;}}
    for(const id of d.ids){const el=document.querySelector(`[data-clip="${id}"]`);if(el){el.style.transform=`translateX(${d.delta*d.barWidth}px)`;el.classList.toggle('invalid',!valid);el.classList.add('dragging');}}
    d.valid=valid;G.motion?.clip(d,e,C.getProject());return;
   }
   if(d.type==='pan'){d.scroll.scrollLeft=d.left+d.clientX-e.clientX;if(track().kind==='drum')d.scroll.scrollTop=d.top+d.clientY-e.clientY;else {G.viewportFor(S,track()).low=G.clamp(d.low+Math.round((e.clientY-d.clientY)/geo.row),0,127-G.viewportFor(S,track()).span);drawGrid();}return;}
   if(d.type==='ruler'&&track().kind==='drum'){const sc=$('#gridframe').parentElement;sc.scrollTop=d.top+d.clientY-e.clientY;return;}
   if(d.type==='ruler'){G.viewportFor(S,track()).low=G.clamp(d.low+Math.round((e.clientY-d.clientY)/geo.row),0,127-G.viewportFor(S,track()).span);drawGrid();return;}
   if(!$('#note-grid'))return;const pt=point(e),p=pattern();
   const key=[d.type,snap(pt.tick),pt.row,d.type==='velocity'?Math.round(pt.y):0].join(':');
   if(key!==d.lastKey){d.lastKey=key;
    if(d.type==='draw'){const start=Math.min(d.start,Math.floor(pt.tick/step())*step()),end=Math.max(d.start,Math.floor(pt.tick/step())*step())+step();for(const n of p.notes)if(d.ids.includes(n.id)){n.start=start;n.duration=Math.min(p.bars*G.BAR,end)-start;}}
    if(d.type==='brush'){const last=d.lastPoint||d.pt,count=Math.max(1,Math.ceil(Math.abs(pt.tick-last.tick)/step()),Math.abs(pt.row-last.row));for(let i=0;i<=count;i++)drawCell({tick:last.tick+(pt.tick-last.tick)*i/count,row:Math.round(last.row+(pt.row-last.row)*i/count)},d.mode,d.seen);d.lastPoint=pt;}
    if(d.type==='move'||d.type==='resize'){
     let dt=snap(pt.tick-d.pt.tick),dp=track().kind==='drum'?0:geo.rows[pt.row]-geo.rows[d.pt.row];const orig=[...d.notes.values()];
     if(orig.length){if(d.type==='move'){dt=G.clamp(dt,-Math.min(...orig.map(n=>n.start)),p.bars*G.BAR-Math.max(...orig.map(n=>n.start+n.duration)));dp=G.clamp(dp,-Math.min(...orig.map(n=>n.pitch)),127-Math.max(...orig.map(n=>n.pitch)));}
      for(const n of p.notes){const o=d.notes.get(n.id);if(!o)continue;if(d.type==='move'){n.start=o.start+dt;n.pitch=o.pitch+dp;}else n.duration=G.clamp(o.duration+dt,1,p.bars*G.BAR-o.start);}
     }
    }
    if(d.type==='range'){const start=Math.max(0,Math.min(d.pt.tick,pt.tick)),end=Math.min(p.bars*G.BAR,Math.max(d.pt.tick,pt.tick)+step());const range={start:Math.floor(start/step())*step(),end:Math.min(p.bars*G.BAR,Math.ceil(end/step())*step())};G.setEditTarget(S,C.getProject(),{kind:'range',trackId:S.trackId,patternId:S.patternId,clipId:S.clipId,range});S.cursor=range.start;}
    if(d.type==='marquee'){const a=Math.min(d.pt.tick,pt.tick),b=Math.max(d.pt.tick,pt.tick),r0=Math.min(d.pt.row,pt.row),r1=Math.max(d.pt.row,pt.row);S.selected=[...new Set([...(d.additive?d.selection:[]),...p.notes.filter(n=>n.start<b&&n.start+n.duration>a&&geo.rows.indexOf(n.pitch)>=r0&&geo.rows.indexOf(n.pitch)<=r1).map(n=>n.id)])];d.mx=pt.x;d.my=pt.y;}
    if(d.type==='velocity'){const vy=geo.top+geo.rows.length*geo.row+12,v=G.clamp(1-(pt.y-vy)/48,.01,1);for(const n of p.notes)if(S.selected.length?S.selected.includes(n.id):n.start>=Math.floor(pt.tick/step())*step()&&n.start<(Math.floor(pt.tick/step())+1)*step())n.velocity=v;}
    if(d.type!=='range')G.activateNotes(S,C.getProject());C.selectionChanged?.();drawGrid();
   }
   const sc=$('#gridframe')?.parentElement;if(sc&&d.type!=='velocity'){const r=sc.getBoundingClientRect(),dx=e.clientX>r.right-28?12:e.clientX<r.left+75?-12:0,dy=e.clientY>r.bottom-24?10:e.clientY<r.top+24?-10:0;const x=sc.scrollLeft,y=sc.scrollTop;sc.scrollLeft+=dx;sc.scrollTop+=dy;if(x!==sc.scrollLeft||y!==sc.scrollTop){pending=e;raf=requestAnimationFrame(flush);}}
  }
  document.addEventListener('pointerdown',e=>{
   C.interact();if(drag||S.modal||e.button!==0)return;
   if(e.target.matches('input[type=range]')){C.beginRange();return;}
   const common={pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,moved:false,capture:e.target.closest('#gridframe,[data-clip],.ruler-bars,.dock-resize')};
   if(e.target.closest('.dock-resize')){drag={...common,type:'dock',heightKey:'editorHeight',height:S.editorHeight};e.preventDefault();drag.capture.setPointerCapture(e.pointerId);return;}
   const ruler=e.target.closest('.ruler-bars');if(ruler){const r=ruler.getBoundingClientRect(),length=C.getProject().bars*G.BAR;const start=G.clamp(Math.floor((e.clientX-r.left)/r.width*C.getProject().bars)*G.BAR,0,length-G.BAR);drag={...common,type:'time',ruler,length,start,end:start};ruler.setPointerCapture(e.pointerId);e.preventDefault();return;}
   const clip=e.target.closest('[data-clip]');if(clip){
    clip.focus({preventScroll:true});const id=clip.dataset.clip;if(e.shiftKey)S.clipIds=S.clipIds.includes(id)?S.clipIds.filter(x=>x!==id):[...S.clipIds,id];else if(!S.clipIds.includes(id))S.clipIds=[id];
    G.activateClips(S,C.getProject(),S.clipIds,clip.dataset.track);C.selectionChanged?.();
    drag={...common,type:'clip',before:snapshot(),ids:[...S.clipIds],trackId:clip.dataset.track,delta:0,copy:e.altKey,barWidth:clip.parentElement.clientWidth/C.getProject().bars};clip.setPointerCapture(e.pointerId);e.preventDefault();return;
   }
   const frame=e.target.closest('#gridframe');if(!frame)return;
   if(S.tool==='pan'&&e.pointerType==='touch')return;const pt=point(e);e.preventDefault();frame.focus({preventScroll:true});
   if(pt.y<geo.top){if(pt.x>=geo.left){S.cursor=snap(pt.tick);G.activateNotes(S,C.getProject());C.selectionChanged?.();C.seekPattern?.(S.cursor);drawGrid();}return;}
   if(e.target.closest('[data-pitch-axis]')||pt.x<geo.left){if(pt.y<geo.top+geo.rows.length*geo.row)drag={...common,type:'ruler',top:frame.parentElement.scrollTop,low:G.viewportFor(S,track()).low,pitch:geo.rows[pt.row]};else return;}
   else if(S.tool==='pan'){if(e.pointerType==='touch')return;const scroll=frame.parentElement;drag={...common,type:'pan',scroll,left:scroll.scrollLeft,top:scroll.scrollTop,low:G.viewportFor(S,track()).low};}
   else{
    const before=snapshot(),selection=[...S.selected],editTarget=G.clone(S.editTarget),n=hit(pt);S.cursor=snap(pt.tick);
    drag={...common,before,selection,editTarget,pt,x:pt.x,y:pt.y,mx:pt.x,my:pt.y};
    if(S.tool==='range'&&pt.y<geo.top+geo.rows.length*geo.row){drag.type='range';const start=Math.floor(pt.tick/step())*step();G.setEditTarget(S,C.getProject(),{kind:'range',trackId:S.trackId,patternId:S.patternId,clipId:S.clipId,range:{start,end:Math.min(pattern().bars*G.BAR,start+step())}});}
    else if(pt.y>=geo.top+geo.rows.length*geo.row){drag.type='velocity';drag.moved=true;queue(e);}
    else if(S.tool==='select'&&!n){drag.type='marquee';drag.additive=e.shiftKey;if(!e.shiftKey)S.selected=[];}
    else if(S.tool==='erase'||track().kind==='drum'&&S.tool!=='select'){drag.type='brush';drag.mode=S.tool==='erase'||n?'erase':'draw';drag.seen=new Set();drawCell(pt,drag.mode,drag.seen);if(!n)preview(track(),geo.rows[pt.row],.1);}
    else if(n){
     if(e.shiftKey)S.selected=S.selected.includes(n.id)?S.selected.filter(id=>id!==n.id):[...S.selected,n.id];else if(!S.selected.includes(n.id))S.selected=[n.id];
     const edge=geo.left+(n.start+n.duration-geo.offset)/G.STEP*geo.cw;
     drag.type=track().kind!=='drum'&&pt.x>=edge-10&&n.start+n.duration<=geo.offset+geo.bars*G.BAR?'resize':'move';drag.notes=new Map(selectedNotes().map(n=>[n.id,G.clone(n)]));
     if(e.pointerType==='touch')drag.timer=setTimeout(()=>{if(drag&&!drag.moved){const ids=[...S.selected];cancel();S.selected=ids;C.noteMenu();}},600);
    }else{drag.type='draw';drag.start=Math.floor(pt.tick/step())*step();const pitch=S.inputSnap?G.snapPitch(geo.rows[pt.row],C.getProject().key,C.getProject().scale):geo.rows[pt.row];const notes=S.tool==='chord'?G.chordNotes(pitch,S.chord,drag.start,step()):[G.newNote(pitch,drag.start,Math.min(S.snap===0?G.STEP:step(),pattern().bars*G.BAR-drag.start))];pattern().notes.push(...notes);drag.ids=notes.map(n=>n.id);S.selected=drag.ids;preview(track(),pitch,.16);}
    if(drag.type!=='range')G.activateNotes(S,C.getProject());C.selectionChanged?.();drawGrid();
   }
   frame.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();queue(e);},{passive:false});
  document.addEventListener('pointerup',e=>{
   if(!drag||e.pointerId!==drag.pointer)return;if(pending)flush();cancelAnimationFrame(raf);raf=0;pending=null;const d=drag;drag=null;finishCapture(d);G.motion?.clearDrag();
   if(d.type==='dock'){G.saveWorkspace(S,C.getProject().id);render();return;}
   if(d.type==='time'){if(d.moved&&d.end!==d.start)C.setRange?.([Math.min(d.start,d.end),Math.max(d.start,d.end)]);else C.seek?.(d.start);render();return;}
   if(d.type==='ruler'){if(!d.moved)preview(track(),d.pitch);render();return;}
   if(d.type==='pan'){G.saveWorkspace(S,C.getProject().id);return;}
   if(d.type==='clip'){
    if(d.moved){if(d.valid)try{const result=G.moveClips(d.before,d.ids,d.delta,d.targetId===d.trackId?null:d.targetId,d.copy);C.setProject(result.project);S.clipIds=result.ids;d.resultIds=result.ids;markChanged(d.before);}catch(err){toast(err.message);}else toast('目标位置不可用，音乐块已回到原位。');}
    const first=G.clipSelection(C.getProject(),S.clipIds)[0];if(first){const opened=G.openPatternInSession(S,C.getProject(),{trackId:first.track.id,clipId:first.clip.id,edit:false});if(opened.changed)C.editorChanged?.();if(!S.editorManuallyClosed)S.editorOpen=true;G.activateClips(S,C.getProject(),S.clipIds,first.track.id);}render();if(d.moved&&d.valid)G.motion?.settle(d);return;
   }
   if(d.type==='range'||d.type==='marquee'){if(d.type==='marquee')G.activateNotes(S,C.getProject());render();return;}
   G.activateNotes(S,C.getProject());markChanged(d.before);render();G.motion?.settle(d);
  });
  document.addEventListener('pointercancel',e=>{if(drag?.pointer===e.pointerId)cancel();});
  window.addEventListener('blur',()=>{cancel();C.commitRange();});
  document.addEventListener('keydown',e=>{
   const target=e.target instanceof Element?e.target:document.activeElement;if(!target?.matches)return;
   const mod=G.keymap?.platform()==='mac'?e.metaKey&&!e.ctrlKey:e.ctrlKey&&!e.metaKey;
   if(e.defaultPrevented||e.isComposing||e.keyCode===229)return;
   if(e.key==='Escape'&&drag){e.preventDefault();cancel();return;}
   if(target.closest('.dock-resize')&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();S.editorHeight=G.clamp(S.editorHeight+(e.key==='ArrowUp'?24:-24),240,900);render();G.saveWorkspace(S,C.getProject().id);return;}
   if(S.modal){if(e.key==='Escape'){C.closeModal();e.preventDefault();}else if(e.key==='Enter'&&C.hasForm()&&!target.matches('button,select,textarea')){C.submitForm();e.preventDefault();}else G.ui.modal.keydown(e);return;}
   if(document.querySelector('#studio-library')&&!target.closest('.topbar')&&!G.keymap?.textTarget(target))return;
   const mapped=G.keymap?.resolve(e,{modal:S.modal});
   if(mapped==='save'){e.preventDefault();if(!e.repeat)C.save?.();return;}
   if(G.keymap?.textTarget(target)||target.closest('input,textarea,select,[contenteditable=true]'))return;
   if(mapped==='undo'||mapped==='redo'){e.preventDefault();if(!e.repeat)(mapped==='undo'?C.undo:C.redo)();return;}
   if(['copy','cut','paste','duplicate','select-all','delete'].includes(mapped)){
    const available=G.editCommandState(C.getProject(),S,mapped).enabled;
    if(available||mapped==='paste'&&S.editTarget?.kind!=='none'){
     e.preventDefault();if(!e.repeat)(mapped==='paste'?C.pasteSystem?.():C.runEdit?.(mapped));
    }return;
   }
   if(e.code==='Space'){if(target.closest('button,a,summary'))return;e.preventDefault();if(!e.repeat)C.togglePlay();return;}
   const a=G.resolveEditTarget(C.getProject(),S);
   if(e.key==='Enter'&&target.closest('[data-clip]')){const c=target.closest('[data-clip]');e.preventDefault();C.openPattern({trackId:c.dataset.track,clipId:c.dataset.clip,edit:true});return;}
   if(target.closest('button,a,summary'))return;
   if(e.key==='Escape'){G.setEditTarget(S,C.getProject(),{kind:'none'});S.selected=[];S.clipIds=[];render();return;}
   const isNotes=['notes','range'].includes(a.kind),grid=target.closest('#gridframe');
   const tools={v:'select',b:'draw',r:'range',e:'erase',h:'pan'};if(S.view!=='mix'&&(grid||isNotes)&&!mod&&tools[e.key]){S.tool=tools[e.key];render();return;}
   if(a.kind==='clips'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();C.clipCommand(e.key);return;}
   if(isNotes&&a.kind==='notes'&&a.ids.length&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();const original={...a};C.mutate(()=>{const p=C.getProject().tracks.find(t=>t.id===a.trackId).patterns.find(p=>p.id===a.patternId),ns=p.notes.filter(n=>a.ids.includes(n.id));
     const dt=e.key==='ArrowLeft'?-(e.altKey?1:step()):e.key==='ArrowRight'?(e.altKey?1:step()):0,dp=a.track.kind==='drum'?0:e.key==='ArrowUp'?(e.shiftKey?12:1):e.key==='ArrowDown'?-(e.shiftKey?12:1):0;
     if(ns.some(n=>n.start+dt<0||n.start+n.duration+dt>p.bars*G.BAR||n.pitch+dp<0||n.pitch+dp>127))throw Error('移动超出乐句或音域。');ns.forEach(n=>{n.start+=dt;n.pitch+=dp;});
    });
   }
  });
  document.addEventListener('contextmenu',e=>{const frame=e.target.closest('#gridframe');if(!frame)return;e.preventDefault();if(drag)cancel();const pt=point(e);if(pt.y<geo.top||pt.x<geo.left)return;const n=hit(pt);if(n){if(!S.selected.includes(n.id))S.selected=[n.id];G.activateNotes(S,C.getProject());C.selectionChanged?.();drawGrid();C.noteMenu();}});
  document.addEventListener('wheel',e=>{if(!e.target.closest('.grid-scroll')||!(e.ctrlKey||e.metaKey))return;e.preventDefault();C.zoom?.(e.deltaY<0?1:-1,e.clientX,e.clientY,e.shiftKey);},{passive:false});
  return {setGeometry:g=>geo={...geo,...g},getDrag:()=>drag,cancel};
 };
})(globalThis.GridTone ||= {});
