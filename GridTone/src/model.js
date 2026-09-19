/** Serializable musical model. Musical time: 960 ticks / quarter, 3840 / 4/4 bar.
 * No audio nodes, UI state or browser APIs belong in a project. */
(function (G) {
    'use strict';
    const PPQ = 960, BAR = 3840, STEP = 240;
    // Exact lengths prevent destructive 4+2+1 slicing during time edits.
    const PATTERN_BARS = Object.freeze(Array.from({length:16},(_,i)=>i+1));
    G.PATTERN_BARS = PATTERN_BARS;
    const LIMITS = { tracks: 64, bars: 256, notes: 100000, assetsBytes: 24 * 1024 * 1024 };
    const COLORS = ['#2875f5', '#f66570', '#34b995', '#ee9552', '#9774cf', '#419caf', '#bb7483', '#7488ad'];
    const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], chromatic: Array.from({ length: 12 }, (_, i) => i) };
    const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    const DRUMS = [{ pitch: 36, name: '底鼓', en: 'KICK' }, { pitch: 38, name: '军鼓', en: 'SNARE' }, { pitch: 42, name: '闭镲', en: 'CLOSED HAT' }, { pitch: 46, name: '开镲', en: 'OPEN HAT' }, { pitch: 39, name: '拍手', en: 'CLAP' }, { pitch: 45, name: '低嗵鼓', en: 'LOW TOM' }, { pitch: 49, name: '吊镲', en: 'CRASH' }, { pitch: 37, name: '鼓边', en: 'RIM' }];
    const CHORDS = { major: [0, 4, 7], minor: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], fifth: [0, 7] };
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const uid = (prefix = 'id') => prefix + '_' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
    const clone = x => JSON.parse(JSON.stringify(x));
    const noteName = p => KEYS[((Math.round(p) % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
    const inScale = (p, root = 0, scale = 'major') => SCALES[scale].includes(((p - root) % 12 + 12) % 12);
    function snapPitch(p, root, scale) {
        p = clamp(Math.round(p), 0, 127);
        for (let d = 0; d < 12; d++) {
            if (p - d >= 0 && inScale(p - d, root, scale))
                return p - d;
            if (p + d <= 127 && inScale(p + d, root, scale))
                return p + d;
        }
        return p;
    }
    const newNote = (pitch, start, duration = STEP, velocity = .76) => ({ id: uid('n'), pitch, start, duration, velocity });
    const newPattern = (name = '片段 A', bars = 1) => ({ id: uid('p'), name, bars, notes: [] });
    function newTrack(kind = 'melodic', index = 0, preset = 'epiano') {
        const p = newPattern();
        return { ...(kind==='drum'&&G.resolvePreset?.(preset)?.drumkitId?{drumkitId:G.resolvePreset(preset).drumkitId}:{}), id: uid('t'), name: kind === 'drum' ? '节奏鼓组' : '新音轨', kind, color: kind==='drum'?'#f66570':/bass/.test(preset)?'#34b995':/piano|keys|pad/.test(preset)?'#ee9552':'#2875f5', preset: kind === 'drum' && preset === 'epiano' ? 'drums' : preset, volume: kind === 'drum' ? .68 : .65, pan: 0, mute: false,
            sound: { brightness: .55, attack: .01, release: .32 }, fx: { reverb: kind === 'drum' ? .09 : .24, delay: 0, drive: 0 }, pipeline: { transpose: 0, arp: 'off', rate: STEP, humanize: 0 },
            patterns: [p], clips: [{ id: uid('c'), patternId: p.id, bar: 0 }] };
    }
    function blankProject() { const t = newTrack(); t.name = '柔光电钢琴'; return { version: 3, id: uid('song'), title: '我的第一段音乐', bpm: 100, key: 0, scale: 'major', swing: 0, master: .8, bars: 4, tracks: [t], assets: {} }; }
    function demoProject() {
        const song = blankProject();
        song.title = '午后的留白';
        song.bpm = 96;
        song.bars = 8;
        const d = newTrack('drum', 1), b = newTrack('melodic', 2, 'roundbass'), k = newTrack('melodic', 0, 'epiano'), m = newTrack('melodic', 3, 'marimba');
        d.name = '口袋鼓机';
        b.name = '温暖贝斯';
        k.name = '柔光电钢琴';
        m.name = '木质旋律';
        b.volume = .56;
        k.volume = .56;
        m.volume = .42;
        m.pan = .2;
        k.pan = -.12;
        m.fx.reverb = .28;
        k.fx.reverb = .32;
        d.patterns = [];
        b.patterns = [];
        k.patterns = [];
        m.patterns = [];
        [d, b, k, m].forEach(t => t.clips = []);
        const chords = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]];
        for (let j = 0; j < 4; j++) {
            const dp = newPattern(j === 3 ? '节奏 · 转身' : '节奏 ' + String.fromCharCode(65 + j));
            [0, 6, 8, 11].forEach(x => dp.notes.push(newNote(36, x * STEP, STEP, x === 0 ? .92 : .74)));
            [4, 12].forEach(x => dp.notes.push(newNote(38, x * STEP, STEP, .72)));
            [0, 2, 4, 6, 8, 10, 12, 14].forEach((x, i) => dp.notes.push(newNote(42, x * STEP, STEP, i % 2 ? .37 : .51)));
            if (j === 3) {
                [13, 15].forEach(x => dp.notes.push(newNote(37, x * STEP, STEP, .4)));
                dp.notes.push(newNote(46, 14 * STEP, STEP, .24));
            }
            const bp = newPattern(['C · 根音', 'A · 根音', 'F · 根音', 'G · 根音'][j]);
            let root = chords[j][0] - 12;
            [[0, 5, root], [6, 2, root + 7], [8, 5, root], [14, 2, root + 12]].forEach(([s, l, p]) => bp.notes.push(newNote(p, s * STEP, l * STEP, .76)));
            const kp = newPattern(['Cmaj7 · 柔光', 'Am7 · 余温', 'Fmaj7 · 浮云', 'G7 · 归途'][j]);
            chords[j].forEach((p, i) => kp.notes.push(newNote(p, 0, 7 * STEP, .64 - i * .03)));
            chords[j].forEach((p, i) => kp.notes.push(newNote(p, 8 * STEP, 6 * STEP, .52 + i * .025)));
            const mp = newPattern(['旋律 A', '旋律 A′', '旋律 B', '旋律 B′'][j]);
            const seq = [[76, 74, 71, 67], [72, 71, 67, 64], [69, 72, 76, 72], [74, 71, 69, 67]][j];
            seq.forEach((p, i) => mp.notes.push(newNote(p, [0, 3, 7, 12][i] * STEP, [2, 3, 3, 3][i] * STEP, .6 + (i % 2) * .12)));
            [d, b, k, m].forEach((t, i) => { const p = [dp, bp, kp, mp][i]; t.patterns.push(p); [j, j + 4].forEach(bar => t.clips.push({ id: uid('c'), patternId: p.id, bar })); });
        }
        song.tracks = [k, b, d, m];
        return song;
    }
    function validateProject(input) {
        if (!input || typeof input !== 'object' || ![1, 2, 3].includes(input.version))
            throw Object.assign(Error('工程格式不支持：支持乐构 / 声格 v1、v2、v3 工程。'), { code: 'UNSUPPORTED_VERSION' });
        if (G.assertDataTree)
            G.assertDataTree(input);
        const p = clone(input), finite = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;
        p.version = 3;
        if (!Array.isArray(p.tracks) || p.tracks.length < 1 || p.tracks.length > LIMITS.tracks)
            throw Error('音轨数量应为 1–64。');
        if (!finite(p.bpm, 40, 240) || !Number.isInteger(p.bars) || !finite(p.bars, 1, LIMITS.bars))
            throw Error('速度或小节数量超出范围。');
        if (!Number.isInteger(p.key) || !finite(p.key, 0, 11) || !SCALES[p.scale] || !finite(p.swing, 0, .45) || !finite(p.master, 0, 1))
            throw Error('调式或全局参数无效。');
        p.title = String(p.title || '未命名作品').slice(0, 80);
        p.assets = p.assets || {};
        if (typeof p.assets !== 'object' || Array.isArray(p.assets))
            throw Error('音源格式错误。');
        const seen = new Set();
        let count = 0, assetBytes = 0;
        function id(v) {
            if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(v) || ['__proto__', 'constructor', 'prototype'].includes(v) || seen.has(v))
                throw Error('工程包含无效或重复的对象编号。');
            seen.add(v);
        }
        if (p.catalog) {
            if (!G.validateSnapshot)
                throw Error('请使用包含素材目录的新版本打开此工程。');
            p.catalog = G.validateSnapshot(p.catalog);
        }
        if (typeof p.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(p.id))
            throw Error('工程编号无效。');
        for (const [key, a] of Object.entries(p.assets)) {
            if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
                throw Error('采样编号无效。');
            if (!a || typeof a.data !== 'string' || !/^data:audio\/wav;base64,[A-Za-z0-9+/]+=*$/.test(a.data) || !finite(a.root, 0, 127))
                throw Error('音源资料无效。');
            if (!['pitched', 'oneshot'].includes(a.mode))
                throw Error('采样模式无效。');
            assetBytes += a.data.length * .75;
            if (assetBytes > LIMITS.assetsBytes)
                throw Error('工程内嵌音源超过 24 MB。');
            a.name = String(a.name || '自定义采样').slice(0, 80);
        }
        for (const t of p.tracks) {
            id(t.id);
            if (!['melodic', 'drum'].includes(t.kind))
                throw Error('音轨类型无效。');
            if (t.role !== undefined && !['unspecified', 'melody', 'bass', 'chords', 'drums', 'texture'].includes(t.role))
                throw Error('声部角色无效。');
            t.name = String(t.name || '音轨').slice(0, 60);
            if (!/^#[0-9a-f]{6}$/i.test(t.color))
                t.color = COLORS[0];
            if (typeof t.preset !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(t.preset))
                throw Error('音色编号无效。');
            // Missing resources remain editable and are reported by missingResources / assertPlayable.
            if (t.drumkitId !== undefined && (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(t.drumkitId)))
                throw Error('鼓组编号无效。');
            if (!finite(t.volume, 0, 1) || !finite(t.pan, -1, 1))
                throw Error('音轨参数无效。');
            t.mute = !!t.mute;
            delete t.solo; // Legacy temporary monitoring is intentionally not part of a saved mix.
            delete t.octave; // Visible range belongs to EditorSession.
            const ranges = { sound: { brightness: [0, 1], attack: [.002, 2], release: [.03, 3] }, fx: { reverb: [0, 1], delay: [0, 1], drive: [0, 1] }, pipeline: { transpose: [-24, 24], rate: [60, 960], humanize: [0, 60] } };
            for (const [group, fields] of Object.entries(ranges))
                for (const [field, [a, b]] of Object.entries(fields))
                    if (!finite(t[group]?.[field], a, b))
                        throw Error('音轨处理参数无效：' + field);
            if (!['off', 'up', 'down', 'bounce'].includes(t.pipeline.arp))
                throw Error('琶音模式无效。');
            if (!Array.isArray(t.patterns) || !t.patterns.length || t.patterns.length > 1024 || !Array.isArray(t.clips) || t.clips.length > 4096)
                throw Error('片段结构无效。');
            for (const pat of t.patterns) {
                id(pat.id);
                pat.name = String(pat.name || '片段').slice(0, 60);
                if (!PATTERN_BARS.includes(pat.bars) || !Array.isArray(pat.notes))
                    throw Error('片段长度无效。');
                validateCreativeMetadata(pat);
                count += pat.notes.length;
                if (count > LIMITS.notes)
                    throw Error('工程超过十万个音符。');
                for (const n of pat.notes) {
                    id(n.id);
                    if(n.performed!==undefined&&typeof n.performed!=='boolean')throw Error('演奏时间标记无效。');
                    if(n.timingOffset!==undefined&&!finite(n.timingOffset,-BAR,BAR))throw Error('音符起音补偿无效。');
                    if(n.swingPhase!==undefined&&![0,1].includes(n.swingPhase))throw Error('音符 Swing 相位无效。');
                    if(n.performanceKey!==undefined&&(typeof n.performanceKey!=='string'||n.performanceKey.length>200))throw Error('音符演奏身份无效。');
                    if (!Number.isInteger(n.pitch) || !finite(n.pitch, 0, 127) || !finite(n.start, 0, pat.bars * BAR - 1) || !finite(n.duration, 1, pat.bars * BAR - n.start) || !finite(n.velocity, .01, 1))
                        throw Error('音符位置、时值或力度无效。');
                }
            }
            const spans = [];
            for (const c of t.clips) {
                id(c.id);
                const pat = t.patterns.find(p => p.id === c.patternId);
                if (!pat || !Number.isInteger(c.bar) || !finite(c.bar, 0, p.bars - pat.bars))
                    throw Error('编排片段超出歌曲范围。');
                spans.push([c.bar, c.bar + pat.bars]);
            }
            spans.sort((a, b) => a[0] - b[0]);
            for (let i = 1; i < spans.length; i++)
                if (spans[i][0] < spans[i - 1][1])
                    throw Error('同一音轨的片段互相重叠。');
        }
        return p;
    }
    function validateCreativeMetadata(pat) {
        const number=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
        const string=x=>typeof x==='string'&&x.length>0&&x.length<=160;
        const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
        const only=(x,keys)=>object(x)&&Object.keys(x).every(k=>keys.includes(k));
        const length=pat.bars*BAR;
        if(pat.harmony!==undefined){
            const h=pat.harmony;
            if(!only(h,['version','events','source','confirmedMusicHash'])||h.version!==1||!Array.isArray(h.events)||h.events.length>1024||!string(h.confirmedMusicHash))throw Error('和声说明格式无效。');
            let end=0;
            for(const e of h.events){
                if(!only(e,['start','duration','rootPitchClass','quality','pitchClasses'])||!number(e.start,end,length-1)||!number(e.duration,1,length-e.start)||!Number.isInteger(e.rootPitchClass)||!number(e.rootPitchClass,0,11)||![...Object.keys(CHORDS),'dim','halfDim','add9'].includes(e.quality))throw Error('和声时间、根音或类型无效。');
                if(e.pitchClasses!==undefined&&(!Array.isArray(e.pitchClasses)||!e.pitchClasses.length||e.pitchClasses.length>12||e.pitchClasses.some(x=>!Number.isInteger(x)||!number(x,0,11))))throw Error('和声音级无效。');
                end=e.start+e.duration;
            }
            if(h.source!==undefined&&(!only(h.source,['recipeId','recipeVersion'])||!string(h.source.recipeId)||!Number.isInteger(h.source.recipeVersion)||h.source.recipeVersion<1))throw Error('和声来源无效。');
        }
        if(pat.retention!==undefined){
            const r=pat.retention;
            if(!only(r,['notes','ranges'])||!Array.isArray(r.notes)||!Array.isArray(r.ranges)||r.notes.length>pat.notes.length||r.ranges.length>1024)throw Error('生成保留项无效。');
            const ids=new Set();
            for(const n of r.notes){if(!only(n,['id','pitch','rhythm','all'])||!pat.notes.some(x=>x.id===n.id)||ids.has(n.id)||['pitch','rhythm','all'].some(k=>n[k]!==undefined&&typeof n[k]!=='boolean'))throw Error('保留音符引用无效。');ids.add(n.id);}
            for(const range of r.ranges)if(!only(range,['start','end'])||!number(range.start,0,length-1)||!number(range.end,range.start+1,length))throw Error('保留范围无效。');
        }
        if(pat.generation!==undefined){
            const g=pat.generation;
            if(!only(g,['version','algorithm','kind','seed','templateVersion','inputHash','sources','settings'])||g.version!==1||!string(g.algorithm)||!string(g.kind)||!number(g.seed,0,4294967295)||!Number.isInteger(g.seed)||!Number.isInteger(g.templateVersion)||!string(g.inputHash)||!Array.isArray(g.sources)||g.sources.length>64)throw Error('生成来源无效。');
            for(const s of g.sources)if(!only(s,['trackId','hash','range','layer'])||(s.layer!==undefined&&s.layer!=='performed')||!string(s.trackId)||!string(s.hash)||(s.range!==undefined&&(!Array.isArray(s.range)||s.range.length!==2||!number(s.range[0],0,LIMITS.bars*BAR)||!number(s.range[1],s.range[0]+1,LIMITS.bars*BAR))))throw Error('生成依赖无效。');
            if(!object(g.settings)||JSON.stringify(g.settings).length>8000||Object.values(g.settings).some(v=>!['number','string','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)))throw Error('生成参数无效。');
        }
    }
    G.validateCreativeMetadata=validateCreativeMetadata;
    function hash(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++)
            h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        return (h >>> 0) / 4294967296;
    }
    function transformNotes(notes, action, length, options = {}) {
        const a = clone(notes), pivot = options.pivot ?? notes[0]?.pitch ?? 60;
        if (action === 'reverse')
            a.forEach(n => n.start = length - n.start - n.duration);
        if (action === 'mirror')
            a.forEach(n => n.pitch = clamp(pivot * 2 - n.pitch, 0, 127));
        if (action === 'up' || action === 'down')
            a.forEach(n => n.pitch = clamp(n.pitch + (action === 'up' ? 12 : -12), 0, 127));
        if (action === 'shift')
            a.forEach(n => { n.start = (n.start + STEP) % length; n.duration = Math.min(n.duration, length - n.start); });
        if (action === 'double')
            return a.concat(a.map(n => ({ ...n, id: uid('n'), start: n.start + length })));
        if (action === 'thin')
            return a.filter((_, i) => i % 2 === 0);
        if (action === 'humanize')
            a.forEach(n => n.velocity = clamp(n.velocity + (hash(n.id) - .5) * .2, .15, 1));
        if (options.lock && ['mirror', 'up', 'down'].includes(action))
            a.forEach(n => n.pitch = snapPitch(n.pitch, options.key, options.scale));
        return a;
    }
    function chordNotes(root, quality, start, duration) { return (CHORDS[quality] || CHORDS.major).filter(x => root + x <= 127).map(x => newNote(root + x, start, duration)); }
    function processPattern(pat, track, project) {
        let notes = clone(pat.notes);
        const pipe = track.pipeline, L = pat.bars * BAR;
        if (track.kind !== 'drum' && pipe.arp !== 'off') {
            const groups = new Map();
            notes.forEach(n => {
                const key = n.start + ':' + n.duration;
                if (!groups.has(key))
                    groups.set(key, []);
                groups.get(key).push(n);
            });
            notes = [];
            groups.forEach(group => {
                group.sort((a, b) => a.pitch - b.pitch);
                if (pipe.arp === 'down')
                    group.reverse();
                const seq = pipe.arp === 'bounce' && group.length > 2 ? group.concat(group.slice(1, -1).reverse()) : group;
                if (group.length === 1) {
                    notes.push(group[0]);
                    return;
                }
                const dur = group[0].duration;
                for (let x = 0, i = 0; x < dur; x += pipe.rate, i++) {
                    const n = seq[i % seq.length];
                    notes.push({ ...n, id: n.id + '_arp' + i, performanceKey:(n.performanceKey||n.id)+'_arp'+i, ...(n.timingOffset===undefined?{}:{timingOffset:n.timingOffset+(hash(n.performanceKey||n.id)-hash((n.performanceKey||n.id)+'_arp'+i))*pipe.humanize}), start: n.start + x, duration: Math.min(pipe.rate * .83, dur - x) });
                }
            });
        }
        notes.forEach(n => {
            if (track.kind !== 'drum')
                n.pitch = clamp(n.pitch + Math.round(pipe.transpose), 0, 127);
            const phase = n.swingPhase??(Math.floor(n.start / STEP)%2);
            n.swingPhase=phase;
            n.start = clamp(n.start + (n.performed ? 0 : (phase ? project.swing * STEP : 0) + (hash(n.performanceKey||n.id) - .5) * pipe.humanize) + (n.timingOffset||0), 0, L - 1);
            delete n.timingOffset;
            n.duration = Math.min(n.duration, L - n.start);
            if (pipe.humanize && !n.performed)
                n.velocity = clamp(n.velocity + (hash((n.performanceKey||n.id) + 'v') - .5) * .08, .02, 1);
        });
        return notes;
    }
    /** One scope contract for event compilation, live gains, WAV and MIDI. */
    function resolvePlaybackScope(p, scope = null) {
        const kind = scope?.kind || (scope?.patternId ? 'pattern' : 'song');
        if (!['song', 'tracks', 'pattern', 'bar'].includes(kind))
            throw Error('试听范围无效。');
        let length = p.bars * BAR, offset = 0, patternId = null, ids = null;
        if (kind === 'pattern' || kind === 'bar') {
            const t = p.tracks.find(t => t.id === scope?.trackId), pat = t?.patterns.find(p => p.id === scope?.patternId);
            if (!pat)
                throw Error('试听片段已经不存在，请重新选择。');
            ids = [t.id];
            patternId = pat.id;
            length = pat.bars * BAR;
            if (kind === 'bar') {
                const page = Number(scope.page || 0);
                if (!Number.isInteger(page) || page < 0 || page >= pat.bars)
                    throw Error('试听小节超出范围。');
                offset = page * BAR;
                length = BAR;
            }
        }
        else if (kind === 'tracks') {
            ids = (scope.trackIds || []).filter(id => p.tracks.some(t => t.id === id));
            if (!ids.length)
                throw Error('请先勾选至少一条试听音轨。');
        }
        else if (scope?.trackId)
            ids = [scope.trackId];
        const solos = kind === 'song' ? (scope?.soloIds || (p.version === 1 ? p.tracks.filter(t => t.solo).map(t => t.id) : [])) : [];
        const ignoreMute = kind !== 'song' || scope?.ignoreMute === true;
        const trackIds = p.tracks.filter(t => (!ids || ids.includes(t.id)) && (ignoreMute || !t.mute) && (!solos.length || solos.includes(t.id))).map(t => t.id);
        if(scope?.range){const [a,b]=scope.range;if(Number.isFinite(a)&&Number.isFinite(b)&&a>=offset&&b>a&&b<=offset+length){offset=a;length=b-a;}}
        return { kind, trackIds, length, offset, patternId };
    }
    function compileSong(p, scope = null) {
        const info = resolvePlaybackScope(p, scope), events = [];
        for (const t of p.tracks) {
            if (!info.trackIds.includes(t.id))
                continue;
            const clips = info.patternId ? [{ patternId: info.patternId, bar: 0 }] : t.clips;
            for (const clip of clips) {
                const pat = t.patterns.find(x => x.id === clip.patternId);
                if (!pat)
                    continue;
                for (const n of processPattern(pat, t, p)) {
                    const absolute = n.start + clip.bar * BAR, start = Math.max(absolute, info.offset), end = Math.min(absolute + n.duration, info.offset + info.length);
                    if (end > start)
                        events.push({ ...n, start: start - info.offset, duration: end - start, trackId: t.id });
                }
            }
        }
        events.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
        return { events, length: info.length, trackIds: info.trackIds };
    }
    function canPlace(track, pattern, bar, projectBars, ignoreId = null) {
        return bar >= 0 && bar + pattern.bars <= projectBars && !track.clips.some(c => {
            if (c.id === ignoreId)
                return false;
            const p = track.patterns.find(p => p.id === c.patternId);
            return p && bar < c.bar + p.bars && bar + pattern.bars > c.bar;
        });
    }
    function firstFreeBar(track, pattern, projectBars, from = 0) {
        for (let b = from; b <= projectBars - pattern.bars; b++)
            if (canPlace(track, pattern, b, projectBars))
                return b;
        return -1;
    }
    function copyPattern(p) { const x = clone(p), ids=new Map(); x.id = uid('p'); x.name = p.name + '′'; x.notes.forEach(n => {const id=uid('n');ids.set(n.id,id);n.performanceKey??=n.id;n.id=id;});if(x.retention)x.retention.notes.forEach(n=>n.id=ids.get(n.id));return x; }
    Object.assign(G, { PPQ, BAR, STEP, LIMITS, COLORS, SCALES, KEYS, DRUMS, CHORDS, clamp, uid, clone, noteName, inScale, snapPitch, newNote, newPattern, newTrack, blankProject, demoProject, validateProject, hash, transformNotes, chordNotes, processPattern, resolvePlaybackScope, compileSong, canPlace, firstFreeBar, copyPattern });
})(globalThis.GridTone ||= {});
