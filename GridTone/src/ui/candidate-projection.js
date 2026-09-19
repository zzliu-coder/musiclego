/** Read-only overlay in the existing editor coordinates. No musical IDs, no hit targets. */
(function(G){'use strict';
 G.ui.drawCandidateProjection=function(data,geo){
  const svg=document.querySelector('#note-grid'),status=document.querySelector('#candidate-overlay-status');
  if(!svg){if(status)status.hidden=true;return;}
  let layer=svg.querySelector('#candidate-projection');if(!layer){layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.id='candidate-projection';layer.setAttribute('pointer-events','none');layer.setAttribute('aria-hidden','true');svg.insertBefore(layer,svg.querySelector('#playhead'));}
  const original=svg.querySelector('#note-layer');original?.classList.toggle('preview-original-dim',!!data);
  if(!data){layer.replaceChildren();if(status){status.hidden=true;status.replaceChildren();}return;}
  const {left,top,row:rh,cw,rows,offset=0,bars=1,width}=geo,diff=G.ui.projectionDiff(data.original,data.notes,data.retention);let hidden=0;
  const markup=diff.items.map(({note:n,state,preserved})=>{if(n.start>=offset+bars*G.BAR||n.start+n.duration<=offset)return '';const row=rows.indexOf(n.pitch);if(row<0){hidden++;return '';}
   const x=left+(Math.max(offset,n.start)-offset)/G.STEP*cw+1,y=top+row*rh+3,w=Math.max(3,(Math.min(offset+bars*G.BAR,n.start+n.duration)-Math.max(offset,n.start))/G.STEP*cw-2),h=Math.max(6,rh-6);
   return `<rect class="projection-note" data-state="${state}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"><title>${G.ui.esc(preserved|| (state==='changed'?'方案变化':'保持原样'))}</title></rect>${state==='retained'?`<path d="M${x+3} ${y+3}h4v4h-4z" fill="var(--success)"/>`:state==='changed'?`<path d="M${x+3} ${y+3}h4m-2-2v4" stroke="var(--brand)" stroke-width="1"/>`:''}`;
  }).join('');layer.innerHTML=markup;
  if(status){status.hidden=false;status.innerHTML=`<div><strong>方案 ${data.index+1} · 尚未采用</strong><div class="projection-legend"><span><i></i>虚线 / ＋ 变化</span><span><i class="kept"></i>实框 / ■ 含保留项</span></div></div><span>画板仍可编辑原稿${hidden?' · '+hidden+' 音在视野外':''}</span>${G.ui.button('creation-overlay','只看原稿','','quiet small-btn','data-overlay="original"')}`;}
 };
})(globalThis.GridTone ||= {});
