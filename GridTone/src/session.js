/** EditorSession is deliberately outside the serializable musical document.
 * Browsing and selection never enter song undo history. Pure helpers are testable without DOM. */
(function (G) {
    'use strict';
    const { clamp, clone } = G;
    function createEditorSession(project) {
        const t = project.tracks[0];
        return { view: 'arrange', trackId: t.id, patternId: t.patterns[0].id, clipId: t.clips[0]?.id || null,
            snap: 240, continuous: true, editorOpen: false, editorHeight: 390, editorManuallyClosed:false, editorExpanded: false, editTarget:{kind:'none'}, editClipboard:null, arrangeCursor:{trackId:t.id,tick:0}, noteRange:null, rightPanel:null, inspectorTrackId:null, clipIds: [], snapEnabled: true, page: 0, tool: 'draw', chord: 'major', showScale: false, inputSnap: false, selected: [], clipboard: null,
            tab: '全部', query: '', saveStatus: '正在读取本机工程', sidebar: false, panel: 'properties',
            modal: null, cursor: 0, viewports: {}, scrolls: {}, editorTab: 'notes', editorGroup: 'view',
            clipClipboard: null, templateId: null, templateMode: 'new', templateTranspose: 'original', templateBar: 0 };
    }
    function createPlaybackContext() { return { target: 'song', loop: true, soloIds: [], selectedTrackIds: [], range: null, startTick: 0 }; }
    function reconcileSession(s, p, b) {
        const t = p.tracks.find(t => t.id === s.trackId) || p.tracks[0];
        s.trackId = t.id;
        const pat = t.patterns.find(x => x.id === s.patternId) || t.patterns[0];
        s.patternId = pat.id;
        const c = t.clips.find(c => c.id === s.clipId && c.patternId === pat.id);
        s.clipId = c?.id || t.clips.find(c => c.patternId === pat.id)?.id || null;
        s.page = clamp(s.page, 0, pat.bars - 1);
        s.clipIds=(s.clipIds||[]).filter(id=>p.tracks.some(t=>t.clips.some(c=>c.id===id)));
        s.selected = s.selected.filter(id => pat.notes.some(n => n.id === id));
        if (b) {
            for (const key of ['soloIds', 'selectedTrackIds'])
                b[key] = b[key].filter(id => p.tracks.some(t => t.id === id));
        }
        G.reconcileEditTarget?.(s,p);
        return { track: t, pattern: pat, clip: t.clips.find(c => c.id === s.clipId) || null };
    }
    function openPatternInSession(s, p, { trackId = s.trackId, patternId, clipId = null, edit = true } = {}) {
        const t = p.tracks.find(t => t.id === trackId);
        if (!t)
            throw Error('音轨已经不存在。');
        const c = clipId ? t.clips.find(c => c.id === clipId) : null;
        const pat = t.patterns.find(x => x.id === (c?.patternId || patternId)) || (!patternId && !clipId ? t.patterns[0] : null);
        if (!pat)
            throw Error('片段已经不存在。');
        const nextClip=c?.id||t.clips.find(c=>c.patternId===pat.id)?.id||null;
        const changed = s.trackId !== t.id || s.patternId !== pat.id || s.clipId!==nextClip;
        s.trackId = t.id;
        s.patternId = pat.id;
        s.clipId = c?.id || t.clips.find(c => c.patternId === pat.id)?.id || null;
        if (changed) {
            s.page = 0;
            s.selected = [];
            s.cursor = 0;
        }
        if (edit) {
            s.view = 'arrange';
            s.editorOpen = true;
            s.editorManuallyClosed = false;
            s.editorTab = 'notes';
        }
        return { changed, track: t, pattern: pat };
    }
    function viewportFor(s, t) {
        const pat=t.patterns.find(p=>p.id===s.patternId)||t.patterns[0], key=t.id+':'+pat.id;
        if (!s.viewports[key]) {
            const notes=pat.notes, low=notes.length?Math.min(...notes.map(n=>n.pitch))-2:(t.preset.includes('bass')?28:48);
            const span=notes.length?clamp(Math.max(...notes.map(n=>n.pitch))-low+3,12,127):24;
            s.viewports[key] = {low:clamp(low,0,127-span),span,rowHeight:20,zoomX:1};
        }
        return s.viewports[key];
    }
    function moveViewport(s, t, delta) { const v = viewportFor(s, t); v.low = clamp(Math.round(v.low + delta), 0, 127 - v.span); return v; }
    function fitViewport(s, t, pat) {
        const v = viewportFor(s, t), notes = pat.notes;
        if (notes.length) {
            const lo = Math.min(...notes.map(n => n.pitch)), hi = Math.max(...notes.map(n => n.pitch));
            v.span = clamp(hi - lo + 4, 12, 127);
            v.low = clamp(lo - 2, 0, 127 - v.span);
        }
        else {
            v.low = t.preset.includes('bass') ? 24 : 48;
            v.span = 24;
        }
        return v;
    }
    function scopeFor(p, s, b, { exporting = false } = {}) {
        const { track: t, pattern: pat } = reconcileSession(s, p, b);
        if (b.target === 'pattern' || b.target === 'bar')
            return { kind: b.target, trackId: t.id, patternId: pat.id, ...(b.target === 'bar' ? { page: s.page } : {}), ignoreMute: true };
        if (b.target === 'tracks')
            return { kind: 'tracks', trackIds: [...b.selectedTrackIds], ignoreMute: true };
        return { kind: 'song', soloIds: exporting ? [] : [...b.soloIds], ...(!exporting && b.range ? {range:b.range} : {}) };
    }
    function playbackLabel(p, s, b) {
        if (b.audition)
            return b.audition;
        const t = p.tracks.find(t => t.id === s.trackId) || p.tracks[0], pat = t.patterns.find(x => x.id === s.patternId) || t.patterns[0];
        if (b.target === 'pattern')
            return `本片段 · ${pat.name} · ${pat.bars} 小节`;
        if (b.target === 'bar')
            return `当前小节 · ${pat.name} · 第 ${s.page + 1} 小节`;
        if (b.target === 'tracks')
            return `所选 ${b.selectedTrackIds.length} 轨 · ${p.bars} 小节`;
        return `全曲 · ${p.bars} 小节${b.soloIds.length ? ` · 临时只听 ${b.soloIds.length} 轨` : ''}`;
    }
    function saveWorkspace(s, projectId) {
        try {
            localStorage.setItem('gridtone.workspace.' + projectId, JSON.stringify({
                layoutVersion:3,view:s.view==='mix'?'mix':'arrange',trackId:s.trackId,patternId:s.patternId,clipId:s.clipId,
                page:s.page,viewports:s.viewports,showScale:s.showScale,scrolls:s.scrolls,snap:s.snap,continuous:s.continuous,
                editorHeight:s.editorHeight,editorOpen:s.editorOpen,editorManuallyClosed:s.editorManuallyClosed,
                editorExpanded:s.editorExpanded,arrangeCursor:s.arrangeCursor
            }));
        } catch { /* Optional workspace preferences never block a document save. */ }
    }
    function restoreWorkspace(s,p) {
        try {
            const v=JSON.parse(localStorage.getItem('gridtone.workspace.'+p.id));
            if(!v||typeof v!=='object')return;
            s.view=v.view==='mix'?'mix':'arrange';
            for(const k of ['trackId','patternId','clipId'])if(typeof v[k]==='string')s[k]=v[k];
            s.page=Number.isInteger(v.page)?v.page:0;
            s.snap=[0,80,120,160,240,320,480].includes(v.snap)?v.snap:240;s.continuous=v.continuous!==false;
            const oldHeight=v.view==='arrange'?v.arrangeEditorHeight:v.editorHeight;
            s.editorHeight=clamp(Number(v.layoutVersion===3?v.editorHeight:oldHeight)||390,240,900);
            s.editorOpen=v.editorOpen!==false;s.editorManuallyClosed=v.layoutVersion===3?!!v.editorManuallyClosed:!s.editorOpen;
            s.editorExpanded=v.layoutVersion===3?!!v.editorExpanded:v.view==='edit'&&!!v.editorExpanded;
            s.showScale=!!v.showScale;s.rightPanel=null;s.editTarget={kind:'none'};
            if(v.arrangeCursor&&Number.isFinite(v.arrangeCursor.tick)&&p.tracks.some(t=>t.id===v.arrangeCursor.trackId))s.arrangeCursor={trackId:v.arrangeCursor.trackId,tick:clamp(v.arrangeCursor.tick,0,p.bars*G.BAR-1)};
            for(const t of p.tracks)for(const pat of t.patterns){
                const key=t.id+':'+pat.id,w=v.viewports?.[key]||v.viewports?.[t.id];
                if(w&&['low','span','rowHeight','zoomX'].every(k=>Number.isFinite(w[k])))s.viewports[key]={low:clamp(w.low,0,127-clamp(w.span,12,127)),span:clamp(w.span,12,127),rowHeight:clamp(w.rowHeight,10,42),zoomX:clamp(w.zoomX,.5,6)};
            }
            if(v.scrolls&&typeof v.scrolls==='object')for(const [key,val]of Object.entries(v.scrolls).slice(0,300)){
                if(!val||!Number.isFinite(val.x)||!Number.isFinite(val.y))continue;
                const k=v.layoutVersion===3?key:key==='component:arrange'?key:key.startsWith('arrange:')?'workspace:arrange':key.startsWith('mix:')?'workspace:mix':key;
                s.scrolls[k]={x:clamp(val.x,0,100000),y:clamp(val.y,0,100000)};
            }
            reconcileSession(s,p);
        }catch { /* Damaged preferences do not touch musical data. */ }
    }
    Object.assign(G, { createEditorSession, createPlaybackContext, reconcileSession, openPatternInSession, viewportFor, moveViewport, fitViewport, scopeFor, playbackLabel, saveWorkspace, restoreWorkspace });
})(globalThis.GridTone ||= {});
