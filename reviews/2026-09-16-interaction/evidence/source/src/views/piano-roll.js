/** Actual note/drum grid renderer; hit testing consumes its returned geometry. */
(function (G) {
 G.views ||= {};
 G.views.drawPianoRoll = function (C) {
 const { project,S,track,pattern,getRows,drag,esc }=C;
 const { BAR,STEP,DRUMS,noteName,inScale }=G;
 const $=s=>document.querySelector(s);

        const frame = $('#gridframe');
        if (!frame)
            return;
        const t = track(), p = pattern(), rows = getRows(), vp = G.viewportFor(S, t), w = Math.max(640, Math.floor(frame.parentElement.clientWidth * vp.zoomX)), left = t.kind === 'drum' ? 112 : 72, top = 30, rh = t.kind === 'drum' ? 36 : vp.rowHeight, cw = (w - left - 12) / 16, h = top + rows.length * rh + 66;
        const geo = { width: w, left, top, row: rh, cw, rows, height: h };
        const offset = S.page * BAR;
        let svg = `<svg id="note-grid" data-low="${vp.low}" data-span="${vp.span}" data-row-height="${rh}" data-cell-width="${cw}" data-left="${left}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="第 ${S.page + 1} 小节音符网格"><defs><linearGradient id="note-shine" x1="0" y1="0" x2="0" y2="1"><stop stop-color="white" stop-opacity=".15"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" fill="var(--grid-paper)"/>`;
        for (let i = 0; i < 16; i++) {
            const x = left + i * cw;
            svg += `<rect x="${x}" y="${top}" width="${cw}" height="${rows.length * rh}" fill="${Math.floor(i / 4) % 2 ? 'var(--grid-beat)' : 'var(--grid-paper)'}"/><text x="${x + cw / 2}" y="18" text-anchor="middle" fill="${i % 4 === 0 ? 'var(--ink)' : 'var(--subtle)'}" font-size="${i % 4 === 0 ? 12 : 10}" font-weight="${i % 4 === 0 ? 700 : 400}">${i % 4 === 0 ? `${i / 4 + 1}` : '·'}</text>`;
        }
        rows.forEach((pitch, i) => {
            const y = top + i * rh, isRoot = pitch % 12 === project.key, inKey = inScale(pitch, project.key, project.scale), drum = (G.drumsFor ? G.drumsFor(project, t) : DRUMS).find(d => d.pitch === pitch);
            svg += `<rect data-ruler-pitch="${pitch}" x="0" y="${y}" width="${left - 7}" height="${rh - 1}" rx="2" fill="${isRoot && t.kind !== 'drum' ? 'var(--selected)' : !inKey && t.kind !== 'drum' ? 'var(--grid-key)' : 'var(--surface)'}"/><text x="${t.kind === 'drum' ? 12 : left - 17}" y="${y + rh / 2 + (t.kind === 'drum' ? 0 : 4)}" text-anchor="${t.kind === 'drum' ? 'start' : 'end'}" font-size="${t.kind === 'drum' ? 12 : 11}" font-weight="${isRoot ? 700 : 500}" fill="${!inKey && t.kind !== 'drum' ? 'var(--subtle)' : 'var(--muted)'}">${esc(t.kind === 'drum' ? drum?.name : noteName(pitch))}</text>${t.kind === 'drum' ? `<text x="12" y="${y + rh / 2 + 13}" font-size="9" letter-spacing=".4" fill="var(--muted)">${esc(drum?.en || '')}</text>` : ''}<line x1="${left}" y1="${y + rh}" x2="${w - 12}" y2="${y + rh}" stroke="var(--grid-minor)"/>`;
            if (isRoot && t.kind !== 'drum')
                svg += `<rect x="${left}" y="${y}" width="${cw * 16}" height="${rh}" fill="var(--green)" opacity=".055"/>`;
        });
        for (let i = 0; i <= 16; i++)
            svg += `<line x1="${left + i * cw}" y1="${top}" x2="${left + i * cw}" y2="${top + rows.length * rh}" stroke="${i % 4 === 0 ? 'var(--grid-major)' : 'var(--grid-minor)'}" stroke-width="${i % 4 === 0 ? 1.2 : .7}"/>`;
        if (t.kind === 'drum') {
            rows.forEach((pitch, r) => {
                for (let i = 0; i < 16; i++)
                    svg += `<rect x="${left + i * cw + 4}" y="${top + r * rh + 6}" width="${cw - 8}" height="${rh - 12}" rx="5" fill="${i % 4 === 0 ? 'var(--grid-key)' : 'var(--grid-beat)'}"/>`;
            });
        }
        for (const n of p.notes) {
            if (n.start >= offset + BAR || n.start + n.duration <= offset)
                continue;
            const row = rows.indexOf(n.pitch);
            if (row < 0)
                continue;
            let x = left + (Math.max(offset, n.start) - offset) / STEP * cw + 2, y = top + row * rh + (t.kind === 'drum' ? 6 : 3), nw = (Math.min(offset + BAR, n.start + n.duration) - Math.max(n.start, offset)) / STEP * cw - 4, nh = rh - (t.kind === 'drum' ? 12 : 6);
            nw = Math.max(5, nw);
            const selected = S.selected.includes(n.id);
            svg += `<g data-note="${n.id}"><rect x="${x}" y="${y}" width="${nw}" height="${nh}" rx="${t.kind === 'drum' ? 5 : 4}" fill="${t.color}" opacity="${.45 + n.velocity * .55}" ${selected ? 'stroke="var(--ink)" stroke-width="2"' : ''}/><rect x="${x}" y="${y}" width="${nw}" height="${nh / 2}" rx="4" fill="url(#note-shine)"/>${t.kind !== 'drum' && nw > 27 ? `<text x="${x + 7}" y="${y + nh / 2 + 3.5}" fill="${G.ui.noteInk(t.color,.45+n.velocity*.55)}" font-size="10" font-weight="600" pointer-events="none">${esc(noteName(n.pitch))}</text>` : ''}${t.kind !== 'drum' && n.start + n.duration <= offset + BAR ? `<line data-resize="${n.id}" x1="${x + nw - 5}" y1="${y + 4}" x2="${x + nw - 5}" y2="${y + nh - 4}" stroke="white" stroke-opacity=".6" stroke-width="2"/>` : ''}</g>`;
        }
        const vy = top + rows.length * rh + 12;
        svg += `<text x="12" y="${vy + 23}" fill="var(--muted)" font-size="10">力度</text>`;
        for (let i = 0; i < 16; i++) {
            const notes = p.notes.filter(n => n.start >= offset + i * STEP && n.start < offset + (i + 1) * STEP), vel = notes.length ? notes.reduce((a, n) => a + n.velocity, 0) / notes.length : 0;
            svg += `<rect x="${left + i * cw + 4}" y="${vy}" width="${cw - 8}" height="32" fill="var(--grid-key)" rx="2"/><rect x="${left + i * cw + 4}" y="${vy + 32 * (1 - vel)}" width="${cw - 8}" height="${32 * vel}" fill="${t.color}" opacity=".5" rx="2"/>`;
        }
        if (drag?.type === 'marquee')
            svg += `<rect x="${Math.min(drag.x, drag.mx)}" y="${Math.min(drag.y, drag.my)}" width="${Math.abs(drag.mx - drag.x)}" height="${Math.abs(drag.my - drag.y)}" fill="var(--green)" fill-opacity=".12" stroke="var(--green)" stroke-dasharray="4 3"/>`;
        svg += `<g id="playhead" visibility="hidden" pointer-events="none"><line x1="0" x2="0" y1="${top}" y2="${vy + 34}" stroke="var(--color-playhead)" stroke-width="2"/><path d="M-5 19h10l-5 8z" fill="var(--color-playhead)"/></g></svg>`;
        $('#grid-inner').innerHTML = svg;
        return geo;
    
 };
})(globalThis.GridTone ||= {});
