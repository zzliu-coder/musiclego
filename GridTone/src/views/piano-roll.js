/** Stable layers for the musical canvas; content is data, never a decorative asset. */
(function(G){G.views ||= {};let staticKey='';
 G.views.drawPianoRoll=function(C){
  const {project,S,track,pattern,getRows,drag,esc}=C,frame=document.querySelector('#gridframe');if(!frame)return;
  const t=track(),p=pattern(),rows=getRows(),vp=G.viewportFor(S,t),win=G.gridWindow(S,p),left=t.kind==='drum'?100:58,top=28,rh=t.kind==='drum'?32:vp.rowHeight;
  const width=Math.max(frame.parentElement.clientWidth-2,win.bars*200*vp.zoomX+left+12),cw=(width-left-12)/(win.bars*16),height=top+rows.length*rh+74;
  const geo={width,left,top,row:rh,cw,rows,height,offset:win.offset,bars:win.bars};
  const key=JSON.stringify([width,rows,rh,win,t.id,project.key,S.snap,S.showScale]);
  let svg=document.querySelector('#note-grid');
  if(!svg||key!==staticKey){
   staticKey=key;let bg=`<rect width="${width}" height="${height}" fill="var(--grid-paper)"/>`;
   rows.forEach((pitch,i)=>{const y=top+i*rh,black=[1,3,6,8,10].includes(pitch%12),root=pitch%12===project.key;bg+=`<rect x="${left}" y="${y}" width="${width-left}" height="${rh}" fill="${S.showScale&&G.inScale(pitch,project.key,project.scale)?'var(--selected)':black?'var(--grid-key)':'var(--grid-paper)'}"/><line x1="${left}" x2="${width}" y1="${y+rh}" y2="${y+rh}" stroke="var(--grid-minor)"/><rect data-ruler-pitch="${pitch}" x="0" y="${y}" width="${left-3}" height="${rh-1}" fill="${black?'var(--piano-black)':'var(--surface)'}"/><text x="${left-10}" y="${y+rh/2+4}" text-anchor="end" font-size="10" fill="${black?'white':'var(--muted)'}">${esc(t.kind==='drum'?(G.drumsFor(project,t).find(d=>d.pitch===pitch)?.name||pitch):G.noteName(pitch))}</text>`;});
   const gridStep=S.snap||G.STEP;for(let j=0;j<=win.bars*G.BAR/gridStep;j++){const i=j*gridStep/G.STEP,x=left+i*cw;bg+=`<line x1="${x}" x2="${x}" y1="${top}" y2="${top+rows.length*rh}" stroke="${i%16===0?'var(--grid-major)':i%4===0?'var(--line)':'var(--grid-minor)'}"/>`;if(i%16===0&&i<win.bars*16)bg+=`<text x="${x+8}" y="18" font-size="11" fill="var(--muted)">${win.offset/G.BAR+i/16+1}</text>`;}
   frame.querySelector('#grid-inner').innerHTML=`<svg id="note-grid" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="音符网格 · ${win.bars} 小节" data-left="${left}" data-low="${vp.low}" data-span="${vp.span}" data-row-height="${rh}" data-cell-width="${cw}"><g id="grid-background">${bg}</g><g id="note-layer"></g><g id="velocity-layer"></g><g id="selection-layer"></g><g id="playhead" visibility="hidden" pointer-events="none"><line x1="0" x2="0" y1="${top}" y2="${height}" stroke="var(--color-playhead)" stroke-width="1.5"/></g></svg>`;
   svg=document.querySelector('#note-grid');
  }
  let notes='',velocities='';const vy=top+rows.length*rh+12,selected=new Set(S.selected);
  for(const n of p.notes){if(n.start>=win.offset+win.bars*G.BAR||n.start+n.duration<=win.offset)continue;const row=rows.indexOf(n.pitch);if(row<0)continue;
   const x=left+(Math.max(win.offset,n.start)-win.offset)/G.STEP*cw+1,y=top+row*rh+3,nw=Math.max(3,(Math.min(win.offset+win.bars*G.BAR,n.start+n.duration)-Math.max(win.offset,n.start))/G.STEP*cw-2),sel=selected.has(n.id);
   notes+=`<g data-note="${n.id}" class="note ${sel?'chosen':''}" style="cursor:grab"><rect x="${x}" y="${y}" width="${nw}" height="${Math.max(6,rh-6)}" rx="3" fill="${t.color}" opacity="${.62+n.velocity*.38}" ${sel?'stroke="var(--ink)" stroke-width="1.5"':''}/>${nw>35&&rh>=16?`<text x="${x+5}" y="${y+rh/2}" font-size="9" fill="var(--ink)" pointer-events="none">${esc(G.noteName(n.pitch))}</text>`:''}${n.start+n.duration<=win.offset+win.bars*G.BAR?`<rect data-resize="${n.id}" x="${x+Math.max(0,nw-8)}" y="${y}" width="${Math.min(nw,8)}" height="${Math.max(6,rh-6)}" fill="transparent" style="cursor:ew-resize"/>`:''}</g>`;
   const vx=left+(n.start-win.offset)/G.STEP*cw;
   if(vx>=left)velocities+=`<rect data-note="v-${n.id}" x="${vx}" y="${vy+48*(1-n.velocity)}" width="${sel?5:3}" height="${48*n.velocity}" rx="1" fill="${sel?'var(--brand)':t.color}" opacity="${selected.size&&!sel ? .35 : .8}"/>`;
  }
  // SVG-aware keyed patching avoids replacing capture targets and static grid lines.
  function layer(id,html){const el=document.getElementById(id);if(el.dataset.markup===html)return;el.dataset.markup=html;const container=document.createElementNS('http://www.w3.org/2000/svg','g');container.innerHTML=html;const old=new Map([...el.children].map(n=>[n.getAttribute('data-note'),n]));for(const n of [...container.children]){const prev=old.get(n.getAttribute('data-note'));if(prev){old.delete(n.getAttribute('data-note'));if(prev.outerHTML!==n.outerHTML)prev.replaceWith(n);}else el.append(n);}for(const n of old.values())n.remove();}
  layer('note-layer',notes);layer('velocity-layer',velocities);
  const selection=document.querySelector('#selection-layer');selection.innerHTML=drag?.type==='marquee'?`<rect x="${Math.min(drag.x,drag.mx)}" y="${Math.min(drag.y,drag.my)}" width="${Math.abs(drag.mx-drag.x)}" height="${Math.abs(drag.my-drag.y)}" fill="var(--brand)" fill-opacity=".09" stroke="var(--brand)"/>`:'';
  return geo;
 };
})(globalThis.GridTone ||= {});
