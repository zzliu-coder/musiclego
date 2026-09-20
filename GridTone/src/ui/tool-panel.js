/** Shared combinations. They read state supplied by controllers; they own no musical document. */
(function(G){'use strict';const U=()=>G.ui;
 // Presentation only: keep the panel identity and adoption controls outside its scrollport.
 G.ui.toolPanelLayout=function(content){if(!content)return '';return G.ui.PanelFrame(typeof content==='string'?{body:content}:content||{});};
 G.ui.InlineNotice=({tone='info',title='',text='',actions=''})=>`<div class="inline-notice" data-component="notice" data-tone="${tone}" role="${tone==='error'?'alert':'status'}">${U().icon(tone==='error'?'info':tone==='success'?'check':'info',16)}<div>${title?`<strong>${U().esc(title)}</strong>`:''}${text?`<p>${U().esc(text)}</p>`:''}${actions?`<div class="notice-actions">${actions}</div>`:''}</div></div>`;
 G.ui.ContextCard=({name,range,source,retained=0})=>`<div class="context-card" data-component="context"><strong>${U().esc(name)}</strong><div class="context-row"><span>${U().esc(range)}</span>${retained?`<span class="context-badge">保留 ${retained} 音</span>`:''}</div>${source?`<div class="context-row">跟随和弦 · ${U().esc(source)}</div>`:''}</div>`;
 G.ui.PreviewControls=({actions,context=''})=>`<div class="preview-controls" data-component="preview-controls">${actions}${context?`<span class="preview-context">${U().esc(context)}</span>`:''}</div>`;
 G.ui.PanelHeader=({title,subtitle='',closeAction='inspector-close'})=>`<header class="panel-header creation-dock-heading"><div><h2>${U().esc(title)}</h2>${subtitle?`<small>${U().esc(subtitle)}</small>`:''}</div>${U().ib(closeAction,'关闭面板','close')}</header>`;
 G.ui.NotePreview=function(notes,{bars,low=48,high=84,width=320,height=76}){const span=Math.max(12,high-low),length=bars*G.BAR;return `<svg class="comparison-score" viewBox="0 0 ${width} ${height}" role="img" aria-label="音乐方案，共用时间与音高坐标">${Array.from({length:bars+1},(_,i)=>`<line x1="${i/bars*width}" x2="${i/bars*width}" y1="0" y2="${height}" stroke="var(--line)"/>`).join('')}${notes.map(n=>`<rect x="${n.start/length*width}" y="${4+(high-n.pitch)/span*(height-10)}" width="${Math.max(1.5,n.duration/length*width-1)}" height="3" rx="1" fill="var(--brand)"/>`).join('')}</svg>`;};
 G.ui.projectionDiff=function(original,next,retention={}){
  const signature=n=>[n.pitch,n.start,n.duration,n.velocity].join(':'),before=new Map();for(const n of original){const key=signature(n);before.set(key,(before.get(key)||0)+1);}
  const ids=new Set((retention.notes||[]).filter(n=>n.all||n.pitch||n.rhythm).map(n=>n.id));let unchanged=0,changed=0;
  const items=next.map(n=>{const key=signature(n),same=(before.get(key)||0)>0;if(same){before.set(key,before.get(key)-1);unchanged++;}else changed++;const kept=ids.has(n.id)||(retention.ranges||[]).some(r=>n.start<r.end&&n.start+n.duration>r.start);const rule=(retention.notes||[]).find(v=>v.id===n.id),preserved=kept?(rule?.all?'全部保留':rule?.pitch&&rule?.rhythm?'音高与节奏':rule?.pitch?'保留音高':rule?.rhythm?'保留节奏':'范围与休止'):'';return {note:n,state:kept?'retained':same?'unchanged':'changed',preserved};});
  return {items,unchanged,changed,removed:[...before.values()].reduce((a,b)=>a+b,0)};
 };
})(globalThis.GridTone ||= {});
