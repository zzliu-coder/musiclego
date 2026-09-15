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
  function cancel(){if(!drag)return;const d=drag;drag=null;pending=null;cancelAnimationFrame(raf);raf=0;finishCapture(d);if(d.before)C.setProject(d.before);if(d.selection)S.selected=d.selection;if(d.type==='dock')S.editorHeight=d.height;if(d.type==='ruler')G.viewportFor(S,track()).low=d.low;render();}
  function drawCell(pt,mode,seen){const start=Math.floor(pt.tick/step())*step(),pitch=geo.rows[pt.row],key=start+':'+pitch;if(seen.has(key))return;seen.add(key);const p=pattern(),hits=p.notes.filter(n=>n.pitch===pitch&&n.start<=start&&n.start+n.duration>start);if(mode==='erase')p.notes=p.notes.filter(n=>!hits.includes(n));else if(!hits.length)p.notes.push(G.newNote(pitch,start,Math.min(step(),p.bars*G.BAR-start)));}
  function queue(e){pending={clientX:e.clientX,clientY:e.clientY};if(!raf)raf=requestAnimationFrame(flush);}
  function flush(){raf=0;if(!pending||!drag)return;const e=pending;pending=null;const d=drag;
   if(!d.moved&&Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)>=4){d.moved=true;clearTimeout(d.timer);}
   if(!d.moved)return;
   if(d.type==='dock'){S.editorHeight=G.clamp(d.height+d.clientY-e.clientY,180,Math.max(220,innerHeight-230));$('.studio-editor')?.style.setProperty('height',S.editorHeight+'px');return;}
   if(d.type==='time'){
    const r=d.ruler.getBoundingClientRect(),tick=G.clamp((e.clientX-r.left)/r.width*d.length,0,d.length);d.end=Math.round(tick/G.BAR)*G.BAR;
    const el=$('#loop-ghost');if(el){el.style.left=Math.min(d.start,d.end)/d.length*100+'%';el.style.width=Math.abs(d.end-d.start)/d.length*100+'%';}return;
   }
   if(d.type==='clip'){
    d.delta=Math.round((e.clientX-d.clientX)/d.barWidth);const lane=document.elementFromPoint(e.clientX,e.clientY)?.closest('.arrange-lane');d.targetId=lane?.dataset.track||d.trackId;
    const selected=G.clipSelection(C.getProject(),d.ids);d.delta=G.clamp(d.delta,-Math.min(...selected.map(x=>x.clip.bar)),C.getProject().bars-Math.max(...selected.map(x=>x.clip.bar+x.pattern.bars)));
    let valid=true;try{G.moveClips(d.before,d.ids,d.delta,d.targetId===d.trackId?null:d.targetId,d.copy);}catch{valid=false;}
    for(const id of d.ids){const el=document.querySelector(`[data-clip="${id}"]`);if(el){el.style.transform=`translateX(${d.delta*d.barWidth}px)`;el.classList.toggle('invalid',!valid);el.classList.add('dragging');}}
    d.valid=valid;return;
   }
   if(d.type==='pan'){d.scroll.scrollLeft=d.left+d.clientX-e.clientX;d.scroll.scrollTop=d.top+d.clientY-e.clientY;return;}
   if(d.type==='ruler'){G.viewportFor(S,track()).low=G.clamp(d.low+Math.round((e.clientY-d.clientY)/geo.row),0,127-G.viewportFor(S,track()).span);drawGrid();return;}
   if(!$('#note-grid'))return;const pt=point(e),p=pattern();
   const key=[d.type,snap(pt.tick),pt.row,d.type==='velocity'?Math.round(pt.y):0].join(':');
   if(key!==d.lastKey){d.lastKey=key;
    if(d.type==='draw'){const start=Math.min(d.start,Math.floor(pt.tick/step())*step()),end=Math.max(d.start,Math.floor(pt.tick/step())*step())+step();for(const n of p.notes)if(d.ids.includes(n.id)){n.start=start;n.duration=Math.min(p.bars*G.BAR,end)-start;}}
    if(d.type==='brush'){const last=d.lastPoint||d.pt,count=Math.max(1,Math.ceil(Math.abs(pt.tick-last.tick)/step()),Math.abs(pt.row-last.row));for(let i=0;i<=count;i++)drawCell({tick:last.tick+(pt.tick-last.tick)*i/count,row:Math.round(last.row+(pt.row-last.row)*i/count)},d.mode,d.seen);d.lastPoint=pt;}
    if(d.type==='move'||d.type==='resize'){
     let dt=snap(pt.tick-d.pt.tick),dp=track().kind==='drum'?0:geo.rows[pt.row]-geo.rows[d.pt.row];const orig=[...d.notes.values()];
     if(orig.length){if(d.type==='move'){dt=G.clamp(dt,-Math.min(...orig.map(n=>n.start)),p.bars*G.BAR-Math.max(...orig.map(n=>n.start+n.duration)));dp=G.clamp(dp,-Math.min(...orig.map(n=>n.pitch)),127-Math.max(...orig.map(n=>n.pitch)));}
      for(const n of p.notes){const o=d.notes.get(n.id);if(!o)continue;if(d.type==='move'){n.start=o.start+dt;n.pitch=o.pitch+dp;}else n.duration=G.clamp(o.duration+dt,step(),p.bars*G.BAR-o.start);}
     }
    }
    if(d.type==='marquee'){const a=Math.min(d.pt.tick,pt.tick),b=Math.max(d.pt.tick,pt.tick),r0=Math.min(d.pt.row,pt.row),r1=Math.max(d.pt.row,pt.row);S.selected=[...new Set([...(d.additive?d.selection:[]),...p.notes.filter(n=>n.start<b&&n.start+n.duration>a&&geo.rows.indexOf(n.pitch)>=r0&&geo.rows.indexOf(n.pitch)<=r1).map(n=>n.id)])];d.mx=pt.x;d.my=pt.y;}
    if(d.type==='velocity'){const vy=geo.top+geo.rows.length*geo.row+12,v=G.clamp(1-(pt.y-vy)/48,.01,1);for(const n of p.notes)if(S.selected.length?S.selected.includes(n.id):n.start>=Math.floor(pt.tick/step())*step()&&n.start<(Math.floor(pt.tick/step())+1)*step())n.velocity=v;}
    drawGrid();
   }
   const sc=$('#gridframe')?.parentElement;if(sc&&d.type!=='velocity'){const r=sc.getBoundingClientRect(),dx=e.clientX>r.right-28?12:e.clientX<r.left+75?-12:0,dy=e.clientY>r.bottom-24?10:e.clientY<r.top+24?-10:0;const x=sc.scrollLeft,y=sc.scrollTop;sc.scrollLeft+=dx;sc.scrollTop+=dy;if(x!==sc.scrollLeft||y!==sc.scrollTop){pending=e;raf=requestAnimationFrame(flush);}}
  }
  document.addEventListener('pointerdown',e=>{
   C.interact();if(drag||S.modal||e.button!==0)return;
   if(e.target.matches('input[type=range]')){C.beginRange();return;}
   const common={pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,moved:false,capture:e.target.closest('#gridframe,[data-clip],.ruler-bars,.dock-resize')};
   if(e.target.closest('.dock-resize')){drag={...common,type:'dock',height:S.editorHeight};e.preventDefault();drag.capture.setPointerCapture(e.pointerId);return;}
   const ruler=e.target.closest('.ruler-bars');if(ruler){const r=ruler.getBoundingClientRect(),length=C.getProject().bars*G.BAR;const start=G.clamp(Math.floor((e.clientX-r.left)/r.width*C.getProject().bars)*G.BAR,0,length-G.BAR);drag={...common,type:'time',ruler,length,start,end:start};ruler.setPointerCapture(e.pointerId);e.preventDefault();return;}
   const clip=e.target.closest('[data-clip]');if(clip){
    const id=clip.dataset.clip;if(e.shiftKey)S.clipIds=S.clipIds.includes(id)?S.clipIds.filter(x=>x!==id):[...S.clipIds,id];else if(!S.clipIds.includes(id))S.clipIds=[id];
    drag={...common,type:'clip',before:snapshot(),ids:[...S.clipIds],trackId:clip.dataset.track,delta:0,copy:e.altKey,barWidth:clip.parentElement.clientWidth/C.getProject().bars};clip.setPointerCapture(e.pointerId);e.preventDefault();return;
   }
   const frame=e.target.closest('#gridframe');if(!frame)return;
   if(S.tool==='pan'&&e.pointerType==='touch')return;const pt=point(e);e.preventDefault();frame.focus({preventScroll:true});
   if(pt.y<geo.top){if(pt.x>=geo.left)C.seekPattern?.(snap(pt.tick));return;}
   if(pt.x<geo.left){if(pt.y<geo.top+geo.rows.length*geo.row)drag={...common,type:'ruler',low:G.viewportFor(S,track()).low,pitch:geo.rows[pt.row]};else return;}
   else if(S.tool==='pan'){if(e.pointerType==='touch')return;const scroll=frame.parentElement;drag={...common,type:'pan',scroll,left:scroll.scrollLeft,top:scroll.scrollTop};}
   else{
    const before=snapshot(),selection=[...S.selected],n=hit(pt);S.cursor=snap(pt.tick);
    drag={...common,before,selection,pt,x:pt.x,y:pt.y,mx:pt.x,my:pt.y};
    if(pt.y>=geo.top+geo.rows.length*geo.row){drag.type='velocity';drag.moved=true;queue(e);}
    else if(S.tool==='select'&&!n){drag.type='marquee';drag.additive=e.shiftKey;if(!e.shiftKey)S.selected=[];}
    else if(S.tool==='erase'||track().kind==='drum'&&S.tool!=='select'){drag.type='brush';drag.mode=S.tool==='erase'||n?'erase':'draw';drag.seen=new Set();drawCell(pt,drag.mode,drag.seen);if(!n)preview(track(),geo.rows[pt.row],.1);}
    else if(n){
     if(e.shiftKey)S.selected=S.selected.includes(n.id)?S.selected.filter(id=>id!==n.id):[...S.selected,n.id];else if(!S.selected.includes(n.id))S.selected=[n.id];
     const edge=geo.left+(n.start+n.duration-geo.offset)/G.STEP*geo.cw;
     drag.type=track().kind!=='drum'&&pt.x>=edge-10&&n.start+n.duration<=geo.offset+geo.bars*G.BAR?'resize':'move';drag.notes=new Map(selectedNotes().map(n=>[n.id,G.clone(n)]));
     if(e.pointerType==='touch')drag.timer=setTimeout(()=>{if(drag&&!drag.moved){const ids=[...S.selected];cancel();S.selected=ids;C.noteMenu();}},600);
    }else{drag.type='draw';drag.start=Math.floor(pt.tick/step())*step();const pitch=S.inputSnap?G.snapPitch(geo.rows[pt.row],C.getProject().key,C.getProject().scale):geo.rows[pt.row];const notes=S.tool==='chord'?G.chordNotes(pitch,S.chord,drag.start,step()):[G.newNote(pitch,drag.start,Math.min(S.snap===0?G.STEP:step(),pattern().bars*G.BAR-drag.start))];pattern().notes.push(...notes);drag.ids=notes.map(n=>n.id);S.selected=drag.ids;preview(track(),pitch,.16);}
    drawGrid();
   }
   frame.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();queue(e);},{passive:false});
  document.addEventListener('pointerup',e=>{
   if(!drag||e.pointerId!==drag.pointer)return;if(pending)flush();cancelAnimationFrame(raf);raf=0;pending=null;const d=drag;drag=null;finishCapture(d);
   if(d.type==='dock'){G.saveWorkspace(S,C.getProject().id);render();return;}
   if(d.type==='time'){if(d.moved&&d.end!==d.start)C.setRange?.([Math.min(d.start,d.end),Math.max(d.start,d.end)]);else C.seek?.(d.start);render();return;}
   if(d.type==='ruler'){if(!d.moved)preview(track(),d.pitch);render();return;}
   if(d.type==='pan')return;
   if(d.type==='clip'){
    if(d.moved){if(d.valid)try{const result=G.moveClips(d.before,d.ids,d.delta,d.targetId===d.trackId?null:d.targetId,d.copy);C.setProject(result.project);S.clipIds=result.ids;markChanged(d.before);}catch(err){toast(err.message);}else toast('目标位置不可用，片段已回到原位。');}
    const first=G.clipSelection(C.getProject(),S.clipIds)[0];if(first){const opened=G.openPatternInSession(S,C.getProject(),{trackId:first.track.id,clipId:first.clip.id,edit:false});if(opened.changed)C.editorChanged?.();S.editorOpen=true;}render();return;
   }
   markChanged(d.before);render();
  });
  document.addEventListener('pointercancel',e=>{if(drag?.pointer===e.pointerId)cancel();});
  window.addEventListener('blur',()=>{cancel();C.commitRange();});
  document.addEventListener('keydown',e=>{
   const target=e.target instanceof Element?e.target:document.activeElement;if(!target?.matches)return;
   const mod=e.ctrlKey||e.metaKey;
   if(e.key==='Escape'&&drag){e.preventDefault();cancel();return;}
   if(e.target.closest('.dock-resize')&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();S.editorHeight=G.clamp(S.editorHeight+(e.key==='ArrowUp'?24:-24),180,Math.max(220,innerHeight-230));render();G.saveWorkspace(S,C.getProject().id);return;}
   if(S.modal){if(e.key==='Escape'){C.closeModal();e.preventDefault();}else if(e.key==='Enter'&&C.hasForm()&&!target.matches('button,select,textarea')){C.submitForm();e.preventDefault();}else G.ui.modal.keydown(e);return;}
   if(target.matches('input,textarea,select,[contenteditable=true]'))return;
   if(e.code==='Space'){if(target.closest('button,a,summary'))return;e.preventDefault();if(!e.repeat)C.togglePlay();return;}
   if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?C.redo():C.undo();return;}
   if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();G.downloadBlob(new Blob([JSON.stringify(C.getProject())],{type:'application/json'}),G.safeFilename(C.getProject().title)+'.gridtone');return;}
   const grid=target.closest('#gridframe');
   if(!grid&&S.view!=='edit'){
    if(e.key==='Enter'&&S.clipId){e.preventDefault();C.openPattern({clipId:S.clipId});}
    const action=mod&&e.key.toLowerCase()==='c'?'copy':mod&&e.key.toLowerCase()==='v'?'paste':mod&&e.key.toLowerCase()==='d'?'duplicate':['Delete','Backspace'].includes(e.key)?'delete':['ArrowLeft','ArrowRight'].includes(e.key)?e.key:null;
    if(action&&!target.closest('button,a,summary')){e.preventDefault();C.clipCommand?.(action);}return;
   }
   if(target.closest('button,a,summary'))return;
   if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();S.selected=pattern().notes.map(n=>n.id);drawGrid();return;}
   if(mod&&e.key.toLowerCase()==='c'){e.preventDefault();C.copyNotes();return;}
   if(mod&&e.key.toLowerCase()==='v'){e.preventDefault();C.pasteNotes();return;}
   if(['Delete','Backspace'].includes(e.key)){e.preventDefault();C.deleteNotes();return;}
   if(e.key==='Escape'){S.selected=[];drawGrid();return;}
   const tools={v:'select',b:'draw',e:'erase',h:'pan'};if(!mod&&tools[e.key]){S.tool=tools[e.key];render();return;}
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&S.selected.length){e.preventDefault();C.mutate(()=>{const ns=selectedNotes(),dt=e.key==='ArrowLeft'?-(e.altKey?1:step()):e.key==='ArrowRight'?(e.altKey?1:step()):0,dp=e.key==='ArrowUp'?(e.shiftKey?12:1):e.key==='ArrowDown'?-(e.shiftKey?12:1):0;if(ns.some(n=>n.start+dt<0||n.start+n.duration+dt>pattern().bars*G.BAR||n.pitch+dp<0||n.pitch+dp>127))return;ns.forEach(n=>{n.start+=dt;if(track().kind!=='drum')n.pitch+=dp;});});}
  });
  document.addEventListener('contextmenu',e=>{const frame=e.target.closest('#gridframe');if(!frame)return;e.preventDefault();if(drag)cancel();const pt=point(e);if(pt.y<geo.top||pt.x<geo.left)return;const n=hit(pt);if(n){if(!S.selected.includes(n.id))S.selected=[n.id];drawGrid();C.noteMenu();}});
  document.addEventListener('wheel',e=>{if(!e.target.closest('.grid-scroll')||!(e.ctrlKey||e.metaKey))return;e.preventDefault();C.zoom?.(e.deltaY<0?1:-1,e.clientX,e.clientY,e.shiftKey);},{passive:false});
  return {setGeometry:g=>geo={...geo,...g},getDrag:()=>drag,cancel};
 };
})(globalThis.GridTone ||= {});
