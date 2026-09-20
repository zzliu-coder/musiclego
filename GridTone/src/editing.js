/** Pure editing operations. Display choices never enter these commands. */
(function (G) {
    'use strict';
    function visiblePitches(project, session, t, pat) {
        if (t.kind === 'drum')
            return (G.drumsFor ? G.drumsFor(project, t) : G.DRUMS).map(d => d.pitch);
        const v = G.viewportFor(session, t), existing = new Set(pat.notes.map(n => n.pitch));
        return Array.from({ length: v.span + 1 }, (_, i) => v.low + v.span - i).filter(p => !session.showScale || G.inScale(p, project.key, project.scale) || existing.has(p));
    }
    function degreePosition(pitch, root, scale) {
        const steps = G.SCALES[scale];
        if (!steps)
            throw Error('音阶无效。');
        const nearest = G.snapPitch(pitch, root, scale), relative = nearest - root, octave = Math.floor(relative / 12), pc = ((relative % 12) + 12) % 12;
        return { degree: octave * steps.length + steps.indexOf(pc), accidental: pitch - nearest };
    }
    function degreePitch(degree, root, scale) { const steps = G.SCALES[scale], octave = Math.floor(degree / steps.length), i = ((degree % steps.length) + steps.length) % steps.length; return root + octave * 12 + steps[i]; }
    function mirrorDegree(notes, root, scale) {
        if (!notes.length)
            return [];
        if (notes.some(n => !G.inScale(n.pitch, root, scale)))
            throw Error('调内级数镜像需要所选音符都在参考音阶内。调外音可使用半音镜像，或先明确执行调式适配。');
        const pivot = degreePosition(notes[0].pitch, root, scale).degree;
        return notes.map(n => ({ ...n, pitch: G.snapPitch(G.clamp(degreePitch(2 * pivot - degreePosition(n.pitch, root, scale).degree, root, scale), 0, 127), root, scale) }));
    }
    function changeNotePitches(notes, settings) {
        const { mode = 'semitone', semitones = 0, sourceKey = 0, sourceScale = 'major', targetKey = 0, targetScale = 'major' } = settings;
        if (!['semitone', 'key', 'adapt'].includes(mode))
            throw Error('移调方式无效。');
        let delta = mode === 'key' ? ((targetKey - sourceKey + 18) % 12) - 6 : semitones;
        if (!Number.isInteger(delta) || delta < -24 || delta > 24)
            throw Error('移调范围为上下 24 个半音。');
        if (mode === 'adapt' && G.SCALES[sourceScale]?.length !== G.SCALES[targetScale]?.length)
            throw Error('级数适配需要源音阶和目标音阶具有相同音级数。五声音阶与七声音阶请用整体移调。');
        return notes.map(n => {
            let pitch = n.pitch + delta;
            if (mode === 'adapt') {
                const at = degreePosition(n.pitch, sourceKey, sourceScale);
                pitch = degreePitch(at.degree, targetKey, targetScale) + at.accidental;
            }
            if (pitch < 0 || pitch > 127)
                throw Error('结果超出 MIDI 0–127 音高范围，请缩小移调距离。');
            return { ...n, pitch };
        });
    }
    function pitchCandidate(project, trackId, patternId, ids, settings) {
        const p = G.cloneProject(project), t = p.tracks.find(t => t.id === trackId), pat = t?.patterns.find(p => p.id === patternId);
        if (!pat)
            throw Error('编辑目标不存在。');
        if (t.kind === 'drum')
            throw Error('鼓组不支持音高移调。');
        const selected = new Set(ids), src = selected.size ? pat.notes.filter(n => selected.has(n.id)) : pat.notes;
        const changed = changeNotePitches(src, settings), byId = new Map(changed.map(n => [n.id, n]));
        pat.notes = pat.notes.map(n => byId.get(n.id) || n);
        return p;
    }
    function durationNotes(notes, mode, length, cursor) {
        if (!['split','cursor','half','double'].includes(mode)) throw Error('时长操作无效。');
        return notes.flatMap(n => {
            if (mode === 'split' || mode === 'cursor') {
                if (mode === 'cursor' && !(cursor > n.start && cursor < n.start + n.duration)) return [{...n}];
                if (n.duration < 2) throw Error('音符短于 2 ticks，无法拆成两个有效音符。');
                const half = mode === 'cursor' ? cursor - n.start : n.duration / 2;
                if (half < 1 || n.duration-half < 1) throw Error('拆分位置两侧都需要至少 1 tick。');
                return [{ ...n, duration: half }, { ...n, id: G.uid('n'), start: n.start + half, duration: n.duration - half }];
            }
            const duration = mode === 'half' ? Math.max(1, n.duration / 2) : n.duration * 2;
            if (n.start + duration > length) throw Error('加倍后超出片段，请先扩展片段长度。');
            return [{ ...n, duration }];
        });
    }
    function duplicateTrack(project, trackId) {
        const p = G.cloneProject(project), source = p.tracks.find(t => t.id === trackId);
        if (!source) throw Error('音轨不存在。');
        if (p.tracks.length >= G.LIMITS.tracks) throw Error('最多支持 64 条音轨。');
        const t = G.clone(source), ids = new Map();
        t.id = G.uid('t'); t.name += ' · 副本';
        t.patterns = source.patterns.map(pat => { const copy = G.copyPattern(pat); copy.name = pat.name; ids.set(pat.id, copy.id); return copy; });
        for (const pat of t.patterns) for (const ref of pat.generation?.sources || []) if (ref.trackId === source.id) ref.trackId = t.id;
        t.clips = source.clips.map(c => ({ ...c, id: G.uid('c'), patternId: ids.get(c.patternId) }));
        p.tracks.splice(p.tracks.indexOf(source) + 1, 0, t);
        return { project: G.validateProject(p), trackId: t.id, patternId: t.patterns[0].id, clipId: t.clips[0]?.id };
    }
    function copyProject(project) {
        const p=G.cloneProject(project),ids=new Map([[p.id,G.uid('song')]]);
        for(const t of p.tracks){ids.set(t.id,G.uid('t'));for(const pat of t.patterns){ids.set(pat.id,G.uid('p'));for(const n of pat.notes)ids.set(n.id,G.uid('n'));}for(const c of t.clips)ids.set(c.id,G.uid('c'));}
        const remap=x=>Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[ids.get(k)||k,remap(v)])):typeof x==='string'?(ids.get(x)||x):x;
        const copy=remap(p);for(let i=0;i<p.tracks.length;i++)for(let j=0;j<p.tracks[i].patterns.length;j++)for(let k=0;k<p.tracks[i].patterns[j].notes.length;k++){const old=p.tracks[i].patterns[j].notes[k];copy.tracks[i].patterns[j].notes[k].performanceKey=old.performanceKey||old.id;}copy.title=p.title+' · 副本';return G.validateProject(copy);
    }
    Object.assign(G, { copyProject, durationNotes, duplicateTrack, visiblePitches, degreePosition, degreePitch, mirrorDegree, changeNotePitches, pitchCandidate });
})(globalThis.GridTone ||= {});
