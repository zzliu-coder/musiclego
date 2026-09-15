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
        const p = G.clone(project), t = p.tracks.find(t => t.id === trackId), pat = t?.patterns.find(p => p.id === patternId);
        if (!pat)
            throw Error('编辑目标不存在。');
        if (t.kind === 'drum')
            throw Error('鼓组不支持音高移调。');
        const selected = new Set(ids), src = selected.size ? pat.notes.filter(n => selected.has(n.id)) : pat.notes;
        const changed = changeNotePitches(src, settings), byId = new Map(changed.map(n => [n.id, n]));
        pat.notes = pat.notes.map(n => byId.get(n.id) || n);
        return p;
    }
    Object.assign(G, { visiblePitches, degreePosition, degreePitch, mirrorDegree, changeNotePitches, pitchCandidate });
})(globalThis.GridTone ||= {});
