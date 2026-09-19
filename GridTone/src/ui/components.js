/** Shared visual primitives; UI size tokens live in styles/tokens.css. */
(function (G) {
    'use strict';
    const { BAR } = G;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ICONS = { range:'M4 5v14m16-14v14M4 12h16m-12-3-3 3 3 3m8-6 3 3-3 3', play: 'M8 5v14l11-7z', pause: 'M8 5v14M16 5v14', stop: 'M6 6h12v12H6z', loop: 'M4 10V7h13l-3-3M20 14v3H7l3 3', undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6', redo: 'm15 5 5 5-5 5m5-5H11a6 6 0 0 0-6 6', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'm6 6 12 12M18 6 6 18', chevron: 'm9 5 7 7-7 7', down: 'm6 9 6 6 6-6', arrow: 'M5 12h14m-5-5 5 5-5 5', check: 'm5 12 4 4L19 6', save: 'M5 4h12l3 3v13H4V4h1m2 0v6h10V4M8 20v-7h8v7', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', upload: 'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4', pencil: 'm4 16 12-12 4 4L8 20H4zm9-9 4 4', eraser: 'm4 13 9-9 7 7-9 9H8zm3 4 7-7M11 20h10', select: 'M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4', hand: 'M6 12V8a2 2 0 0 1 4 0v4-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v5-2a2 2 0 0 1 4 0v6c0 5-4 6-8 6-4 0-6-3-7-5l-3-5 3-2 3 4', chord: 'M5 6v14m7-17v17m7-12v12M3 6h4m3-3h4m3 5h4', arrange: 'M3 5h8v4H3zm10 0h8v4h-8zM3 15h5v4H3zm7 0h11v4H10z', wave: 'M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4', mix: 'M6 3v6m0 4v8m6-18v11m0 4v3m6-18v3m0 4v11M3 9h6m0 5h6m0-8h6', copy: 'M9 9h11v11H9zM15 5V3H3v12h2', trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7', reverse: 'M4 8h16l-4-4m4 12H4l4 4', mirror: 'M12 2v20M8 7l-5 5 5 5zm8 0 5 5-5 5z', octave: 'M5 19V5m-3 3 3-3 3 3M12 5h8m-4 0v14m-4 0h8', spark: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z', headphones: 'M4 14v-2a8 8 0 0 1 16 0v2M4 13h4v8H4zm12 0h4v8h-4z', piano: 'M3 4h18v16H3zm6 0v16m6-16v16M7 4v8h4V4m2 0v8h4V4', drum: 'M3 9c0-5 18-5 18 0m-18 0c0 5 18 5 18 0v9c0 5-18 5-18 0zM7 3l10 8M17 3 7 11', bass: 'M12 4v11m0-11 7-2v4l-7 2M12 16c0 4-8 5-8 1s8-5 8-1', melody: 'M8 18V5l12-2v13M8 18c0 4-6 4-6 1s6-4 6-1m12-2c0 4-6 4-6 1s6-4 6-1M8 9l12-2', help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v.2', info: 'M12 10v7m0-10v.1', folder: 'M3 6h7l2 2h9v12H3z', file: 'M5 3h9l5 5v13H5zm9 0v6h5M8 13h8m-8 4h6', mic: 'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0zM6 10v2a6 6 0 0 0 12 0v-2m-6 8v4m-4 0h8', volume: 'M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14', menu: 'M4 6h16M4 12h16M4 18h16', lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4', search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z', split: 'M12 3v18M8 7H3v10h5m8-10h5v10h-5', link: 'm9 15 6-6M8 17l-2 2a4 4 0 0 1-5-5l5-5m12-2 2-2a4 4 0 0 1 5 5l-5 5', dots: 'M5 12h.01M12 12h.01M19 12h.01' };
    const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.wave}"/></svg>`;
    const button = (action, label, ic = '', cls = '', attrs = '') => {
        const variant=cls.includes('dark-btn')?'primary':cls.includes('danger')?'danger':cls.includes('soft-btn')?'secondary':'quiet';
        const size=cls.includes('audition-key')?'key':cls.includes('play-btn')?'transport':cls.includes('icon-btn')?'icon':cls.includes('small-btn')?'small':'normal';
        const pressed=/aria-pressed=/.test(attrs)?'':(/(?:^|\s)(?:active|on)(?:\s|$)/.test(cls)?'aria-pressed="true"':'');
        return `<button type="button" class="btn ${cls}" data-variant="${variant}" data-size="${size}" data-component="${size==='transport'?'transport':size==='key'?'musical-key':size==='icon'?'icon-button':'action-button'}" data-action="${action}" ${pressed} ${attrs}>${ic ? icon(ic) : ''}${label ? `<span>${label}</span>` : ''}</button>`;
    };
    const ib = (action, label, ic, attrs = '') => button(action, '', ic, 'icon-btn', `title="${label}" aria-label="${label}" ${attrs}`);

    function miniPattern(p, t, w = 200, h = 35) { const min = p.notes.length ? Math.min(...p.notes.map(n => n.pitch)) : 48, max = p.notes.length ? Math.max(...p.notes.map(n => n.pitch)) : 72, span = Math.max(12, max - min + 1); return `<svg class="mini-pattern" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${[1, 2, 3].map(i => `<line x1="${w * i / 4}" x2="${w * i / 4}" y1="0" y2="${h}" stroke="currentColor" opacity=".1"/>`).join('')}${p.notes.map(n => { const x = n.start / (p.bars * BAR) * w, y = (max - n.pitch) / span * (h - 5) + 2; return `<rect x="${x}" y="${y}" width="${Math.max(2, n.duration / (p.bars * BAR) * w - 1)}" height="${t.kind === 'drum' ? 4 : 3}" rx="1.3" fill="currentColor" opacity="${.4 + .6 * n.velocity}"/>`; }).join('')}</svg>`; }
    function slider(label, group, key, value, min = 0, max = 1, step = .01, display = '', id = '') { return `<label class="slider-control"><span>${label}<b data-readout="${group}.${key}">${display || G.ui.format.parameter(group,key,value)}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-range="${group}.${key}" ${id ? `data-track="${id}"` : ''} aria-label="${label}"></label>`; }
    G.UI_METRICS = Object.freeze({ barWidth: 96, trackHead: 216, clipInset: 3 });
    G.ui = { ...G.ui, esc, icon, button, ib, miniPattern, slider };
    G.ui.Button = ({action,label,icon:ic='',variant='secondary',size='normal',disabled=false,busy=false,pressed}) => {
        const variants={primary:'dark-btn',secondary:'soft-btn',quiet:'quiet',danger:'danger-btn'};
        if(!variants[variant]||!['normal','icon','small'].includes(size))throw Error('组件变体或尺寸无效。');
        return button(esc(action),size==='icon'?'':esc(label),ic,variants[variant]+(size==='icon'?' icon-btn':''),`${disabled||busy?'disabled':''} ${busy?'aria-busy="true"':''} ${pressed===undefined?'':`aria-pressed="${!!pressed}"`} aria-label="${esc(label)}"`).replace('data-size="normal"',`data-size="${size}"`);
    };
    G.ui.IconButton = options => G.ui.Button({...options,size:'icon'});
    G.ui.Toggle = ({field,label,checked=false,disabled=false}) => `<label class="field-row"><span>${esc(label)}</span><input type="checkbox" role="switch" data-field="${esc(field)}" aria-label="${esc(label)}" ${checked?'checked':''} ${disabled?'disabled':''}></label>`;
    G.ui.Field = ({field,label,value='',type='text',min,max,step,disabled=false}) => {
        if(!['text','number','search'].includes(type))throw Error('输入类型无效。');
        return `<label class="form-label">${esc(label)}<input data-field="${esc(field)}" aria-label="${esc(label)}" type="${type}" value="${esc(value)}" ${min===undefined?'':`min="${esc(min)}"`} ${max===undefined?'':`max="${esc(max)}"`} ${step===undefined?'':`step="${esc(step)}"`} ${disabled?'disabled':''}></label>`;
    };
    G.ui.Slider = ({label,group,key,value,min=0,max=1,step=.01,display='',trackId=''}) => slider(esc(label),esc(group),esc(key),value,min,max,step,esc(display),esc(trackId));
    G.ui.MenuItem = options => G.ui.Button({...options,variant:options.variant||'quiet'});
    G.ui.SegmentedControl = ({label,action,items,value,attribute='value'}) => {
        if(!/^[a-z-]+$/.test(attribute))throw Error('分组选项属性无效。');
        return `<nav class="segmented-control" role="group" aria-label="${esc(label)}">${items.map(([id,text])=>button(esc(action),esc(text),'',id===value?'active':'quiet',`data-${attribute}="${esc(id)}" aria-pressed="${id===value}"`)).join('')}</nav>`;
    };
    // body and drawing accept only markup assembled by production view code.
    G.ui.Dialog = ({title,body,subtitle=''}) => `<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><h2 id="modal-title" tabindex="-1">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${G.ui.IconButton({action:'close-modal',label:'关闭',icon:'close',variant:'quiet'})}</header><div class="modal-body">${body}</div></section>`;
    G.ui.TemplateCard = ({id,kind,title,summary,description,drawing=''}) => `<button type="button" class="catalog-card" data-action="catalog-select" data-kind="${esc(kind)}" data-id="${esc(id)}"><small>${esc(summary)}</small><strong>${esc(title)}</strong>${drawing}<p>${esc(description)}</p><span>预听与使用 →</span></button>`;
    G.ui.CandidateBar = ({count,chosen,drawing='',actions=''}) => `<section class="candidate-bar">${G.ui.SegmentedControl({label:'方案版本',action:'creation-choose',attribute:'index',value:chosen,items:Array.from({length:count},(_,i)=>[i,'方案 '+(i+1)])})}<div class="candidate-preview">${drawing}</div><div class="modal-actions">${actions}</div></section>`;
  G.ui.TrackHeader=function({track,index=0,selected=false,solo=false,density='standard',soundName='',trackIcon='melody'}){
    if(!['standard','compact'].includes(density))throw Error('Unsupported track header density');
    const {button,ib,icon,esc}=G.ui,t=track;
    return `<div class="arrange-track-head ${selected?'current':''}" data-density="${density}" data-component="track-header" style="${G.ui.musicStyle(t.color,t.role|| (t.kind==='drum'?'drums':'melody'))}"><div class="track-title-row"><span class="track-number">${index+1}</span><button class="arrange-track-name" data-action="track" data-id="${t.id}" title="${esc(t.name)} · ${esc(soundName)}"><span>${icon(trackIcon,20)}</span><div><strong>${esc(t.name)}</strong><small>${esc(soundName)}</small></div></button>${ib('track-options','音轨设置','dots',`data-id="${t.id}"`)}</div><div class="track-controls">${button('mute','M','',t.mute?'active small-btn':'quiet small-btn',`data-id="${t.id}" title="静音 · ${esc(t.name)}" aria-label="静音 ${esc(t.name)}" aria-pressed="${t.mute}"`)}${button('solo','S','',solo?'active small-btn':'quiet small-btn',`data-id="${t.id}" title="只听 · ${esc(t.name)}" aria-label="只听 ${esc(t.name)}" aria-pressed="${solo}"`)}<input type="range" min="0" max="1" step=".01" value="${t.volume}" data-range="track.volume" data-track="${t.id}" aria-label="${esc(t.name)} 音量"></div></div>`;
  };
})(globalThis.GridTone ||= {});

/** Choose a readable note label against the velocity-blended musical color. */
(function(G){
  G.ui.noteInk=function(color,alpha=1){
    const match=/^#([0-9a-f]{6})$/i.exec(color||'');
    if(!match)return '#203428';
    const n=parseInt(match[1],16), rgb=[n>>16,(n>>8)&255,n&255].map((v,i)=>(v*alpha+[248,249,244][i]*(1-alpha))/255);
    const lum=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    return (lum+.05)/(.028+.05) >= 1.05/(lum+.05)?'#203428':'#ffffff';
  };
})(globalThis.GridTone ||= {});
