(function (G) {
    'use strict';
    const { PPQ, compileSong, clamp } = G;
    function encodeMidi(project, scope = null) {
        const plan = compileSong(project, scope), active = project.tracks.filter(t => plan.trackIds.includes(t.id));
        const melodic = active.filter(t => t.kind !== 'drum');
        if (melodic.length > 15)
            throw Error('标准 MIDI 文件每个端口只有 15 个旋律通道；请将本次导出控制在 15 条旋律轨内。');
        const bytes = [], text = s => Array.from(s, c => c.charCodeAt(0)), be = (n, size) => Array.from({ length: size }, (_, i) => (n >>> ((size - 1 - i) * 8)) & 255);
        const vlq = n => {
            n = Math.max(0, Math.round(n));
            const a = [n & 127];
            while ((n >>>= 7) > 0)
                a.unshift((n & 127) | 128);
            return a;
        };
        const chunk = (id, data) => [...text(id), ...be(data.length, 4), ...data];
        const tempo = Math.round(60000000 / project.bpm), meta = [0, 255, 81, 3, ...be(tempo, 3), 0, 255, 88, 4, 4, 2, 24, 8, 0, 255, 47, 0];
        const tracks = [chunk('MTrk', meta)], channels = new Map();
        let channel = 0;
        active.forEach(t => {
            if (t.kind === 'drum')
                channels.set(t.id, 9);
            else {
                if (channel === 9)
                    channel++;
                channels.set(t.id, channel++);
            }
        });
        const programs = { epiano: 4, felt: 0, brightpiano: 1, organ: 16, toy: 10, bell: 10, marimba: 12, kalimba: 108, vibes: 11, pluck: 24, harp: 46, roundbass: 33, subbass: 38, acidbass: 38, fmbass: 39, cloudpad: 89, warmpad: 89, strings: 50, air: 73 };
        for (const t of active) {
            const ch = channels.get(t.id), name = [...new TextEncoder().encode(t.name)], events = [];
            for (const n of plan.events.filter(n => n.trackId === t.id)) {
                events.push({ tick: Math.round(n.start), off: false, data: [0x90 | ch, Math.round(n.pitch), clamp(Math.round(n.velocity * 127), 1, 127)] }, { tick: Math.round(n.start + n.duration), off: true, data: [0x80 | ch, Math.round(n.pitch), 0] });
            }
            events.sort((a, b) => a.tick - b.tick || Number(b.off) - Number(a.off));
            let data = [0, 255, 3, ...vlq(name.length), ...name, 0, 0xc0 | ch, programs[t.preset] ?? 80, 0, 0xb0 | ch, 7, Math.round(t.volume * 127), 0, 0xb0 | ch, 10, Math.round((t.pan + 1) * 63.5)], last = 0;
            for (const e of events) {
                data.push(...vlq(e.tick - last), ...e.data);
                last = e.tick;
            }
            data.push(...vlq(Math.max(0, Math.round(plan.length) - last)), 255, 47, 0);
            tracks.push(chunk('MTrk', data));
        }
        bytes.push(...text('MThd'), 0, 0, 0, 6, 0, 1, ...be(tracks.length, 2), ...be(PPQ, 2));
        const size = bytes.length + tracks.reduce((s, t) => s + t.length, 0), result = new Uint8Array(size);
        let offset = 0;
        result.set(bytes, offset);
        offset += bytes.length;
        for (const t of tracks) {
            result.set(t, offset);
            offset += t.length;
        }
        return result;
    }
    function downloadBlob(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000); }
    const safeFilename = name => String(name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 70) || '乐构作品';
    const openDB = () => G.projects.open();
    const saveLocal = project => G.projects.save(project);
    const loadLocal = () => G.projects.last();
    const listRecoveries = id => G.projects.recoveries(id);
    const loadRecovery = (key,id) => G.projects.recovery(key,id);
    async function saveCatalogPacks(packs) { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(packs, 'catalog-packs'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
    async function loadCatalogPacks() { const db = await openDB(); return new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('catalog-packs'); r.onsuccess = () => resolve(r.result || []); r.onerror = () => reject(r.error); }); }
    Object.assign(G, { listRecoveries, loadRecovery, saveCatalogPacks, loadCatalogPacks, encodeMidi, downloadBlob, safeFilename, saveLocal, loadLocal });
})(globalThis.GridTone ||= {});
