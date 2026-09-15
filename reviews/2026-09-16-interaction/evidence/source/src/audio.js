/** Native Web Audio renderer, separate from song data and the UI.
 * Uses the audio clock + a short scheduling horizon, never timers for note timing.
 * Add procedural instruments through registerInstrument(engineId, renderer).
 */
(function (G) {
    'use strict';
    const { clamp, PPQ, BAR, STEP, compileSong, presetById } = G;
    const bufferCache = new WeakMap(), instrumentRenderers = new Map();
    function registerInstrument(id, renderer) {
        if (typeof renderer !== 'function')
            throw Error('音频引擎需要一个渲染函数。');
        instrumentRenderers.set(id, renderer);
    }
    function seededNoise(ctx, seconds = 1) {
        let c = bufferCache.get(ctx);
        if (!c) {
            c = {};
            bufferCache.set(ctx, c);
        }
        const key = 'noise' + seconds;
        if (c[key])
            return c[key];
        const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate), data = b.getChannelData(0);
        let s = 17021;
        for (let i = 0; i < data.length; i++) {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            data[i] = (s / 4294967296) * 2 - 1;
        }
        c[key] = b;
        return b;
    }
    function impulse(ctx) {
        let c = bufferCache.get(ctx);
        if (!c) {
            c = {};
            bufferCache.set(ctx, c);
        }
        if (c.impulse)
            return c.impulse;
        const b = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 1.8), ctx.sampleRate);
        let seed = 7919;
        for (let channel = 0; channel < 2; channel++) {
            const d = b.getChannelData(channel);
            for (let i = 0; i < d.length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                d[i] = (seed / 4294967296 * 2 - 1) * Math.pow(1 - i / d.length, 3);
            }
        }
        c.impulse = b;
        return b;
    }
    function shapeCurve(amount) {
        const a = 1 + amount * 18, c = new Float32Array(2048);
        for (let i = 0; i < c.length; i++) {
            const x = 2 * i / (c.length - 1) - 1;
            c[i] = Math.tanh(x * a) / Math.tanh(a);
        }
        return c;
    }
    function createGraph(ctx, project, destination = ctx.destination) {
        const nodes = [], buses = new Map(), sources = new Set(), add = n => (nodes.push(n), n);
        const sum = add(ctx.createGain()), limiter = add(ctx.createDynamicsCompressor()), master = add(ctx.createGain()), analyser = add(ctx.createAnalyser());
        limiter.threshold.value = -9;
        limiter.knee.value = 15;
        limiter.ratio.value = 7;
        limiter.attack.value = .004;
        limiter.release.value = .16;
        master.gain.value = project.master;
        analyser.fftSize = 1024;
        sum.connect(limiter);
        limiter.connect(master);
        master.connect(analyser);
        analyser.connect(destination);
        const reverb = add(ctx.createConvolver()), wet = add(ctx.createGain());
        reverb.buffer = impulse(ctx);
        wet.gain.value = .48;
        reverb.connect(wet);
        wet.connect(sum);
        const delay = add(ctx.createDelay(2)), feedback = add(ctx.createGain()), echoFilter = add(ctx.createBiquadFilter()), echoLevel = add(ctx.createGain());
        delay.delayTime.value = 60 / project.bpm * .75;
        feedback.gain.value = .28;
        echoFilter.frequency.value = 3500;
        echoLevel.gain.value = .48;
        delay.connect(echoFilter);
        echoFilter.connect(feedback);
        feedback.connect(delay);
        echoFilter.connect(echoLevel);
        echoLevel.connect(sum);
        for (const t of project.tracks) {
            const input = add(ctx.createGain()), filter = add(ctx.createBiquadFilter()), pan = add(ctx.createStereoPanner()), fader = add(ctx.createGain()), rv = add(ctx.createGain()), dl = add(ctx.createGain());
            filter.type = 'lowpass';
            filter.frequency.value = 350 + Math.pow(t.sound.brightness, .65) * 17000;
            filter.Q.value = .5;
            input.connect(filter);
            const drive = add(ctx.createWaveShaper());
            drive.curve = t.fx.drive > 0 ? shapeCurve(t.fx.drive) : null;
            drive.oversample = '2x';
            filter.connect(drive);
            drive.connect(pan);
            pan.connect(fader);
            const meter = add(ctx.createAnalyser());
            meter.fftSize = 1024;
            fader.connect(meter);
            meter.connect(sum);
            fader.connect(rv);
            rv.connect(reverb);
            fader.connect(dl);
            dl.connect(delay);
            pan.pan.value = t.pan;
            fader.gain.value = t.volume;
            rv.gain.value = t.fx.reverb;
            dl.gain.value = t.fx.delay;
            buses.set(t.id, { input, fader, filter, pan, rv, dl, meter, drive, driveValue: t.fx.drive });
        }
        return { ctx, nodes, buses, sources, master, analyser, project,
            update(p, activeIds = null, immediate = false) {
                this.project = p;
                const allowed = new Set(activeIds || G.resolvePlaybackScope(p).trackIds);
                for (const t of p.tracks) {
                    const b = buses.get(t.id);
                    if (!b)
                        continue;
                    const at = ctx.currentTime;
                    if (immediate)
                        b.fader.gain.setValueAtTime(allowed.has(t.id) ? t.volume : 0, at);
                    else
                        b.fader.gain.setTargetAtTime(allowed.has(t.id) ? t.volume : 0, at, .012);
                    b.pan.pan.setTargetAtTime(t.pan, at, .012);
                    b.filter.frequency.setTargetAtTime(350 + Math.pow(t.sound.brightness, .65) * 17000, at, .015);
                    b.rv.gain.setTargetAtTime(t.fx.reverb, at, .015);
                    b.dl.gain.setTargetAtTime(t.fx.delay, at, .015);
                    if (b.driveValue !== t.fx.drive) {
                        b.drive.curve = t.fx.drive > 0 ? shapeCurve(t.fx.drive) : null;
                        b.driveValue = t.fx.drive;
                    }
                }
                master.gain.setTargetAtTime(p.master, ctx.currentTime, .012);
            },
            dispose() {
                for (const s of sources) {
                    try {
                        s.stop();
                    }
                    catch { }
                }
                sources.clear();
                for (const n of nodes) {
                    try {
                        n.disconnect();
                    }
                    catch { }
                }
            }
        };
    }
    function voiceTools(graph, out) {
        const ctx = graph.ctx, nodes = [], sources = [];
        let remaining = 0;
        const add = n => (nodes.push(n), n);
        function source(s, at, end) {
            sources.push(s);
            graph.sources.add(s);
            remaining++;
            s.onended = () => {
                graph.sources.delete(s);
                remaining--;
                if (remaining === 0)
                    for (const n of nodes) {
                        try {
                            n.disconnect();
                        }
                        catch { }
                    }
            };
            s.start(at);
            s.stop(end);
            return s;
        }
        const gain = (v = 1) => { const n = add(ctx.createGain()); n.gain.value = v; return n; };
        const osc = (type, freq, destination, at, end, level = 1, detune = 0) => { const o = add(ctx.createOscillator()); o.type = type; o.frequency.value = freq; o.detune.value = detune; const g = gain(level); o.connect(g); g.connect(destination); source(o, at, end); return o; };
        return { ctx, nodes, add, source, gain, osc, out };
    }
    function synthVoice({ graph, out, note, track, at, duration, preset }) {
        const v = voiceTools(graph, out), { ctx, add, gain, osc } = v, freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
        const isPad = preset.engine === 'pad' && ['cloudpad', 'warmpad', 'strings'].includes(preset.id), sustain = ['pad', 'organ', 'bass', 'sub'].includes(preset.engine), gate = Math.max(.015, duration);
        const release = clamp(track.sound.release * (preset.release / .32), .035, 3), end = at + gate + release + .02;
        const env = gain(0);
        env.connect(out);
        const amp = note.velocity * (preset.engine === 'bass' ? .28 : .15), attack = Math.min(gate * .45, isPad ? Math.max(.15, track.sound.attack) : track.sound.attack);
        const decayEnd = at + Math.min(gate, attack + .22), hold = sustain ? (isPad ? .8 : .65) : .19;
        env.gain.setValueAtTime(.00001, at);
        env.gain.linearRampToValueAtTime(amp, at + attack);
        env.gain.exponentialRampToValueAtTime(Math.max(.00001, amp * hold), decayEnd);
        env.gain.setValueAtTime(Math.max(.00001, amp * hold), at + gate);
        env.gain.exponentialRampToValueAtTime(.00001, end);
        if (preset.engine === 'fm') {
            const carrier = add(ctx.createOscillator()), mod = add(ctx.createOscillator()), depth = gain(freq * preset.index);
            carrier.frequency.value = freq;
            mod.frequency.value = freq * preset.ratio;
            mod.connect(depth);
            depth.connect(carrier.frequency);
            carrier.connect(env);
            depth.gain.setValueAtTime(freq * preset.index, at);
            depth.gain.exponentialRampToValueAtTime(Math.max(.01, freq * preset.index * .12), at + Math.min(gate, .45));
            v.source(carrier, at, end);
            v.source(mod, at, end);
        }
        else if (preset.engine === 'harmonic') {
            [1, 2, 3, 4, 6].forEach((r, i) => osc('sine', freq * r, env, at, end, [.72, .17, .07, .03, .01][i] * (preset.id === 'brightpiano' && i > 0 ? 1.6 : 1)));
        }
        else if (preset.engine === 'organ') {
            [1, 2, 3].forEach((r, i) => osc('sine', freq * r, env, at, end, [.7, .2, .1][i]));
        }
        else if (preset.engine === 'pad') {
            osc(preset.wave, freq, env, at, end, .48, -5);
            osc(preset.wave, freq, env, at, end, .48, 5);
        }
        else if (preset.engine === 'bass') {
            osc('sine', freq, env, at, end, .8);
            osc('triangle', freq * 2, env, at, end, .2);
        }
        else
            osc(preset.wave, freq, env, at, end, preset.wave === 'sawtooth' || preset.wave === 'square' ? .55 : 1);
    }
    function drumVoice({ graph, out, note, track, at }) {
        const v = voiceTools(graph, out), { ctx, add, gain, osc } = v, soft = track.preset === 'softdrums' ? .72 : 1, vel = note.velocity * soft, p = note.pitch;
        function tone(freq, seconds, level, bend = 0) {
            const e = gain(0);
            e.connect(out);
            e.gain.setValueAtTime(.00001, at);
            e.gain.linearRampToValueAtTime(level * vel, at + .002);
            e.gain.exponentialRampToValueAtTime(.00001, at + seconds);
            const o = osc('sine', freq, e, at, at + seconds + .01);
            if (bend)
                o.frequency.exponentialRampToValueAtTime(bend, at + seconds * .7);
        }
        function noise(seconds, hp, level, clap = false) {
            const n = add(ctx.createBufferSource()), f = add(ctx.createBiquadFilter()), e = gain(0);
            n.buffer = seededNoise(ctx);
            f.type = 'highpass';
            f.frequency.value = hp;
            n.connect(f);
            f.connect(e);
            e.connect(out);
            e.gain.setValueAtTime(level * vel, at);
            if (clap) {
                [.012, .024, .036].forEach(x => { e.gain.setValueAtTime(level * vel * .15, at + x - .004); e.gain.setValueAtTime(level * vel, at + x); });
            }
            e.gain.exponentialRampToValueAtTime(.00001, at + seconds);
            v.source(n, at, at + seconds + .01);
        }
        if (p === 36) {
            tone(150, .32, .85, 43);
            noise(.014, 2500, .06);
        }
        else if (p === 38) {
            tone(185, .11, .2, 105);
            noise(.18, 1400, .46);
        }
        else if (p === 42)
            noise(.055, 7200, .21);
        else if (p === 46)
            noise(.3, 6500, .23);
        else if (p === 39)
            noise(.16, 1700, .46, true);
        else if (p === 45)
            tone(180, .27, .53, 72);
        else if (p === 49)
            noise(.9, 4000, .32);
        else if (p === 37) {
            tone(750, .024, .28, 520);
            noise(.022, 2500, .15);
        }
        else {
            tone(240, .12, .3, 100);
            noise(.1, 3000, .1);
        }
    }
    function sampleVoice({ graph, out, note, track, at, duration, assets }) {
        const assetId = track.preset.slice(7), asset = assets.get(assetId);
        if (!asset)
            throw Error('自定义音源尚未解码。');
        const v = voiceTools(graph, out), source = v.add(graph.ctx.createBufferSource()), env = v.gain(0), rate = asset.meta.mode === 'oneshot' ? 1 : Math.pow(2, (note.pitch - asset.meta.root) / 12);
        source.buffer = asset.buffer;
        source.playbackRate.value = rate;
        source.connect(env);
        env.connect(out);
        const full = source.buffer.duration / rate, gate = asset.meta.mode === 'oneshot' ? full : Math.min(duration, full), release = Math.min(track.sound.release, full - gate), end = at + gate + Math.max(0, release);
        env.gain.setValueAtTime(.00001, at);
        env.gain.linearRampToValueAtTime(note.velocity * .62, at + Math.min(.006, gate * .25));
        env.gain.setValueAtTime(note.velocity * .62, Math.max(at + .007, end - .03));
        env.gain.linearRampToValueAtTime(.00001, end + .006);
        v.source(source, at, end + .01);
    }
    registerInstrument('synth', synthVoice);
    registerInstrument('drum', drumVoice);
    registerInstrument('sample', sampleVoice);
    function renderNote(graph, note, track, at, duration, assets = new Map()) {
        const bus = graph.buses.get(track.id);
        if (!bus)
            return;
        let actualTrack = track, actualNote = note;
        if (track.kind === 'drum' && G.resolveKit) {
            const kit = G.resolveKit(track.drumkitId, graph.project), row = kit?.rows.find(r => r.pitch === note.pitch);
            if (!row)
                throw Error('鼓件尚未配置：' + note.pitch);
            actualNote = { ...note, velocity: note.velocity * row.velocity };
            if (row.source.type === 'sample') {
                actualTrack = { ...track, preset: 'sample:' + row.source.assetId };
                actualNote.pitch = assets.get(row.source.assetId)?.meta.root ?? 60;
            }
            else {
                actualTrack = { ...track, preset: row.source.presetId || track.preset };
                actualNote.pitch = row.source.pitch;
            }
        }
        const preset = presetById(actualTrack.preset, graph.project);
        if (preset.missing)
            throw Error(preset.name + '。请补齐资源或明确选择替代音色。');
        const engine = actualTrack.preset.startsWith('sample:') ? 'sample' : track.kind === 'drum' ? 'drum' : 'synth';
        const renderer = instrumentRenderers.get(preset.engine) || instrumentRenderers.get(engine);
        if (!renderer)
            throw Error('音频引擎尚未注册：' + preset.engine);
        renderer({ graph, out: bus.input, note: actualNote, track: actualTrack, at: Math.max(at, graph.ctx.currentTime), duration, preset, assets });
    }
    function fromDataURL(data) {
        const s = atob(data.split(',')[1]), b = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++)
            b[i] = s.charCodeAt(i);
        return b.buffer;
    }
    async function decodeAssets(ctx, project, cache = new Map(), trackIds = null) {
        const needed = G.neededAssets ? G.neededAssets(project, trackIds || project.tracks.map(t => t.id)) : new Set(Object.keys(project.assets));
        for (const id of [...cache.keys()])
            if (!project.assets[id])
                cache.delete(id);
        for (const id of needed) {
            const meta = project.assets[id];
            if (!meta)
                throw Error('缺少采样：' + id);
            const old = cache.get(id);
            if (old && old.data === meta.data) {
                old.meta = meta;
                continue;
            }
            let buffer;
            try {
                buffer = await ctx.decodeAudioData(fromDataURL(meta.data));
            }
            catch {
                throw Error('采样无法解码：' + meta.name + '（' + id + '）。请重新导入有效 WAV。');
            }
            cache.set(id, { buffer, meta, data: meta.data });
        }
        return cache;
    }
    class AudioEngine {
        constructor() { this.ctx = null; this.graph = null; this.assets = new Map(); this.playing = false; this.starting = false; this.origin = 0; this.fromTime = 0; this.project = null; this.scope = null; this.loop = true; this.error = null; this.lateWindows = 0; this.skippedEvents = 0; this.timer = null; this.previewGraphs = new Set(); this.previewTimers = new Map(); this.pausedAt = 0; this.request = 0; this.previewEpoch = 0; }
        async ready() { if (!this.ctx) {
            const C = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!C)
                throw Error('浏览器没有 Web Audio 支持。');
            this.ctx = new C({ latencyHint: 'interactive' });
        } if (this.ctx.state !== 'running')
            await this.ctx.resume(); return this.ctx; }
        async play(project, scope = null, loop = true, startTick = 0) {
            const request = ++this.request;
            this.stop(false, false);
            this.starting = true;
            try {
                await this.ready();
                if (request !== this.request)
                    return;
                const plan = compileSong(project, scope);
                if (G.assertPlayable)
                    G.assertPlayable(project, plan.trackIds);
                const assets = await decodeAssets(this.ctx, project, this.assets, plan.trackIds);
                if (request !== this.request)
                    return;
                this.project = project;
                this.scope = scope;
                this.loop = loop;
                this.assets = assets;
                this.plan = plan;
                this.graph = createGraph(this.ctx, project);
                this.graph.update(project, this.plan.trackIds, true);
                startTick = clamp(startTick, 0, Math.max(0, this.plan.length - 1));
                const startAt = this.ctx.currentTime + .065, secondsPerTick = 60 / project.bpm / PPQ;
                this.origin = startAt - startTick * secondsPerTick;
                this.fromTime = startAt;
                this.pausedAt = 0;
                this.playing = true;
                this.error = null;
                if (startTick > 0)
                    for (const event of this.plan.events) {
                        if (event.start < startTick && event.start + event.duration > startTick) {
                            const track = project.tracks.find(t => t.id === event.trackId);
                            renderNote(this.graph, event, track, startAt, (event.start + event.duration - startTick) * secondsPerTick, this.assets);
                        }
                    }
                this.tick();
                if (this.playing)
                    this.timer = setInterval(() => this.tick(), 25);
            }
            catch (e) {
                if (request === this.request) {
                    this.error = e;
                    this.stop();
                }
                throw e;
            }
            finally {
                if (request === this.request)
                    this.starting = false;
            }
        }
        pause() { const at = this.position(); this.stop(false); this.pausedAt = at; }
        update(project, scope = this.scope) {
            const changed = JSON.stringify(scope) !== JSON.stringify(this.scope);
            if (!this.playing) {
                this.project = project;
                this.scope = scope;
                if (this.starting)
                    this.play(project, scope, this.loop).catch(e => { this.error = e; });
                return;
            }
            const rebuild = changed || project.tracks.length !== this.graph.buses.size || project.tracks.some(t => !this.graph.buses.has(t.id)) || [...(G.neededAssets ? G.neededAssets(project) : Object.keys(project.assets))].some(id => this.assets.get(id)?.data !== project.assets[id]?.data);
            const at = this.position();
            this.project = project;
            if (rebuild) {
                const oldKind = this.scope?.kind || 'song', newKind = scope?.kind || 'song', sameClock = (['song', 'tracks'].includes(oldKind) && ['song', 'tracks'].includes(newKind)) || JSON.stringify({ ...this.scope, soloIds: [] }) === JSON.stringify({ ...scope, soloIds: [] });
                this.play(project, scope, this.loop, sameClock ? at : 0).catch(e => { this.error = e; });
                return;
            }
            for (const [id, meta] of Object.entries(project.assets))
                if (this.assets.has(id))
                    this.assets.get(id).meta = meta;
            this.plan = compileSong(project, scope);
            if (G.assertPlayable)
                G.assertPlayable(project, this.plan.trackIds);
            this.graph.update(project, this.plan.trackIds);
        }
        tick() {
            if (!this.playing)
                return;
            try {
                const now = this.ctx.currentTime;
                if (this.fromTime < now - .04) {
                    this.lateWindows++;
                    this.fromTime = now + .005;
                }
                const end = now + .13, beatSec = 60 / this.project.bpm, cycleSec = this.plan.length / PPQ * beatSec, from = Math.max(0, this.fromTime - this.origin), to = Math.max(0, end - this.origin);
                if (!this.loop && from >= cycleSec) {
                    if (now >= this.origin + cycleSec + 3)
                        this.stop();
                    return;
                }
                const first = Math.floor(from / cycleSec), last = Math.floor(to / cycleSec);
                let count = 0;
                for (let cycle = first; cycle <= last; cycle++) {
                    if (!this.loop && cycle > 0)
                        break;
                    for (const event of this.plan.events) {
                        const time = this.origin + cycle * cycleSec + event.start / PPQ * beatSec;
                        if (time < this.fromTime - 1e-8 || time >= end - 1e-8)
                            continue;
                        if (count++ > 512 || this.graph.sources.size > 1536) {
                            this.skippedEvents++;
                            continue;
                        }
                        const track = this.project.tracks.find(t => t.id === event.trackId);
                        if (track)
                            renderNote(this.graph, event, track, time, event.duration / PPQ * beatSec, this.assets);
                    }
                }
                this.fromTime = end;
            }
            catch (e) {
                this.error = e;
                this.stop();
            }
        }
        position() { if (!this.playing || !this.plan)
            return this.pausedAt; const t = Math.max(0, (this.ctx.currentTime - this.origin) * this.project.bpm / 60 * PPQ); return this.loop ? t % this.plan.length : Math.min(t, this.plan.length); }
        clearPreviews() { this.previewEpoch++; for (const timer of this.previewTimers.values())
            clearTimeout(timer); this.previewTimers.clear(); for (const graph of this.previewGraphs)
            graph.dispose(); this.previewGraphs.clear(); }
        stop(reset = true, invalidate = true) { if (invalidate)
            this.request++; if (this.timer)
            clearInterval(this.timer); this.timer = null; this.playing = false; this.starting = false; if (reset)
            this.pausedAt = 0; if (this.graph) {
            this.graph.dispose();
            this.graph = null;
        } this.clearPreviews(); }
        async preview(track, pitch, project, duration = .3) {
            const epoch = this.previewEpoch;
            await this.ready();
            if (epoch !== this.previewEpoch)
                return;
            if (G.assertPlayable)
                G.assertPlayable(project, [track.id]);
            await decodeAssets(this.ctx, project, this.assets, [track.id]);
            if (epoch !== this.previewEpoch)
                return;
            if (this.previewGraphs.size >= 8) {
                const old = this.previewGraphs.values().next().value;
                old.dispose();
                this.previewGraphs.delete(old);
                clearTimeout(this.previewTimers.get(old));
                this.previewTimers.delete(old);
            }
            const previewProject = { ...project, tracks: [{ ...track, mute: false }] }, graph = createGraph(this.ctx, previewProject);
            graph.update(previewProject, [track.id], true);
            this.previewGraphs.add(graph);
            try {
                renderNote(graph, { pitch, velocity: .72, id: 'preview' }, track, this.ctx.currentTime + .008, duration, this.assets);
            }
            catch (e) {
                graph.dispose();
                this.previewGraphs.delete(graph);
                throw e;
            }
            this.previewTimers.set(graph, setTimeout(() => { graph.dispose(); this.previewGraphs.delete(graph); this.previewTimers.delete(graph); }, (duration + 3.5) * 1000));
        }
        async exportWav(project, scope = null) {
            const plan = compileSong(project, scope), seconds = plan.length / PPQ * 60 / project.bpm + 3;
            if (G.assertPlayable)
                G.assertPlayable(project, plan.trackIds);
            if (plan.events.length > 20000)
                throw Error('本次音频渲染超过 20,000 个音符，请分段导出或使用 MIDI。');
            if (seconds > 183)
                throw Error('单次 WAV 上限为 3 分钟，请分片段导出。');
            const C = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
            if (!C)
                throw Error('浏览器不支持离线音频渲染。');
            const ctx = new C(2, Math.ceil(seconds * 44100), 44100), assets = await decodeAssets(ctx, project, new Map(), plan.trackIds), graph = createGraph(ctx, project);
            graph.update(project, plan.trackIds, true);
            try {
                for (const n of plan.events) {
                    const t = project.tracks.find(t => t.id === n.trackId);
                    renderNote(graph, n, t, n.start / PPQ * 60 / project.bpm, n.duration / PPQ * 60 / project.bpm, assets);
                }
                const buffer = await ctx.startRendering();
                let peak = 0;
                for (let c = 0; c < buffer.numberOfChannels; c++) {
                    const d = buffer.getChannelData(c);
                    for (let i = 0; i < d.length; i++) {
                        if (!Number.isFinite(d[i]))
                            throw Error('音频包含无效数值，已阻止导出。');
                        peak = Math.max(peak, Math.abs(d[i]));
                    }
                }
                return { blob: new Blob([encodeWav(buffer, peak > .98 ? .98 / peak : 1)], { type: 'audio/wav' }), buffer, peak };
            }
            finally {
                graph.dispose();
            }
        }
    }
    function encodeWav(buffer, scale = 1) {
        const channels = buffer.numberOfChannels, frames = buffer.length, out = new ArrayBuffer(44 + frames * channels * 2), v = new DataView(out);
        let pos = 0;
        const text = s => {
            for (const c of s)
                v.setUint8(pos++, c.charCodeAt(0));
        };
        const u16 = n => { v.setUint16(pos, n, true); pos += 2; };
        const u32 = n => { v.setUint32(pos, n, true); pos += 4; };
        text('RIFF');
        u32(out.byteLength - 8);
        text('WAVE');
        text('fmt ');
        u32(16);
        u16(1);
        u16(channels);
        u32(buffer.sampleRate);
        u32(buffer.sampleRate * channels * 2);
        u16(channels * 2);
        u16(16);
        text('data');
        u32(frames * channels * 2);
        const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
        for (let i = 0; i < frames; i++)
            for (let c = 0; c < channels; c++) {
                const s = clamp(data[c][i] * scale, -1, 1);
                v.setInt16(pos, s < 0 ? s * 32768 : s * 32767, true);
                pos += 2;
            }
        return out;
    }
    async function blobDataURL(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); }); }
    Object.assign(G, { voiceTools, seededNoise, legacyDrumVoice: drumVoice, registerInstrument, createGraph, renderNote, decodeAssets, AudioEngine, encodeWav, blobDataURL });
})(globalThis.GridTone ||= {});
