/** Pointer/keyboard lifecycle. One gesture = one history entry; canceled gestures restore the original. */
(function (G) {
 'use strict';
 G.createEditorInteractions = function (C) {
    const { S,B,track,pattern,snapshot,markChanged,render,drawGrid,preview,selectedNotes,noteMenu,openPattern,toast,
        closeModal,togglePlay,undo,redo,handleAction,mutate,copyNotes,pasteNotes,deleteNotes }=C;
    const { BAR,STEP,clamp,clone,newNote,chordNotes,canPlace,downloadBlob,safeFilename }=G;
    const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
    let drag=null, geo={width:960,left:72,top:30,row:24,cw:55,rows:[],height:0};
    function gridPoint(e) { const r = $('#note-grid').getBoundingClientRect(), x = (e.clientX - r.left) * geo.width / r.width, y = (e.clientY - r.top) * geo.height / r.height; return { x, y, col: clamp(Math.floor((x - geo.left) / geo.cw), 0, 15), row: clamp(Math.floor((y - geo.top) / geo.row), 0, geo.rows.length - 1) }; }
    function hitNote(pt) { const tick = S.page * BAR + (pt.x - geo.left) / geo.cw * STEP, pitch = geo.rows[pt.row]; return [...pattern().notes].reverse().find(n => n.pitch === pitch && tick >= n.start && tick < n.start + n.duration); }
    function brushCell(col, row, mode, seen) {
        const key = col + ':' + row;
        if (seen.has(key))
            return;
        seen.add(key);
        const p = pattern(), start = S.page * BAR + col * STEP, pitch = geo.rows[row], hits = p.notes.filter(n => n.pitch === pitch && n.start <= start && n.start + n.duration > start);
        if (mode === 'erase')
            p.notes = p.notes.filter(n => !hits.some(h => h.id === n.id));
        else if (!hits.length)
            p.notes.push(newNote(pitch, start));
    }
    let lastClipTap = { id: null, time: 0 };
    document.addEventListener('pointerdown', e => {
        C.interact();
        if (e.target.matches('input[type=range]')) {
            C.beginRange();
            return;
        }
        if (e.button !== 0 || S.modal)
            return;
        const clip = e.target.closest('[data-clip]');
        if (clip) {
            const t = C.getProject().tracks.find(t => t.id === clip.dataset.track), c = t.clips.find(c => c.id === clip.dataset.clip);
            drag = { type: 'clip', clip, c, t, x: e.clientX, start: c.bar, bar: c.bar, moved: false, before: snapshot(), pointer: e.pointerId, barWidth: clip.parentElement.clientWidth / C.getProject().bars };
            clip.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }
        const frame = e.target.closest('#gridframe');
        if (!frame)
            return;
        const pt = gridPoint(e);
        if (pt.x < geo.left) {
            if (pt.y >= geo.top && pt.y < geo.top + geo.rows.length * geo.row) {
                e.preventDefault();
                frame.setPointerCapture(e.pointerId);
                frame.focus({ preventScroll: true });
                drag = { type: 'ruler', pointer: e.pointerId, startY: e.clientY, low: G.viewportFor(S, track()).low, pitch: geo.rows[pt.row], moved: false };
            }
            return;
        }
        if (S.tool === 'pan') {
            // Touch devices use native scrolling; a mouse gets the same grab-to-pan behavior.
            if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
                const scroll=frame.parentElement;
                drag={type:'pan',pointer:e.pointerId,x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop,scroll};
                e.preventDefault();frame.setPointerCapture(e.pointerId);frame.focus({preventScroll:true});
                frame.classList.add('is-panning');
            }
            return;
        }
        e.preventDefault();
        frame.focus({ preventScroll: true });
        frame.setPointerCapture(e.pointerId);
        const before = snapshot(), p = pattern(), t = track();
        S.cursor = S.page * BAR + pt.col * STEP;
        drag = { before, pointer: e.pointerId, x: pt.x, y: pt.y, mx: pt.x, my: pt.y, col: pt.col, row: pt.row, moved: false, seen: new Set() };
        if (pt.y >= geo.top + geo.rows.length * geo.row) {
            drag.type = 'velocity';
            updateGridGesture(pt);
            return;
        }
        const hit = hitNote(pt);
        if (S.tool === 'select' && !hit) {
            drag.type = 'marquee';
            if (!e.shiftKey)
                S.selected = [];
            drawGrid();
            return;
        }
        if (S.tool === 'erase') {
            drag.type = 'brush';
            drag.mode = 'erase';
            brushCell(pt.col, pt.row, 'erase', drag.seen);
            drawGrid();
            return;
        }
        if (t.kind === 'drum' && S.tool !== 'select') {
            drag.type = 'brush';
            drag.mode = hit ? 'erase' : 'draw';
            brushCell(pt.col, pt.row, drag.mode, drag.seen);
            if (!hit)
                preview(t, geo.rows[pt.row], .1);
            S.selected = [];
            drawGrid();
            return;
        }
        if (hit) {
            if (e.shiftKey) {
                S.selected = S.selected.includes(hit.id) ? S.selected.filter(id => id !== hit.id) : [...S.selected, hit.id];
            }
            else if (!S.selected.includes(hit.id))
                S.selected = [hit.id];
            const edge = geo.left + (Math.min(hit.start + hit.duration, S.page * BAR + BAR) - S.page * BAR) / STEP * geo.cw;
            drag.type = t.kind !== 'drum' && pt.x >= edge - 11 ? 'resize' : 'move';
            drag.notes = clone(selectedNotes());
            drag.pitch = geo.rows[pt.row];
            drag.longTimer = setTimeout(() => {
                if (drag && !drag.moved && ['move', 'resize'].includes(drag.type)) {
                    drag = null;
                    noteMenu();
                }
            }, 600);
        }
        else {
            drag.type = 'draw';
            const start = S.page * BAR + pt.col * STEP, pitch = S.inputSnap ? G.snapPitch(geo.rows[pt.row], C.getProject().key, C.getProject().scale) : geo.rows[pt.row];
            const notes = S.tool === 'chord' ? chordNotes(pitch, S.chord, start, STEP) : [newNote(pitch, start)];
            p.notes.push(...notes);
            drag.ids = notes.map(n => n.id);
            S.selected = drag.ids;
            preview(t, pitch, .16);
        }
        drawGrid();
    });
    function updateGridGesture(pt) {
        if (!drag)
            return;
        const p = pattern();
        drag.mx = pt.x;
        drag.my = pt.y;
        if (Math.hypot(pt.x - drag.x, pt.y - drag.y) > 4) {
            drag.moved = true;
            clearTimeout(drag.longTimer);
        }
        if (drag.type === 'draw') {
            const lo = Math.min(drag.col, pt.col), hi = Math.max(drag.col, pt.col);
            for (const n of p.notes.filter(n => drag.ids.includes(n.id))) {
                n.start = S.page * BAR + lo * STEP;
                n.duration = (hi - lo + 1) * STEP;
            }
        }
        else if (drag.type === 'brush') {
            const lastCol = drag.lastCol ?? drag.col, lastRow = drag.lastRow ?? drag.row, count = Math.max(Math.abs(pt.col - lastCol), Math.abs(pt.row - lastRow), 1);
            for (let i = 0; i <= count; i++)
                brushCell(Math.round(lastCol + (pt.col - lastCol) * i / count), Math.round(lastRow + (pt.row - lastRow) * i / count), drag.mode, drag.seen);
            drag.lastCol = pt.col;
            drag.lastRow = pt.row;
        }
        else if (drag.type === 'move' && drag.notes.length) {
            let delta = Math.round((pt.x - drag.x) / geo.cw) * STEP;
            const min = Math.min(...drag.notes.map(n => n.start)), max = Math.max(...drag.notes.map(n => n.start + n.duration));
            delta = clamp(delta, -min, p.bars * BAR - max);
            let pitchDelta = geo.rows[pt.row] - drag.pitch;
            if (track().kind === 'drum')
                pitchDelta = 0;
            const minP = Math.min(...drag.notes.map(n => n.pitch)), maxP = Math.max(...drag.notes.map(n => n.pitch));
            pitchDelta = clamp(pitchDelta, -minP, 127 - maxP);
            for (const n of p.notes) {
                const orig = drag.notes.find(o => o.id === n.id);
                if (orig) {
                    n.start = orig.start + delta;
                    n.pitch = orig.pitch + pitchDelta;
                }
            }
        }
        else if (drag.type === 'resize') {
            const delta = Math.round((pt.x - drag.x) / geo.cw) * STEP;
            for (const n of p.notes) {
                const orig = drag.notes.find(o => o.id === n.id);
                if (orig)
                    n.duration = clamp(orig.duration + delta, STEP, p.bars * BAR - orig.start);
            }
        }
        else if (drag.type === 'marquee') {
            const x1 = Math.min(drag.x, pt.x), x2 = Math.max(drag.x, pt.x), y1 = Math.min(drag.y, pt.y), y2 = Math.max(drag.y, pt.y);
            S.selected = p.notes.filter(n => { const r = geo.rows.indexOf(n.pitch), x = geo.left + (n.start - S.page * BAR) / STEP * geo.cw, y = geo.top + r * geo.row; return r >= 0 && x < x2 && x + n.duration / STEP * geo.cw > x1 && y < y2 && y + geo.row > y1; }).map(n => n.id);
        }
        else if (drag.type === 'velocity') {
            const vy = geo.top + geo.rows.length * geo.row + 12, v = clamp(1 - (pt.y - vy) / 32, .05, 1), start = S.page * BAR + pt.col * STEP;
            for (const n of p.notes)
                if (n.start >= start && n.start < start + STEP)
                    n.velocity = v;
        }
        drawGrid();
    }
    document.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.pointer)
            return;
        if (drag.type === 'pan') {
            e.preventDefault();drag.scroll.scrollLeft=drag.left-(e.clientX-drag.x);drag.scroll.scrollTop=drag.top-(e.clientY-drag.y);return;
        }
        if (drag.type === 'ruler') {
            e.preventDefault();
            if (Math.abs(e.clientY - drag.startY) > 4)
                drag.moved = true;
            if (drag.moved && track().kind !== 'drum') {
                const v = G.viewportFor(S, track());
                v.low = clamp(drag.low + Math.round((e.clientY - drag.startY) / geo.row), 0, 127 - v.span);
                drawGrid();
            }
            return;
        }
        if (drag.type === 'clip') {
            const delta = Math.round((e.clientX - drag.x) / drag.barWidth), p = drag.t.patterns.find(p => p.id === drag.c.patternId);
            drag.bar = clamp(drag.start + delta, 0, C.getProject().bars - p.bars);
            drag.moved = Math.abs(e.clientX - drag.x) > 4;
            drag.clip.style.left = (drag.bar * drag.barWidth + G.UI_METRICS.clipInset) + 'px';
            drag.clip.classList.toggle('invalid', !canPlace(drag.t, p, drag.bar, C.getProject().bars, drag.c.id));
            return;
        }
        e.preventDefault();
        if ($('#note-grid'))
            updateGridGesture(gridPoint(e));
    }, { passive: false });
    document.addEventListener('pointerup', e => {
        if (!drag || e.pointerId !== drag.pointer)
            return;
        const d = drag;
        clearTimeout(d.longTimer);
        drag = null;
        if (d.type === 'pan') {
            $('#gridframe')?.classList.remove('is-panning');
            return;
        }
        if (d.type === 'ruler') {
            if (!d.moved)
                preview(track(), d.pitch);
            G.saveWorkspace(S, C.getProject().id);
            render();
            return;
        }
        if (d.type === 'clip') {
            const p = d.t.patterns.find(p => p.id === d.c.patternId);
            if (canPlace(d.t, p, d.bar, C.getProject().bars, d.c.id)) {
                d.c.bar = d.bar;
                markChanged(d.before);
            }
            else
                toast('这个位置已有片段，已放回原位。');
            S.clipId = d.c.id;
            S.trackId = d.t.id;
            S.patternId = d.c.patternId;
            if (!d.moved && lastClipTap.id === d.c.id && Date.now() - lastClipTap.time < 400) {
                openPattern({ trackId: d.t.id, clipId: d.c.id });
            }
            lastClipTap = { id: d.c.id, time: Date.now() };
            render();
            return;
        }
        markChanged(d.before);
        render();
    });
    document.addEventListener('pointercancel', e => {
        if (!drag || drag.pointer !== e.pointerId)
            return;
        clearTimeout(drag.longTimer);
        if (drag.type === 'ruler') G.viewportFor(S, track()).low = drag.low;
        else if (drag.type === 'pan') {drag.scroll.scrollLeft=drag.left;drag.scroll.scrollTop=drag.top;}
        else C.setProject(drag.before);
        drag = null;
        render();
    });
    window.addEventListener('blur', () => {
        if (drag) {
            clearTimeout(drag.longTimer);
            if (drag.type === 'ruler') G.viewportFor(S, track()).low = drag.low;
            else if (drag.type === 'pan') {drag.scroll.scrollLeft=drag.left;drag.scroll.scrollTop=drag.top;}
            else C.setProject(drag.before);
            drag = null;
            render();
        }
        C.commitRange();
    });
    document.addEventListener('keydown', e => {
        const target = e.target instanceof Element ? e.target : document.activeElement;
        if(!target?.matches) return;
        const editing = target.matches('input,textarea,select,[contenteditable=true]'), mod = e.ctrlKey || e.metaKey;
        if (S.modal) {
            if (e.key === 'Escape') { closeModal(); e.preventDefault(); }
            else if (e.key === 'Enter' && C.hasForm() && !target.matches('button,select,textarea')) { C.submitForm(); e.preventDefault(); }
            else G.ui.modal.keydown(e);
            return;
        }
        if (editing)
            return;
        if (e.code === 'Space' && target.closest('button,a,summary')) return;
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
            return;
        }
        if (mod && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            e.shiftKey ? redo() : undo();
            return;
        }
        if (mod && e.key.toLowerCase() === 's') {
            e.preventDefault();
            downloadBlob(new Blob([JSON.stringify(C.getProject())], { type: 'application/json' }), safeFilename(C.getProject().title) + '.gridtone');
            return;
        }
        if (S.view !== 'edit') {
            if (e.key === 'Enter') {
                const clip = target.closest('[data-clip]');
                if (clip) {
                    e.preventDefault();
                    openPattern({ trackId: clip.dataset.track, clipId: clip.dataset.clip });
                }
                else if (S.clipId)
                    handleAction('edit-clip', e.target);
            }
            return;
        }
        if (target.closest('button,a,summary')) return;
        if (mod && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            S.selected = pattern().notes.map(n => n.id);
            render();
        }
        if (mod && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            copyNotes();
        }
        if (mod && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            pasteNotes();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteNotes();
        }
        if (e.key === 'Escape') {
            S.selected = [];
            render();
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && S.selected.length) {
            e.preventDefault();
            mutate(() => {
                const notes = selectedNotes(), p = pattern();
                const dt = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0, dp = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
                if (notes.some(n => n.start + dt < 0 || n.start + n.duration + dt > p.bars * BAR || n.pitch + dp < 0 || n.pitch + dp > 127))
                    return;
                notes.forEach(n => {
                    n.start += dt;
                    if (track().kind !== 'drum')
                        n.pitch += dp;
                });
            });
        }
    });

    document.addEventListener('contextmenu', e => {
        const grid = target.closest('#gridframe');
        if (!grid)
            return;
        e.preventDefault();
        const pt = gridPoint(e), hit = hitNote(pt);
        if (hit) {
            if (!S.selected.includes(hit.id))
                S.selected = [hit.id];
            drawGrid();
            noteMenu();
        }
    });

    return { setGeometry: g => { geo=g; }, getDrag: () => drag };
 };
})(globalThis.GridTone ||= {});
