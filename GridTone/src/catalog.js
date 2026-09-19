/** Validated, data-only sound and template catalog. Projects pin the definitions they use. */
(function (G) {
    'use strict';
    const { clone, clamp, BAR, STEP } = G, ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
    const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
    function assertDataTree(value, depth = 0) { if (depth > 40)
        throw Error('数据层级过深。'); if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) {
            if (forbidden.has(k))
                throw Error('数据包含保留字段：' + k);
            assertDataTree(v, depth + 1);
        } }
    function identifier(v, label = '编号') { if (typeof v !== 'string' || !ID.test(v) || forbidden.has(v))
        throw Error(label + '只可含字母、数字、点、下划线、连字符、冒号。'); return v; }
    function number(v, min, max, label) { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
        throw Error(label + '超出范围。'); return v; }
    const text = (v, fallback, max = 120) => String(v || fallback).slice(0, max);
    function normalizedPreset(input) {
        const p = clone(input);
        identifier(p.id, '音色编号');
        if (p.version !== 1)
            throw Error('音色定义版本应为 1。');
        if (!['fm', 'harmonic', 'organ', 'sub', 'bass', 'pad', 'drum', 'prism-modal','prism-pluck','prism-ep','prism-bass','prism-pad','prism-lead','prism-air','multisample','studio-va','studio-fm4'].includes(p.engine))
            throw Error('尚未接入这个声音算法：' + p.engine);
        if (!['sine', 'triangle', 'square', 'sawtooth'].includes(p.wave))
            throw Error('波形无效。');
        for (const [k, a, b] of [['ratio', .1, 16], ['index', 0, 20], ['release', .03, 3], ['decay', 0, 30]])
            number(p[k], a, b, '音色 ' + k);
        if(p.engine.startsWith('studio-')&&!p.synthesis)throw Error('新引擎需要完整发声定义。');
        const extra={};
        if(p.synthesis!==undefined){if(!G.validateStudioSynthesis)throw Error('当前版本未加载新声音定义校验器。');extra.synthesis=G.validateStudioSynthesis(p.synthesis,p.engine);}
        if(p.profile!==undefined)extra.profile=text(p.profile,'',30);
        if(p.gain!==undefined)extra.gain=number(p.gain,.05,2,'预设输出补偿');
        if(p.tags!==undefined){if(!Array.isArray(p.tags)||p.tags.length>8)throw Error('音色标签最多 8 项。');extra.tags=p.tags.map(v=>text(v,'',30));}
        if(p.origin!==undefined)extra.origin=text(p.origin,'',220);
        if(p.engine==='multisample'){
            if(!Array.isArray(p.zones)||!p.zones.length||p.zones.length>48)throw Error('多采样需要 1–48 个分区。');
            const roots=new Set();extra.zones=p.zones.map(z=>{number(z.root,0,127,'采样根音');if(!Number.isInteger(z.root)||roots.has(z.root))throw Error('多采样根音应为不重复的 MIDI 整数。');roots.add(z.root);return {root:z.root,assetId:identifier(z.assetId),gain:number(z.gain??1,.05,2,'采样补偿')};});
        }
        return { ...extra, id: p.id, version: 1, name: text(p.name, '未命名音色', 80), category: text(p.category, '我的音色', 30), description: text(p.description, '自定义声音', 240), engine: p.engine, wave: p.wave, ratio: p.ratio, index: p.index, release: p.release, decay: p.decay };
    }
    function normalizedKit(input) {
        const k = clone(input);
        identifier(k.id, '鼓组编号');
        if (k.version !== 1 || !Array.isArray(k.rows) || k.rows.length < 1 || k.rows.length > 64)
            throw Error('鼓组需为版本 1，包含 1–64 个鼓件。');
        const pitches = new Set();
        const rows = k.rows.map(r => {
            if (!Number.isInteger(r.pitch) || r.pitch < 0 || r.pitch > 127 || pitches.has(r.pitch))
                throw Error('鼓件位置应为不同的 MIDI 0–127 整数。');
            pitches.add(r.pitch);
            const source = r.source;
            if (!source || !['drum', 'sample'].includes(source.type))
                throw Error('鼓件需要指定合成鼓声或采样。');
            let s;
            if (source.type === 'drum') {
                if (!G.DRUMS.some(d => d.pitch === source.pitch))
                    throw Error('合成鼓件声源只支持内置的八种声音。');
                s = { type: 'drum', pitch: source.pitch };
                if (source.presetId)
                    s.presetId = identifier(source.presetId);
            }
            else
                s = { type: 'sample', assetId: identifier(source.assetId, '采样编号') };
            if(r.role!==undefined&&!Object.keys(G.DRUM_ROLE_PITCH||{kick:36,snare:38,closedHat:42,openHat:46,clap:39,tom:45,crash:49,rim:37}).includes(r.role))throw Error('鼓件角色无效。');
            return { ...(r.role?{role:r.role}:{}), pitch: r.pitch, name: text(r.name, '鼓件', 40), en: text(r.en, '', 30), velocity: number(r.velocity ?? 1, .01, 1, '鼓件力度'), source: s };
        });
        return { id: k.id, version: 1, name: text(k.name, '我的鼓组', 80), rows };
    }
    function normalizedAssets(input = {}) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw Error('音频资源必须是编号到资料的对象。');
        let bytes = 0;
        const out = {};
        for (const [id, a] of Object.entries(input)) {
            identifier(id, '采样编号');
            if (!a || typeof a.data !== 'string' || !/^data:audio\/wav;base64,[A-Za-z0-9+/]+=*$/.test(a.data))
                throw Error('采样必须为内嵌 WAV 数据。');
            bytes += a.data.length * .75;
            if (bytes > G.LIMITS.assetsBytes)
                throw Error('采样超过 24 MB。');
            let header;
            try {
                header = atob(a.data.split(',')[1].slice(0, 64));
            }
            catch {
                throw Error('采样 Base64 无效。');
            }
            if (header.length < 44 || header.slice(0, 4) !== 'RIFF' || header.slice(8, 12) !== 'WAVE')
                throw Error('采样不是有效 WAV 文件。');
            number(a.root, 0, 127, '原始音高');
            if (!Number.isInteger(a.root) || !['pitched', 'oneshot'].includes(a.mode))
                throw Error('采样原始音高或播放方式无效。');
            out[id] = { name: text(a.name, '我的采样', 80), data: a.data, root: a.root, mode: a.mode };
        }
        return out;
    }
    function unique(items, label) { const seen = new Set(); for (const x of items) {
        if (seen.has(x.id))
            throw Error(label + '编号重复：' + x.id);
        seen.add(x.id);
    } return items; }
    function validateSnapshot(raw) {
        if (!raw)
            return { presets: [], drumkits: [] };
        assertDataTree(raw);
        if (!Array.isArray(raw.presets || []) || !Array.isArray(raw.drumkits || []) || (raw.presets?.length || 0) > 512 || (raw.drumkits?.length || 0) > 128)
            throw Error('工程素材快照格式或数量无效。');
        const snap = { presets: unique((raw.presets || []).map(normalizedPreset), '音色'), drumkits: unique((raw.drumkits || []).map(normalizedKit), '鼓组') };
        for (const p of snap.presets) {
            const built = G.PRESETS.find(x => x.id === p.id);
            if (built && JSON.stringify(normalizedPreset(built)) !== JSON.stringify(p))
                throw Error('工程快照不能替换内置音色：' + p.id);
        }
        for (const kit of snap.drumkits) {
            const built = G.BUILTIN_CATALOG?.drumkits?.find(x => x.id === kit.id);
            if (built && JSON.stringify(normalizedKit(built)) !== JSON.stringify(kit))
                throw Error('工程快照不能替换内置鼓组：' + kit.id);
        }
        return snap;
    }
    const builtin = G.BUILTIN_CATALOG || { id: 'builtin', name: '内置', drumkits: [], templates: [], assets: {} };
    const library = { presets: new Map(G.PRESETS.map(p => [p.id, normalizedPreset(p)])), drumkits: new Map((builtin.drumkits || []).map(k => [k.id, normalizedKit(k)])), templates: new Map((builtin.templates || []).map(t => [t.id, clone(t)])), assets: new Map(), packs: new Map() };
    function resolvePreset(id, project) {
        if (id?.startsWith('sample:')) {
            const a = project?.assets?.[id.slice(7)];
            return { id, name: a?.name || '缺少采样 · ' + id.slice(7), category: '我的采样', engine: 'sample', missing: !a };
        }
        return project?.catalog?.presets?.find(p => p.id === id) || library.presets.get(id) || { id, name: '缺失音色 · ' + id, category: '缺失', engine: 'missing', description: '请导入原音色包，或手动选择替代音色。', missing: true };
    }
    function resolveKit(id = 'builtin.standard', project) { return project?.catalog?.drumkits?.find(k => k.id === id) || library.drumkits.get(id) || null; }
    function projectPresets(p) { return [...new Map([...library.presets.values(), ...(p?.catalog?.presets || [])].map(x => [x.id, x])).values()]; }
    function projectKits(p) { return [...new Map([...library.drumkits.values(), ...(p?.catalog?.drumkits || [])].map(x => [x.id, x])).values()]; }
    function drumsFor(p, t) {
        const kit = resolveKit(t.drumkitId || 'builtin.standard', p), rows = kit ? kit.rows : G.DRUMS;
        // Missing rows remain visible for repair; playback reports the missing mapping.
        const extra = [...new Set(t.patterns.flatMap(p => p.notes.map(n => n.pitch)))].filter(p => !rows.some(r => r.pitch === p));
        return [...rows, ...extra.map(pitch => ({ pitch, name: '未配置鼓件 ' + pitch, en: 'MISSING', missing: true }))];
    }
    function neededAssets(p, trackIds = p.tracks.map(t => t.id)) {
        const ids = new Set();
        for (const t of p.tracks.filter(t => trackIds.includes(t.id))) {
            if (t.preset.startsWith('sample:'))
                ids.add(t.preset.slice(7));
            for(const z of resolvePreset(t.preset,p).zones||[])ids.add(z.assetId);
            if (t.kind === 'drum')
                for (const r of resolveKit(t.drumkitId, p)?.rows || [])
                    if (r.source.type === 'sample')
                        ids.add(r.source.assetId);
        }
        return ids;
    }
    function missingResources(p, trackIds = p.tracks.map(t => t.id)) {
        const issues = [];
        for (const t of p.tracks.filter(t => trackIds.includes(t.id))) {
            const add = message => issues.push({ trackId: t.id, message: t.name + '：' + message });
            const preset = resolvePreset(t.preset, p);
            if (preset.missing)
                add(preset.name);
            for(const z of preset.zones||[])if(!p.assets[z.assetId])add('缺少多采样资源 '+z.assetId);
            if (t.kind === 'drum') {
                if (preset.engine !== 'drum')
                    add('鼓轨需要鼓声预设；自己的采样可配置到鼓组行。');
                const kit = resolveKit(t.drumkitId, p);
                if (!kit) {
                    add('缺少鼓组 ' + t.drumkitId);
                    continue;
                }
                for (const r of kit.rows) {
                    if (r.source.type === 'sample' && !p.assets[r.source.assetId])
                        add('缺少鼓件采样 ' + r.source.assetId);
                    if (r.source.presetId) {
                        const x = resolvePreset(r.source.presetId, p);
                        if (x.missing || x.engine !== 'drum')
                            add('缺少鼓声引擎预设 ' + r.source.presetId);
                    }
                }
                for (const pitch of new Set(t.patterns.flatMap(p => p.notes.map(n => n.pitch))))
                    if (!kit.rows.some(r => r.pitch === pitch))
                        add('未配置鼓件位置 ' + pitch);
            }
            else if (preset.engine === 'drum')
                add('旋律轨需要旋律音色。');
        }
        return issues;
    }
    function assertPlayable(p, ids) { const issues = missingResources(p, ids); if (issues.length)
        throw Error(issues.map(x => x.message).slice(0, 4).join('；') + '。请补齐资源或明确选择替代声音。'); }
    function attachAsset(p, id) { if (p.assets[id])
        return; const a = library.assets.get(id); if (!a)
        throw Error('缺少采样 ' + id); p.assets[id] = clone(a); }
    function pinPreset(p, id, { allowMissing = false } = {}) {
        const preset = resolvePreset(id, p);
        if (preset.missing)
            throw Error('缺少音色 ' + id);
        if (id.startsWith('sample:')) {
            attachAsset(p, id.slice(7));
            return;
        }
        for(const zone of preset.zones||[])if(!allowMissing || p.assets[zone.assetId] || library.assets.has(zone.assetId))attachAsset(p,zone.assetId);
        if (!G.PRESETS.some(x => x.id === id)) {
            p.catalog ||= { presets: [], drumkits: [] };
            if (!p.catalog.presets.some(x => x.id === id))
                p.catalog.presets.push(clone(preset));
        }
    }
    function pinKit(p, id, { allowMissing = false } = {}) {
        const k = resolveKit(id, p);
        if (!k)
            throw Error('缺少鼓组 ' + id);
        if (!builtin.drumkits?.some(x => x.id === id)) {
            p.catalog ||= { presets: [], drumkits: [] };
            if (!p.catalog.drumkits.some(x => x.id === id))
                p.catalog.drumkits.push(clone(k));
        }
        for (const r of k.rows) {
            if (r.source.type === 'sample' && (!allowMissing || p.assets[r.source.assetId] || library.assets.has(r.source.assetId)))
                attachAsset(p, r.source.assetId);
            if (r.source.presetId && (!allowMissing || !resolvePreset(r.source.presetId, p).missing))
                pinPreset(p, r.source.presetId);
        }
    }
    function pinDocument(p) { for (const t of p.tracks) {
        if (!resolvePreset(t.preset, p).missing)
            pinPreset(p, t.preset, { allowMissing: true });
        if (t.kind === 'drum' && resolveKit(t.drumkitId, p))
            pinKit(p, t.drumkitId || 'builtin.standard', { allowMissing: true });
    } return p; }
    function normalizeTemplate(input) {
        const t = clone(input);
        identifier(t.id, '模板编号');
        if (t.version !== 1 || !['pattern', 'song'].includes(t.type))
            throw Error('模板类型或版本无效。');
        const metadata={};for(const k of ['familyId','variant'])if(t[k]!==undefined)metadata[k]=text(t[k],'',120); if(t.role!==undefined){if(!['drums','melody','bass','chords','texture','song'].includes(t.role))throw Error('模板角色无效。');metadata.role=t.role;} if(t.tags!==undefined){if(!Array.isArray(t.tags)||t.tags.length>8)throw Error('模板标签最多 8 项。');metadata.tags=t.tags.map(x=>text(x,'',30));} if(t.bpm!==undefined)metadata.bpm=number(t.bpm,40,240,'建议速度');
        if(t.attributions!==undefined){if(!Array.isArray(t.attributions)||t.attributions.length>128)throw Error('素材来源信息过多或无效。');metadata.attributions=t.attributions.map(a=>{if(!a||typeof a!=='object'||typeof a.credit!=='string'||typeof a.license!=='string')throw Error('素材来源需要作者和许可。');return {id:text(a.id,'source',120),credit:text(a.credit,'',300),license:text(a.license,'',80),description:text(a.description,'',500),...(a.sourceFile?{sourceFile:text(a.sourceFile,'',500)}:{}),...(a.sha256?{sha256:text(a.sha256,'',80)}:{}),...(Array.isArray(a.sourceBars)&&a.sourceBars.length===2?{sourceBars:a.sourceBars.map(n=>number(n,1,100000,'来源小节'))}:{})};});}
        const common = { ...metadata, id: t.id, version: 1, type: t.type, name: text(t.name, '未命名模板', 80), description: text(t.description, '可以继续编辑的音乐素材。', 240) };
        if (t.type === 'song')
            return { ...common, project: G.validateProject(t.project) };
        if (!['melodic', 'drum'].includes(t.kind) || !G.PATTERN_BARS.includes(t.bars) || !Array.isArray(t.notes) || t.notes.length > 10000)
            throw Error('片段模板轨道类型、长度或音符数量无效。');
        if (!Number.isInteger(t.key) || t.key < 0 || t.key > 11 || !G.SCALES[t.scale])
            throw Error('模板参考调性无效。');
        if(t.harmony){const hp={bars:t.bars,notes:t.notes,harmony:t.harmony};G.validateCreativeMetadata(hp);common.harmony=clone(t.harmony);}
        const notes = t.notes.map(n => { number(n.pitch, 0, 127, '音高'); if (!Number.isInteger(n.pitch))
            throw Error('音高必须是整数。'); number(n.start, 0, t.bars * BAR - 1, '开始位置'); number(n.duration, 1, t.bars * BAR - n.start, '时长'); number(n.velocity, .01, 1, '力度'); if(n.performed!==undefined&&typeof n.performed!=='boolean')throw Error('演奏标记必须为布尔值。'); return { pitch: n.pitch, start: n.start, duration: n.duration, velocity: n.velocity, ...(n.performed===undefined?{}:{performed:n.performed}) }; });
        return { ...common, kind: t.kind, bars: t.bars, key: t.key, scale: t.scale, presetId: identifier(t.presetId || (t.kind === 'drum' ? 'drums' : 'epiano')), drumkitId: t.kind === 'drum' ? identifier(t.drumkitId || 'builtin.standard') : undefined, notes };
    }
    function validateCatalog(raw) {
        assertDataTree(raw);
        if (!raw || raw.format !== 'gridtone.catalog' || raw.version !== 1)
            throw Error('请导入 gridtone.catalog 版本 1 的 JSON 素材包。');
        identifier(raw.id, '素材包编号');
        for (const key of ['presets', 'drumkits', 'templates'])
            if (raw[key] !== undefined && (!Array.isArray(raw[key]) || raw[key].length > 512))
                throw Error('素材清单格式或数量无效：' + key);
        return { format: 'gridtone.catalog', version: 1, id: raw.id, name: text(raw.name, '我的素材包', 80), presets: unique((raw.presets || []).map(normalizedPreset), '音色'), drumkits: unique((raw.drumkits || []).map(normalizedKit), '鼓组'), templates: unique((raw.templates || []).map(normalizeTemplate), '模板'), assets: normalizedAssets(raw.assets || {}) };
    }
    function installCatalog(raw) {
        const pack = validateCatalog(raw);
        if (library.packs.has(pack.id)) {
            if (JSON.stringify(library.packs.get(pack.id)) === JSON.stringify(pack))
                return { pack, duplicate: true };
            throw Error('这个素材包编号已存在且内容不同。请使用新的素材包编号。');
        }
        // Validate collisions and dependencies before a single library mutation.
        for (const kind of ['presets', 'drumkits', 'templates'])
            for (const x of pack[kind]) {
                const old = library[kind].get(x.id);
                if (old && JSON.stringify(old) !== JSON.stringify(x))
                    throw Error('素材编号冲突：' + x.id + '。请使用新的编号，已有作品不会被覆盖。');
            }
        for (const [id, a] of Object.entries(pack.assets)) {
            const old = library.assets.get(id);
            if (old && JSON.stringify(a) !== JSON.stringify(old))
                throw Error('采样编号冲突：' + id);
        }
        const presets = new Map([...library.presets, ...pack.presets.map(p => [p.id, p])]), kits = new Map([...library.drumkits, ...pack.drumkits.map(p => [p.id, p])]), assets = new Set([...library.assets.keys(), ...Object.keys(pack.assets)]);
        const needPreset = id => { if (id.startsWith('sample:')) {
            if (!assets.has(id.slice(7)))
                throw Error('素材包缺少采样 ' + id.slice(7));
        }
        else if (!presets.has(id))
            throw Error('素材包缺少音色定义 ' + id); };
        for(const preset of pack.presets)for(const z of preset.zones||[])if(!assets.has(z.assetId))throw Error('音色缺少采样 '+z.assetId);
        for (const k of pack.drumkits)
            for (const r of k.rows) {
                if (r.source.type === 'sample' && !assets.has(r.source.assetId))
                    throw Error('鼓组缺少采样 ' + r.source.assetId);
                if (r.source.presetId) {
                    needPreset(r.source.presetId);
                    if (presets.get(r.source.presetId)?.engine !== 'drum')
                        throw Error('鼓件引用的预设必须是鼓声引擎。');
                }
            }
        for (const t of pack.templates) {
            if (t.type === 'pattern') {
                needPreset(t.presetId);
                const engine = t.presetId.startsWith('sample:') ? 'sample' : presets.get(t.presetId).engine;
                if ((t.kind === 'drum') !== (engine === 'drum'))
                    throw Error('模板音轨类型与音色引擎不匹配：' + t.id);
                if (t.kind === 'drum' && !kits.has(t.drumkitId))
                    throw Error('模板缺少鼓组 ' + t.drumkitId);
            }
            else {
                for (const tr of t.project.tracks) {
                    if (!t.project.catalog?.presets.some(p => p.id === tr.preset) && !tr.preset.startsWith('sample:'))
                        needPreset(tr.preset);
                    if (tr.preset.startsWith('sample:') && !t.project.assets[tr.preset.slice(7)] && !assets.has(tr.preset.slice(7)))
                        throw Error('曲目模板缺少采样 ' + tr.preset);
                    if (tr.kind === 'drum' && !kits.has(tr.drumkitId || 'builtin.standard') && !t.project.catalog?.drumkits.some(k => k.id === tr.drumkitId))
                        throw Error('曲目模板缺少鼓组 ' + tr.drumkitId);
                }
            }
        }
        for (const kind of ['presets', 'drumkits', 'templates'])
            for (const x of pack[kind])
                library[kind].set(x.id, clone(x));
        for (const [id, a] of Object.entries(pack.assets))
            library.assets.set(id, clone(a));
        library.packs.set(pack.id, clone(pack));
        return { pack, duplicate: false };
    }
    const catalogRevision=()=>library.packs.size;
    const catalogPackCount=()=>[...library.packs.values()].filter(p=>!G.BUNDLED_CATALOG_IDS?.includes(p.id)).length;
    const catalogTemplates=()=>[...library.templates.values()].map(clone);
    function catalogContents({includePacks=true}={}) { return { presets: [...library.presets.values()].map(clone), drumkits: [...library.drumkits.values()].map(clone), templates: catalogTemplates(), packs: includePacks?[...library.packs.values()].filter(p=>!G.BUNDLED_CATALOG_IDS?.includes(p.id)).map(clone):[] }; }
    function getTemplate(id) { const t = library.templates.get(id); if (!t)
        throw Error('找不到这个模板。'); return clone(t); }
    function newIdentity(p) { const copy=G.copyProject(p);copy.title=p.title;return copy; }
    function templateNotes(t, p, adapt, target) { let notes = t.notes.map(n => ({ ...n, id: G.uid('n') })); if (t.kind === 'melodic' && adapt !== 'original')
        notes = G.changeNotePitches(notes, { mode: adapt === 'adapt' ? 'adapt' : 'key', sourceKey: t.key, sourceScale: t.scale, targetKey: p.key, targetScale: p.scale }); if(t.kind==='drum' && (target.drumkitId||'builtin.standard')!==t.drumkitId){if(!G.remapDrums)throw Error('鼓角色映射模块未载入。');notes=G.remapDrums(notes,G.resolveKit(t.drumkitId,p).rows,G.drumsFor(p,target));}return notes; }
    function applyTemplate(project, template, options = {}) {
        const t = normalizeTemplate(template);
        if (t.type === 'song') {
            const p = newIdentity(clone(t.project));
            for (const tr of p.tracks) {
                if (tr.preset.startsWith('sample:'))
                    attachAsset(p, tr.preset.slice(7));
            }
            pinDocument(p);
            G.validateProject(p);
            assertPlayable(p);
            return { project: p, trackId: p.tracks[0].id, patternId: p.tracks[0].patterns[0].id, clipId: p.tracks[0].clips[0]?.id || null };
        }
        const p = clone(project), mode = options.mode || 'new', adapt = options.adapt || 'original';
        if (!['new', 'replace', 'new-track'].includes(mode) || !['original', 'key', 'adapt'].includes(adapt))
            throw Error('模板应用方式无效。');
        let track = mode === 'new-track' ? G.newTrack(t.kind, p.tracks.length, t.presetId) : p.tracks.find(tr => tr.id === options.trackId);
        if (!track)
            throw Error('请选择目标音轨。');
        if (track.kind !== t.kind)
            throw Error('模板与目标音轨类型不同，请选择新增音轨。');
        if (mode === 'new-track') {
            if (p.tracks.length >= 64)
                throw Error('音轨达到 64 条上限。');
            track.name = t.name;
            track.patterns = [];
            track.clips = [];
            p.tracks.push(track);
        }
        if (mode === 'new-track' || options.applySound) {
            if (t.presetId.startsWith('sample:'))
                attachAsset(p, t.presetId.slice(7));
            pinPreset(p, t.presetId);
            track.preset = t.presetId;
            if (t.kind === 'drum') {
                pinKit(p, t.drumkitId);
                track.drumkitId = t.drumkitId;
            }
        }
        let pat, clip;
        const notes = templateNotes(t, p, adapt, track);
        if (mode === 'replace') {
            pat = track.patterns.find(x => x.id === options.patternId);
            if (!pat)
                throw Error('替换的片段不存在。');
            if (t.bars > pat.bars || pat.bars % t.bars !== 0)
                throw Error(`模板为 ${t.bars} 小节，当前片段为 ${pat.bars} 小节。请选择新增片段，或先调整片段长度。`);
            pat.notes = Array.from({ length: pat.bars / t.bars }, (_, b) => notes.map(n => ({ ...n, id: G.uid('n'), start: n.start + b * t.bars * BAR }))).flat();
            clip = track.clips.find(c => c.patternId === pat.id);
        }
        else {
            const bar = Number(options.bar ?? 0);
            if (!Number.isInteger(bar) || bar < 0 || bar + t.bars > 256)
                throw Error('插入位置超出 256 小节范围。');
            p.bars = Math.max(p.bars, Math.ceil((bar + t.bars) / 4) * 4);
            pat = G.newPattern(t.name, t.bars);
            pat.notes = notes;
            if (!G.canPlace(track, pat, bar, p.bars))
                throw Error('这个位置已有片段。请选择空位或新增音轨。');
            track.patterns.push(pat);
            clip = { id: G.uid('c'), patternId: pat.id, bar };
            track.clips.push(clip);
        }
        if(t.harmony){
            if(adapt==='adapt')throw Error('带和声说明的模板请保持原调或整体移调；级数适配需要重新确认和弦。');
            const h=clone(t.harmony),delta=adapt==='key'?((p.key-t.key+18)%12)-6:0;
            h.events=Array.from({length:pat.bars/t.bars},(_,i)=>t.harmony.events.map(e=>({...e,start:e.start+i*t.bars*BAR,rootPitchClass:G.pitchClass(e.rootPitchClass+delta),...(e.pitchClasses?{pitchClasses:e.pitchClasses.map(x=>G.pitchClass(x+delta))}:{})}))).flat();
            G.confirmHarmony(pat,h);
        }else{delete pat.harmony;}
        delete pat.retention;delete pat.generation;if(t.attributions)pat.attributions=clone(t.attributions);G.annotateStudioMaterial?.(pat,t.id);
        if(mode==='new-track'&&['drums','melody','bass','chords','texture'].includes(t.role))track.role=t.role;
        pinDocument(p);
        const checked = G.validateProject(p);
        assertPlayable(checked, [track.id]);
        return { project: checked, trackId: track.id, patternId: pat.id, clipId: clip?.id || null };
    }
    Object.assign(G, { assertDataTree, identifier, validateSnapshot, validateCatalog, installCatalog, catalogContents, catalogTemplates, catalogRevision, catalogPackCount, getTemplate, resolvePreset, resolveKit, projectPresets, projectKits, drumsFor, neededAssets, missingResources, assertPlayable, pinPreset, pinKit, pinDocument, applyTemplate, normalizedAssets });
})(globalThis.GridTone ||= {});
