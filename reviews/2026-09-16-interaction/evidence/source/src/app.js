(function (G) {
    'use strict';
    const { BAR, STEP, PPQ, KEYS, SCALES, DRUMS, PRESETS, clamp, uid, clone, noteName, inScale, newNote, newPattern, newTrack, blankProject, demoProject, validateProject, transformNotes, chordNotes, processPattern, canPlace, firstFreeBar, copyPattern, presetById, AudioEngine, encodeMidi, downloadBlob, safeFilename, saveLocal, loadLocal } = G;
    const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
    const { esc, icon, button, ib, miniPattern, slider } = G.ui;
    const engine = new AudioEngine();
    let project = G.applyTemplate(blankProject(), G.getTemplate('prism.song.glass')).project;
    let pendingPitch = null;
    const S = G.createEditorSession(project), B = G.createPlaybackContext();
    const playback = new G.PlaybackController(engine, () => project, () => S, B, () => { updateTransport(); const l = $('#playback-label'); if (l)
        l.textContent = G.playbackLabel(project, S, B); }, message => toast(message));
    function snapshot() { const copy = clone({ ...project, assets: {} }); copy.assets = Object.fromEntries(Object.entries(project.assets).map(([id, a]) => [id, { ...a }])); return copy; }
    function fingerprint(p) { return JSON.stringify({ ...p, assets: Object.fromEntries(Object.entries(p.assets).map(([id, a]) => [id, { name: a.name, root: a.root, mode: a.mode, length: a.data.length }])) }); }
    const history = [], future = [];
    let saveTimer = null, toastTimer = null, interacted = false, rangeBefore = null, recording = null, renderCounter = 0, persistSerial = 0;
    const track = () => project.tracks.find(t => t.id === S.trackId) || project.tracks[0];
    const pattern = () => track().patterns.find(p => p.id === S.patternId) || track().patterns[0];
    function syncSelection() { return G.reconcileSession(S, project, B); }
    function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
    function markChanged(before) {
        if (fingerprint(before) === fingerprint(project))
            return;
        history.push(before);
        if (history.length > 60)
            history.shift();
        future.length = 0;
        persist();
        playback.updateProject();
    }
    function mutate(fn, { draw = true } = {}) {
        const before = snapshot();
        try {
            fn();
            markChanged(before);
            syncSelection();
            if (draw)
                render();
        }
        catch (e) {
            project = before;
            syncSelection();
            render();
            toast(e.message);
        }
    }
    function persist() {
        S.saveStatus = '正在保存…';
        updateStatus();
        clearTimeout(saveTimer);
        const serial = ++persistSerial;
        saveTimer = setTimeout(async () => {
            try {
                await saveLocal(project);
                if (serial === persistSerial)
                    S.saveStatus = '已保存在本机';
            }
            catch (e) {
                S.saveStatus = '本机保存失败 · 请下载工程';
            }
            updateStatus();
        }, 350);
    }
    function updateStatus() {
        const el = $('.save-status');
        if (el)
            el.innerHTML = `<i class="status-dot ${/失败|不可用/.test(S.saveStatus) ? 'warning' : ''}"></i>${esc(S.saveStatus)}`;
        const footer=$('#storage-status');if(footer){footer.textContent=S.saveStatus;footer.classList.toggle('storage-warning',/失败|不可用/.test(S.saveStatus));}
    }
    function undo() {
        if (!history.length)
            return;
        engine.stop();
        future.push(snapshot());
        project = history.pop();
        syncSelection();
        persist();
        render();
    }
    function redo() {
        if (!future.length)
            return;
        engine.stop();
        history.push(snapshot());
        project = future.pop();
        syncSelection();
        persist();
        render();
    }
    function openPattern(options) {
        const previousTrack=S.trackId;
        const previousTab=S.editorTab;
        G.openPatternInSession(S, project, options);
        if(options.preserveEditorTab && S.view==='edit') S.editorTab=previousTab;
        if(S.trackId!==previousTrack){S.tab='全部';S.query='';if(track().kind==='drum'&&S.soundSource==='recorded')S.soundSource='curated';}
        playback.editorChanged();
        render();
    }
    function changeView(view) {
        if (view === 'sound') {
            S.view = 'edit';
            S.editorTab = 'sound';
            render();
            return;
        }
        if (['arrange', 'mix'].includes(view))
            playback.leaveEditor();
        S.view = view === 'edit' ? 'edit' : view === 'mix' ? 'mix' : 'arrange';
        render();
    }
    function selectTrack(id) { openPattern({ trackId: id, edit: S.view === 'edit', preserveEditorTab:true }); }
    function selectPattern(id) { openPattern({ patternId: id }); }
    function trackIcon(t) { return t.kind === 'drum' ? 'drum' : presetById(t.preset, project).category === '低音' ? 'bass' : presetById(t.preset, project).category === '键盘' ? 'piano' : 'melody'; }
    function presetName(t) { return t.preset.startsWith('sample:') ? project.assets[t.preset.slice(7)]?.name || '自定义音源' : presetById(t.preset, project).name; }
    function defaultPitch(t) { return t.kind === 'drum' ? (G.drumsFor(project, t).find(r => !r.missing)?.pitch ?? 36) : pattern().notes[0]?.pitch || 60; }
    function preview(t, pitch, d = .25) { engine.preview(t, pitch, project, d).catch(e => toast(e.message)); }
    const catalogContext = { getProject: () => project, getSession: () => S, playback, button, esc, openModal, closeModal, toast, pickFile, render,
        repin: () => mutate(() => { G.pinDocument(project); }),
        commit: result => {
            playback.stop();
            const wholeSong = result.project.id !== project.id;
            mutate(() => {
                project = result.project;
                if (wholeSong) {
                    Object.assign(S, G.createEditorSession(project));
                    Object.assign(B, G.createPlaybackContext());
                }
                G.openPatternInSession(S, project, { trackId: result.trackId, patternId: result.patternId, clipId: result.clipId, edit: !wholeSong });
            });
        }
    };
    const materials = new G.CatalogUI(catalogContext), composer = new G.ComposerUI(catalogContext);
    function render() {
        // Preserve scroll and focus across deterministic DOM renders.
        const previous = $('.view-content');
        if (previous?.dataset.scrollkey) {
            S.scrolls[previous.dataset.scrollkey] = { x: previous.scrollLeft, y: previous.scrollTop };
            for (const el of previous.querySelectorAll('[data-scroll]'))
                S.scrolls[previous.dataset.scrollkey + ':' + el.dataset.scroll] = { x: el.scrollLeft, y: el.scrollTop };
        }
        const focusToken = G.ui.captureFocus();
        syncSelection();
        renderCounter++;
        const t = track(), p = pattern(), scrollKey = S.view + ':' + (S.view === 'edit' ? S.trackId + ':' + S.patternId + ':' + S.editorTab : '');
        $('#app').innerHTML = G.views.renderShell({ ...viewContext(), engine, history, future, renderEditor, renderArrange, renderMix, scrollKey });
        updateStatus();
        if (S.view === 'edit' && S.editorTab === 'notes')
            drawGrid();
        updateTransport();
        const current = $('.view-content'), scroll = S.scrolls[scrollKey];
        if (scroll) {
            current.scrollLeft = scroll.x;
            current.scrollTop = scroll.y;
        }
        for (const el of current.querySelectorAll('[data-scroll]')) {
            const v = S.scrolls[scrollKey + ':' + el.dataset.scroll];
            if (v) {
                el.scrollLeft = v.x;
                el.scrollTop = v.y;
            }
        }
        G.ui.restoreFocus(focusToken);
        if (S.modal) document.querySelector('#app').inert = true;
        G.saveWorkspace(S, project.id);
    }
    function viewContext() { return { project, S, B, compact: window.matchMedia("(max-width:600px)").matches, track, pattern, button, ib, icon, esc, miniPattern, slider, presetName, trackIcon, soundCards, waveIllustration, renderSound, renderPipeline }; }
    function renderEditor() { return G.views.renderEditor(viewContext()); }
    function renderPipeline() { return G.views.renderPipeline(viewContext()); }
    function getRows() { return G.visiblePitches(project, S, track(), pattern()); }
    let geo = { width: 960, left: 72, top: 28, row: 26, cw: 55, rows: [], height: 0 };
    function drawGrid() {
        const next = G.views.drawPianoRoll({ ...viewContext(), getRows, drag: interactions?.getDrag() });
        if (next) { geo = next; interactions?.setGeometry(next); updatePlayhead(); }
    }

    function renderArrange() { return G.views.renderArrange(viewContext()); }

    function soundCards() { return G.views.soundCards(viewContext()); }

    function renderSound() { return G.views.renderSound(viewContext()); }
    function waveIllustration(t) { return G.views.waveIllustration(t,project); }

    function renderMix() { return G.views.renderMix(viewContext()); }
    let pendingConfirm = null, pendingForm = null;
    function openModal(title, body, subtitle = '') {
        S.modal = true;
        G.ui.modal.open(title, body, subtitle);
    }
    function closeModal() {
        if(typeof bankRequest!=="undefined" && bankRequest){bankRequest.abort();bankRequest=null;}
        playback.endAudition();
        pendingPitch = null;
        if (recording) {
            recording.cancelled = true;
            if (recording.recorder.state !== 'inactive')
                recording.recorder.stop();
        }
        S.modal = false;
        G.ui.modal.close();
        pendingConfirm = null;
        pendingForm = null;
    }
    function confirmAction(title, message, fn) { pendingConfirm = fn; openModal(title, `<p class="modal-copy">${message}</p><div class="modal-actions">${button('close-modal', '取消', '', 'soft-btn')}${button('confirm', '确认', '', 'dark-btn')}</div>`); }
    function textForm(title, value, fn, label = '名称') {
        pendingForm = () => {
            const value = $('#form-value').value.trim();
            if (!value) {
                toast('先写一个名字。');
                return;
            }
            fn(value);
            closeModal();
        };
        openModal(title, `<label class="form-label">${label}<input id="form-value" value="${esc(value)}" maxlength="80" autocomplete="off"></label><div class="modal-actions">${button('close-modal', '取消', '', 'soft-btn')}${button('submit-form', '保存', 'check', 'dark-btn')}</div>`);
        requestAnimationFrame(() => $('#form-value')?.select());
    }
    function openHelp() { openModal('音乐，从一个格子开始。', `<div class="help-steps"><div><b>01</b><h3>先听见它</h3><p>打开时有一段原创示例。点击播放，然后逐条静音，听听每条音轨的作用。</p></div><div><b>02</b><h3>在画板上写</h3><p>点空白放音符，横拖画长音。拖音符本体移动，拖右边缘改长度；和弦工具一次放入多个独立音符。</p></div><div><b>03</b><h3>从 A 走到 A′</h3><p>点击“创建 A′”保留原片段，再反转、镜像或改几个音。到编排页面，把片段排成一首歌。</p></div></div><div class="help-table"><div><span>空格</span><b>播放 / 暂停（再次点击从暂停位置继续）</b></div><div><span>Ctrl / ⌘ Z</span><b>撤销；加 Shift 重做</b></div><div><span>Ctrl / ⌘ C、V</span><b>复制 / 粘贴选中的音符</b></div><div><span>Delete / Backspace</span><b>删除选中的音符</b></div><div><span>方向键</span><b>左右移动一格；上下移动半音</b></div><div><span>触屏浏览</span><b>沿音高尺拖动浏览音域；“浏览”工具滚动画板</b></div></div><div class="help-note"><b>视图 / 创作辅助 / 音符编辑：</b>浏览音域和参考调性保留已有音符；升降八度、移调和镜像明确改写音符。音色作用于整条音轨。试听本片段会独立隔离当前内容；“只听”可多轨叠加。默认导出全曲忽略临时只听。</div><div class="help-note">鼓轨：点已有鼓点可擦除；横划连续添加或擦除。画板底部的力度条可以上下拖动。音符右键 / 长按可打开操作菜单。跨小节长音属于同一音符。</div><div class="help-note">应用会尝试自动保存在当前浏览器，请留意顶部保存状态。重要作品请下载 <b>.gridtone</b> 工程备份；清除浏览器数据会删除本机存档。录音仅保存在本机，应用不上传音频。</div><div class="modal-actions">${button('close-modal', '开始画音乐', 'pencil', 'dark-btn')}</div>`); }
    function addPatternAndPlace(t, p) {
        t.patterns.push(p);
        let bar = firstFreeBar(t, p, project.bars);
        if (bar < 0) {
            bar = project.bars;
            const needed = bar + p.bars;
            if (needed > G.LIMITS.bars)
                throw Error('歌曲达到 256 小节上限。');
            project.bars = Math.min(G.LIMITS.bars, Math.ceil(needed / 4) * 4);
        }
        const c = { id: uid('c'), patternId: p.id, bar };
        t.clips.push(c);
        S.clipId = c.id;
        S.patternId = p.id;
        S.page = 0;
        S.selected = [];
    }
    function resizePattern(bars, double = false) {
        const t = track(), p = pattern();
        mutate(() => {
            const old = p.bars, proposed = { ...p, bars };
            for (const c of t.clips.filter(c => c.patternId === p.id)) {
                if (!canPlace(t, proposed, c.bar, project.bars, c.id))
                    throw Error('扩展后会碰到相邻片段。先在编排中留出空位，或创建一个新片段。');
            }
            if (bars < old && p.notes.some(n => n.start + n.duration > bars * BAR))
                throw Error('缩短会截掉音符。请先移动或删除后面小节的音符。');
            if (double && bars === old * 2)
                p.notes = transformNotes(p.notes, 'double', old * BAR);
            p.bars = bars;
            S.page = clamp(S.page, 0, bars - 1);
        });
    }
    function selectedNotes() { return pattern().notes.filter(n => S.selected.includes(n.id)); }
    function copyNotes() {
        const n = selectedNotes();
        if (!n.length) {
            toast('先选择音符。');
            return;
        }
        S.clipboard = { notes: clone(n), kind: track().kind };
        S.cursor = Math.max(...n.map(x => x.start + x.duration));
        if (S.cursor >= pattern().bars * BAR)
            S.cursor = 0;
        toast('已复制 ' + n.length + ' 个音符');
        render();
    }
    function pasteNotes() {
        if (!S.clipboard)
            return;
        if (S.clipboard.kind !== track().kind) {
            toast('鼓点和旋律音符请分别粘贴到同类音轨。');
            return;
        }
        mutate(() => {
            const p = pattern(), notes = clone(S.clipboard.notes), min = Math.min(...notes.map(n => n.start)), span = Math.max(...notes.map(n => n.start + n.duration)) - min;
            if (span > p.bars * BAR)
                throw Error('片段长度不足，先增加小节数。');
            const at = clamp(S.cursor, 0, p.bars * BAR - span);
            notes.forEach(n => { n.id = uid('n'); n.start = n.start - min + at; });
            p.notes.push(...notes);
            S.selected = notes.map(n => n.id);
            S.cursor = at + span;
        });
    }
    function deleteNotes() {
        if (!S.selected.length)
            return;
        mutate(() => { pattern().notes = pattern().notes.filter(n => !S.selected.includes(n.id)); S.selected = []; });
    }
    async function togglePlay() { await playback.toggle(); render(); }
    function transposeDialog() {
        if (track().kind === 'drum') {
            toast('鼓组按鼓件编辑。');
            return;
        }
        const tid = S.trackId, pid = S.patternId, ids = [...S.selected], before = fingerprint(project);
        const sourceKey = project.key, sourceScale = project.scale;
        const candidate = () => { if (fingerprint(project) !== before)
            throw Error('工程在预览期间发生了变化，请重新打开移调窗口。'); return G.pitchCandidate(project, tid, pid, ids, { mode: $('#transpose-mode').value, semitones: Number($('#transpose-amount').value), sourceKey, sourceScale, targetKey: Number($('#transpose-key').value), targetScale: $('#transpose-scale').value }); };
        pendingPitch = { candidate, tid, pid };
        openModal('移调与调式适配', `<p class="modal-copy">作用于 ${ids.length ? '选中的 ' + ids.length + ' 个音符' : '本片段全部音符'}。预听保持原稿；确认后写入实际音符，可一次撤销。</p><label class="form-label">方式<select id="transpose-mode"><option value="semitone">整体移动半音 · 保持音程</option><option value="key">整体换主音 · 最近方向</option><option value="adapt">按级数适配调式 · 保留原有变化音偏移</option></select></label><div class="form-grid"><label class="form-label">移动半音（方式一）<input id="transpose-amount" type="number" min="-24" max="24" step="1" value="2"></label><label class="form-label">目标主音（方式二、三）<select id="transpose-key">${KEYS.map((v, i) => `<option value="${i}" ${i === sourceKey ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="form-label">目标调式（方式三）<select id="transpose-scale">${Object.entries({ major: '大调', minor: '小调', pentatonic: '五声音阶', chromatic: '半音阶' }).map(([k, l]) => `<option value="${k}" ${k === sourceScale ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div><p class="modal-copy">级数适配适用于同音级数的音阶（例如大调到小调）；原调外音保留相对最近调内音的半音偏移。参考调性保持原设置。</p><div class="modal-actions">${button('preview-pitch', '预听结果', 'headphones', 'soft-btn')}${button('stop', '停止试听', 'stop', 'quiet')}${button('apply-pitch', '确认修改', 'check', 'dark-btn')}</div>`);
    }
    function exportDialog() { openModal('导出作品', `<label class="field-row export-scope">导出范围<select id="export-scope"><option value="song">整首作品 · ${project.bars} 小节</option><option value="pattern">当前片段 · ${pattern().bars} 小节</option><option value="current">当前试听范围（含临时只听）</option></select></label><div class="export-options">${button('export-wav', 'WAV 音频', 'wave', 'export-option')}${button('export-midi', 'MIDI 乐谱', 'piano', 'export-option')}${button('export-project', '声格工程', 'file', 'export-option')}</div><div class="export-descriptions"><p>默认导出作品混音，保留作品静音设置，忽略临时只听。工程文件始终包含全曲。</p><p><b>WAV</b>：44.1 kHz / 16-bit 立体声，包含音色与效果，附 3 秒尾音。单次最多 3 分钟。</p><p><b>MIDI</b>：导出音符、速度、移调、琶音和律动，供其他编曲软件继续编辑；具体音色与音频效果不会随 MIDI 保留。</p><p><b>声格工程</b>：保存整首作品的所有音符、设置和自定义音源，可重新打开接着写。</p></div><p id="export-progress" class="export-progress" role="status"></p>`); }
    async function doExport(type) {
        const exportProject = snapshot(), range = $('#export-scope')?.value || 'song', scope = playback.exportScope(range), name = safeFilename(project.title) + (range === 'song' ? '' : '_' + safeFilename(range === 'pattern' ? pattern().name : G.playbackLabel(project, S, B)));
        try {
            if (type === 'project') {
                downloadBlob(new Blob([JSON.stringify(exportProject, null, 2)], { type: 'application/json' }), safeFilename(project.title) + '.gridtone');
                toast('工程已打包，包含自定义音源。');
                return;
            }
            if (type === 'midi') {
                downloadBlob(new Blob([encodeMidi(exportProject, scope)], { type: 'audio/midi' }), name + '.mid');
                toast('MIDI 已生成。音色与音频效果请用 WAV 保留。');
                return;
            }
            if (S.exportBusy)
                return;
            S.exportBusy = true;
            engine.stop();
            updateTransport();
            $$('.export-options button').forEach(b => b.disabled = true);
            const status = $('#export-progress');
            if (status)
                status.textContent = '正在合成音频，完整保留音色与效果…';
            await new Promise(r => setTimeout(r, 30));
            const result = await engine.exportWav(exportProject, scope);
            downloadBlob(result.blob, name + '.wav');
            if ($('#export-progress'))
                $('#export-progress').textContent = 'WAV 已生成 · ' + (result.blob.size / 1024 / 1024).toFixed(1) + ' MB';
            toast('WAV 音频已生成。');
        }
        catch (e) {
            toast(e.message);
            if ($('#export-progress'))
                $('#export-progress').textContent = e.message;
        }
        finally {
            S.exportBusy = false;
            $$('.export-options button').forEach(b => b.disabled = false);
        }
    }
    function pickFile(accept, handler) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = () => {
            if (input.files?.[0])
                handler(input.files[0]);
        };
        input.click();
    }
    function loadProject(raw) {
        const checked = G.pinDocument(validateProject(raw));
        playback.stop();
        history.push(snapshot());
        if (history.length > 60)
            history.shift();
        future.length = 0;
        project = checked;
        Object.assign(S, G.createEditorSession(project));
        Object.assign(B, G.createPlaybackContext());
        G.restoreWorkspace(S, project);
        syncSelection();
        persist();
        closeModal();
        render();
    }
    async function importProject(file) {
        try {
            if (file.size > 40 * 1024 * 1024)
                throw Error('工程文件超过 40 MB。');
            loadProject(JSON.parse(await file.text()));
            toast('已打开工程：' + project.title);
        }
        catch (e) {
            toast('没有导入：' + e.message);
        }
    }
    async function addSample(blob, name) {
        try {
            if (blob.size > 12 * 1024 * 1024)
                throw Error('单个音源文件请控制在 12 MB 内。');
            const ctx = await engine.ready(), buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
            if (buffer.duration > 30)
                throw Error('当前采样乐器支持 30 秒以内的声音，请先裁剪。');
            if (buffer.duration < .02)
                throw Error('这段声音太短，至少需要 20 毫秒。');
            let peak = 0;
            for (let c = 0; c < buffer.numberOfChannels; c++)
                for (const s of buffer.getChannelData(c))
                    peak = Math.max(peak, Math.abs(s));
            if (peak < .00001)
                throw Error('这段录音基本无声，请检查麦克风。');
            const data = await G.blobDataURL(new Blob([G.encodeWav(buffer, peak > .98 ? .98 / peak : 1)], { type: 'audio/wav' }));
            mutate(() => {
                const size = Object.values(project.assets).reduce((s, a) => s + a.data.length * .75, 0) + data.length * .75;
                if (size > G.LIMITS.assetsBytes)
                    throw Error('内嵌音源已超过 24 MB。');
                const id = uid('a');
                project.assets[id] = { name: name.replace(/\.[^.]+$/, ''), root: 60, mode: 'pitched', data };
                let t = track();
                if (t.kind === 'drum') {
                    if (project.tracks.length >= 64)
                        throw Error('最多支持 64 条音轨。');
                    t = newTrack('melodic', project.tracks.length);
                    t.name = '我的采样';
                    project.tracks.push(t);
                    S.trackId = t.id;
                    S.patternId = t.patterns[0].id;
                }
                t.preset = 'sample:' + id;
                S.view = 'edit';
                S.editorTab = 'sound';
                S.tab = '全部';
            });
            closeModal();
            toast('音源已加入，并会随工程文件一起保存。');
        }
        catch (e) {
            toast('音源没有导入：' + e.message);
        }
    }
    async function recordSample() {
        try {
            if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder)
                throw Error('当前环境不能录音。请使用 localhost 或 HTTPS 打开，或直接导入音频文件。');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }), recorder = new MediaRecorder(stream), chunks = [];
            const rec = { recorder, stream, cancelled: false, start: Date.now(), timer: null, interval: null };
            recording = rec;
            recorder.ondataavailable = e => {
                if (e.data.size)
                    chunks.push(e.data);
            };
            recorder.onstop = async () => {
                clearTimeout(rec.timer);
                clearInterval(rec.interval);
                stream.getTracks().forEach(t => t.stop());
                if (recording === rec)
                    recording = null;
                if (!rec.cancelled)
                    await addSample(new Blob(chunks, { type: recorder.mimeType }), '我的录音 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
            };
            recorder.onerror = e => { rec.cancelled = true; stream.getTracks().forEach(t => t.stop()); clearTimeout(rec.timer); clearInterval(rec.interval); recording = null; toast('录音失败，请检查麦克风权限。'); };
            recorder.start();
            openModal('把身边的声音，变成乐器。', `<div class="recording-box"><div class="recording-circle">${icon('mic', 38)}</div><strong id="record-time">00:00</strong><p>拍一下桌子、哼一个音，或者录下雨声。<br>最多 30 秒；停止后自动加入“我的声音”。</p>${button('stop-record', '停止并保存', 'stop', 'dark-btn')}</div>`);
            rec.timer = setTimeout(() => {
                if (recorder.state !== 'inactive')
                    recorder.stop();
            }, 30000);
            rec.interval = setInterval(() => {
                const el = $('#record-time');
                if (el)
                    el.textContent = '00:' + String(Math.floor((Date.now() - rec.start) / 1000)).padStart(2, '0');
            }, 250);
        }
        catch (e) {
            toast(e.message);
        }
    }
    function noteMenu() { openModal('音符操作', `<p class="modal-copy">已选择 ${S.selected.length} 个音符。拖动音符可以移动，拖右边缘可以改长度。</p><div class="menu-grid">${button('menu-copy', '复制', 'copy', 'soft-btn')}${button('menu-split', '从中间拆开', 'split', 'soft-btn')}${button('menu-delete', '删除', 'trash', 'soft-btn')}${button('select-all', '全选', '', 'soft-btn')}</div>`); }
    function appearanceDialog() {
        const a=G.appearance.get();
        openModal('外观 · Prism', `<div class="appearance-grid">${[['crystal','冰晶','清透冷白 · 海蓝色控制'],['pearl','暖珠','珍珠暖白 · 玫紫色控制']].map(([id,name,desc])=>`<button class="skin-card ${a.skin===id?'active':''}" data-action="choose-skin" data-skin="${id}" aria-pressed="${a.skin===id}"><span class="skin-swatch ${id}" aria-hidden="true"></span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><label class="field-row"><span>减少透明度，优先清晰与性能</span><input type="checkbox" data-field="reduce-transparency" ${a.transparency==='reduced'?'checked':''}></label><p class="appearance-note">通透材质用于播放台与浮层；画板保持清晰。外观偏好仅保存在本机，换肤不会修改作品。系统开启“减少动态”时，界面自动停用过渡动画。</p>`, '同一套排版和控件，两种光线。');
    }
    let bankRequest=null;
    async function loadSampleBank(id){
        const bank=G.SAMPLE_BANKS.find(x=>x.id===id);if(!bank)return;
        if(bankRequest)bankRequest.abort();const controller=new AbortController();bankRequest=controller;
        openModal(bank.name,`<p class="modal-copy">将从 VSCO 2 CE 官方公开仓库载入 ${bank.zones.length} 个采样，制作成本机可用的轻量音色。声音载入成功后再选择“使用”，当前作品保持原样。</p><div class="source-detail">真实乐器录音 · CC0-1.0<br>单力度、多音高，最长 6 秒；不包含原库全部演奏法。<br>来源：Versilian Studios / Sam Gossner / Simon Dalzell<br><a class="source-link" href="https://github.com/sgossner/VSCO-2-CE/blob/6dd651d55dde97fd4028699be9d4481f26917891/LICENSE" target="_blank" rel="noopener noreferrer">查看来源与 CC0 授权</a></div><progress class="sample-progress" id="bank-progress" max="${bank.zones.length}" value="0"></progress><p id="bank-status" class="field-note" role="status">正在连接音源服务器…</p><div class="modal-actions">${button('close-modal','取消载入','','quiet')}</div>`,'首次需要联网；不会上传你的作品。');
        const timer=setTimeout(()=>controller.abort(),90000);
        try{
            const pack=await G.downloadSampleBank(id,{signal:controller.signal,onProgress:({done,total})=>{const p=$('#bank-progress'),l=$('#bank-status');if(p)p.value=done;if(l)l.textContent=`已载入 ${done} / ${total} 个采样…`;}});
            if(controller.signal.aborted)return;G.installCatalog(pack);
            try{await G.saveCatalogPacks(G.catalogContents().packs);}catch{}
            bankRequest=null;closeModal();S.soundSource='recorded';S.tab='全部';render();toast(bank.name+' 已就绪。点击试听，或使用到本轨。');
        }catch(e){if(controller.signal.aborted){if(bankRequest===controller&&S.modal){const l=$('#bank-status');if(l)l.textContent='载入已取消或超时。关闭后可重试；当前作品没有变化。';}return;}const l=$('#bank-status');if(l)l.textContent='载入失败：'+e.message+'。请检查网络后重试；当前作品没有变化。';}
        finally{clearTimeout(timer);if(bankRequest===controller)bankRequest=null;}
    }
    function soundAudition(id){
        const p=snapshot(),preset=G.resolvePreset(id,p),kind=preset.engine==='drum'?'drum':'melodic';
        const t=G.newTrack(kind,0,id),pat=t.patterns[0];p.tracks=[t];p.bars=1;p.bpm=100;p.swing=0;p.master=.8;t.volume=.65;t.fx={reverb:.12,delay:0,drive:0};t.sound={brightness:.72,attack:.004,release:.32};
        G.pinPreset(p,id);const mode=kind==='drum'?'drum':S.auditionMode||'melody';
        if(mode==='drum'){pat.notes=[...Array.from({length:8},(_,i)=>G.newNote(42,i*480,240,i%2?.5:.65)),G.newNote(36,0,240,.8),G.newNote(36,1920,240,.8),G.newNote(38,960,240,.75),G.newNote(38,2880,240,.75)];}
        else if(mode==='chord')pat.notes=[60,64,67,71].map(n=>G.newNote(n,0,G.BAR-240,.7));
        else pat.notes=(mode==='bass'?[36,36,43,46,43]:[60,64,67,71,67]).map((n,i)=>G.newNote(n,[0,720,1440,2160,2880][i],480,.72));
        playback.audition(p,{kind:'pattern',trackId:t.id,patternId:pat.id,ignoreMute:true},'音色比较 · '+preset.name);
    }
    function handleAction(action, el) {
        if(action==='sound-source'){playback.endAudition();S.soundSource=el.dataset.source;S.tab='全部';S.query='';render();return;}
        if(action==='sound-audition'){try{soundAudition(el.dataset.id);}catch(e){toast(e.message);}return;}
        if(action==='load-sample-bank'){loadSampleBank(el.dataset.id);return;}
        if(action==='audition-key'){preview(track(),+el.dataset.pitch,.5);return;}
        if(action==='key-octave'){S.keyOctave=G.clamp((S.keyOctave??4)+Number(el.dataset.delta),1,6);render();return;}

        if(action==='appearance'){appearanceDialog();return;}
        if(action==='choose-skin'){G.appearance.set({skin:el.dataset.skin});appearanceDialog();return;}
        if (composer.handleAction(action, el) || materials.handleAction(action, el))
            return;
        const id = el.dataset.id;
        if (action === 'home') {
            changeView('arrange');
        }
        else if (action === 'view')
            changeView(el.dataset.view);
        else if (action === 'open-current')
            openPattern({ patternId: S.patternId });
        else if (action === 'open-sound') {
            if (S.view !== 'edit')
                openPattern({ patternId: S.patternId });
            S.editorTab = 'sound';
            S.tab = '全部';
            render();
        }
        else if (action === 'editor-tab') {
            S.editorTab = el.dataset.tab;
            render();
        }
        else if (action === 'editor-group') {
            S.editorGroup = S.editorGroup === el.dataset.group ? null : el.dataset.group;
            render();
        }
        else if (action === 'fit-notes') {
            G.fitViewport(S, track(), pattern());
            render();
        }
        else if (action === 'zoom-in' || action === 'zoom-out') {
            const v = G.viewportFor(S, track());
            v.rowHeight = clamp(v.rowHeight + (action === 'zoom-in' ? 3 : -3), 18, 42);
            v.zoomX = clamp(v.zoomX + (action === 'zoom-in' ? .25 : -.25), 1, 3);
            render();
        }
        else if (action === 'track')
            selectTrack(id);
        else if (action === 'pattern')
            selectPattern(id);
        else if (action === 'page') {
            S.page = +el.dataset.page;
            S.selected = [];
            playback.editorChanged();
            render();
        }
        else if (action === 'listen-pattern' || action === 'listen-bar' || action === 'listen-tracks') {
            playback.start(action.slice(7)).then(render);
        }
        else if (action === 'play')
            togglePlay();
        else if (action === 'stop') {
            playback.stop();
            updateTransport();
            updatePlayhead();
        }
        else if (action === 'loop') {
            B.loop = !B.loop;
            engine.loop = B.loop;
            render();
        }
        else if (action === 'undo')
            undo();
        else if (action === 'redo')
            redo();
        else if (action === 'tool') {
            S.tool = el.dataset.tool;
            render();
        }
        else if (action === 'scale-lock') {
            S.showScale = !S.showScale;
            render();
        }
        else if (action === 'octave-up' || action === 'octave-down') {
            G.moveViewport(S, track(), action === 'octave-up' ? 12 : -12);
            render();
        }
        else if (action === 'toggle-sidebar') {
            S.sidebar = !S.sidebar;
            render();
        }
        else if (action === 'close-sidebar' || action === 'dismiss-sidebar') {
            S.sidebar = false;
            render();
        }
        else if (action === 'mute')
            mutate(() => { const t = project.tracks.find(t => t.id === id); if (t)
                t.mute = !t.mute; });
        else if (action === 'solo') {
            playback.toggleSolo(id);
            render();
        }
        else if (action === 'clear-solo') {
            playback.restoreSong();
            render();
        }
        else if (action === 'rename-song')
            textForm('作品名称', project.title, v => mutate(() => project.title = v));
        else if (action === 'rename-pattern')
            textForm('片段名称', pattern().name, v => mutate(() => pattern().name = v));
        else if (action === 'rename-track') {
            pendingForm = () => {
                const v = $('#form-value').value.trim();
                if (!v)
                    return;
                mutate(() => track().name = v);
                closeModal();
            };
            openModal('音轨设置', `<label class="form-label">名称<input id="form-value" value="${esc(track().name)}" maxlength="60"></label><div class="modal-actions">${button('remove-track', '删除这条音轨', 'trash', 'danger-btn')}${button('submit-form', '保存', 'check', 'dark-btn')}</div>`);
        }
        else if (action === 'remove-track') {
            if (project.tracks.length === 1) {
                toast('请至少保留一条音轨。');
                return;
            }
            confirmAction('删除这条音轨？', '这条音轨的所有片段会一起删除，可以用撤销恢复。', () => mutate(() => { project.tracks = project.tracks.filter(t => t.id !== S.trackId); S.trackId = project.tracks[0].id; S.patternId = project.tracks[0].patterns[0].id; }));
        }
        else if (action === 'add-track')
            openModal('添加音轨', `<div class="track-choices">${[['epiano', '和弦 / 键盘', '用几个长音，搭出歌曲的情绪。', 'piano'], ['roundbass', '贝斯 / 低音', '让节奏有一个稳稳的底。', 'bass'], ['marimba', '旋律 / 主音', '画出你想哼唱的那条线。', 'melody'], ['drums', '鼓机 / 打击乐', '用 16 格，写一段身体会跟着动的节奏。', 'drum'], ['cloudpad', '氛围 / 长音', '慢慢展开，让画面更宽一些。', 'wave']].map(([id, l, d, ic]) => `<button class="track-choice" data-action="create-track" data-preset="${id}"><span>${icon(ic, 27)}</span><div><strong>${l}</strong><p>${d}</p></div>${icon('plus', 20)}</button>`).join('')}</div>`);
        else if (action === 'create-track') {
            mutate(() => {
                if (project.tracks.length >= 64)
                    throw Error('当前版本最多支持 64 条音轨。');
                const preset = el.dataset.preset, t = newTrack(preset === 'drums' ? 'drum' : 'melodic', project.tracks.length, preset);
                t.name = presetById(preset).name;
                if (preset === 'roundbass')
                    G.viewportFor(S, t).low = 24;
                project.tracks.push(t);
                S.trackId = t.id;
                S.patternId = t.patterns[0].id;
                S.view = 'edit';
                S.selected = [];
                S.sidebar = false;
            });
            closeModal();
        }
        else if (action === 'add-pattern')
            mutate(() => addPatternAndPlace(track(), newPattern('片段 ' + String.fromCharCode(65 + track().patterns.length % 26))));
        else if (action === 'duplicate-pattern')
            mutate(() => addPatternAndPlace(track(), copyPattern(pattern())));
        else if (action === 'transpose-dialog')
            transposeDialog();
        else if (action === 'preview-pitch') {
            try {
                const p = pendingPitch.candidate();
                playback.audition(p, { kind: 'pattern', trackId: pendingPitch.tid, patternId: pendingPitch.pid, ignoreMute: true }, '移调候选 · 原稿保持不变');
            }
            catch (e) {
                toast(e.message);
            }
        }
        else if (action === 'apply-pitch') {
            try {
                const p = pendingPitch.candidate();
                closeModal();
                mutate(() => { project = p; });
            }
            catch (e) {
                toast(e.message);
            }
        }
        else if (action === 'transform')
            mutate(() => { const p = pattern(), ids = new Set(S.selected), src = ids.size ? p.notes.filter(n => ids.has(n.id)) : p.notes, result = el.dataset.transform === 'mirror-scale' ? G.mirrorDegree(src, project.key, project.scale) : transformNotes(src, el.dataset.transform, p.bars * BAR); p.notes = ids.size ? p.notes.filter(n => !ids.has(n.id)).concat(result) : result; });
        else if (action === 'select-all') {
            S.selected = pattern().notes.map(n => n.id);
            closeModal();
            render();
        }
        else if (action === 'copy-notes' || action === 'menu-copy') {
            copyNotes();
            if (action === 'menu-copy')
                closeModal();
        }
        else if (action === 'paste-notes')
            pasteNotes();
        else if (action === 'delete-notes' || action === 'menu-delete') {
            deleteNotes();
            if (action === 'menu-delete')
                closeModal();
        }
        else if (action === 'shorten-notes' || action === 'lengthen-notes')
            mutate(() => {
                for (const n of selectedNotes())
                    n.duration = clamp(action === 'shorten-notes' ? Math.round(n.duration / 2 / STEP) * STEP : n.duration * 2, STEP, pattern().bars * BAR - n.start);
            });
        else if (action === 'split-notes' || action === 'menu-split') {
            mutate(() => {
                const p = pattern(), result = [];
                for (const n of p.notes) {
                    if (S.selected.includes(n.id) && n.duration >= STEP * 2) {
                        const half = Math.floor(n.duration / STEP / 2) * STEP;
                        result.push({ ...n, duration: half }, { ...n, id: uid('n'), start: n.start + half, duration: n.duration - half });
                    }
                    else
                        result.push(n);
                }
                p.notes = result;
            });
            if (action === 'menu-split')
                closeModal();
        }
        else if (action === 'clear-pattern')
            confirmAction('清空当前片段？', '同一片段在编排中的所有引用会一起更新。可以用撤销恢复。', () => mutate(() => { pattern().notes = []; S.selected = []; }));
        else if (action === 'drum-fill')
            materials.listing('templates');
        else if (action === 'groove')
            openModal('给节奏一点松紧', `${slider('十六分 Swing', 'project', 'swing', project.swing, 0, .45, .01)}<p class="modal-copy">每对十六分音符中的第二个音稍微晚一点，力度不变。0% 是均匀网格。底层仍保存高精度时间，WAV 和 MIDI 会保留这个变化。</p><div class="modal-actions">${button('close-modal', '完成', 'check', 'dark-btn')}</div>`);
        else if (action === 'sound-details') { S.soundDetails=!S.soundDetails; render(); }
        else if (action === 'sound-category') {
            S.tab = el.dataset.category;
            render();
        }
        else if (action === 'preset') {
            mutate(() => { G.pinPreset(project, id); track().preset = id; });
            preview(track(), defaultPitch(track()));
        }
        else if (action === 'custom-preset') {
            if (track().kind === 'drum') {
                toast('请先添加一条旋律轨，用它演奏自定义音源。');
                return;
            }
            mutate(() => track().preset = 'sample:' + id);
            preview(track(), 60);
        }
        else if (action === 'preview')
            preview(track(), defaultPitch(track()), .8);
        else if (action === 'bake-pipeline')
            confirmAction('把处理结果写回音符？', '将本轨所有片段的琶音、移调与轻微错拍变为实际音符，然后复位这些处理器。全曲 Swing 保持不变。', () => mutate(() => { const t = track(); t.patterns.forEach(p => p.notes = processPattern(p, t, { ...project, swing: 0 })); t.pipeline = { transpose: 0, arp: 'off', rate: STEP, humanize: 0 }; }));
        else if (action === 'record')
            recordSample();
        else if (action === 'stop-record') {
            if (recording?.recorder.state === 'recording')
                recording.recorder.stop();
        }
        else if (action === 'import-sample')
            pickFile('audio/*', file => addSample(file, file.name));
        else if (action === 'export')
            exportDialog();
        else if (action === 'export-wav')
            doExport('wav');
        else if (action === 'export-midi')
            doExport('midi');
        else if (action === 'export-project')
            doExport('project');
        else if (action === 'help')
            openHelp();
        else if (action === 'project-menu')
            openModal('你的音乐手账', `<div class="menu-grid">${button('new-project', '从空白开始', 'plus', 'soft-btn')}${button('open-project', '打开工程文件', 'folder', 'soft-btn')}${button('export-project', '下载工程备份', 'save', 'soft-btn')}${button('load-demo', '载入原创示例', 'headphones', 'soft-btn')}</div><p class="modal-copy">自动保存属于当前浏览器。换设备继续写，先下载工程备份，再到另一台设备打开它。</p>`);
        else if (action === 'new-project' || action === 'load-demo')
            confirmAction(action === 'new-project' ? '开始一张空白画板？' : '重新载入示例？', '当前内容会被替换。重要作品请先下载工程备份；也可立即使用撤销找回。', () => { loadProject(action === 'new-project' ? blankProject() : demoProject()); S.view = 'edit'; render(); });
        else if (action === 'open-project')
            pickFile('.gridtone,.json,application/json', importProject);
        else if (action === 'close-modal')
            closeModal();
        else if (action === 'confirm') {
            const fn = pendingConfirm;
            closeModal();
            fn?.();
        }
        else if (action === 'submit-form')
            pendingForm?.();
        else if (action === 'add-bars')
            mutate(() => {
                if (project.bars + 4 > 256)
                    throw Error('最多支持 256 小节。');
                project.bars += 4;
            });
        else if (action === 'repeat-song')
            mutate(() => {
                const old = project.bars;
                if (old * 2 > 256)
                    throw Error('重复后超过 256 小节。');
                for (const t of project.tracks)
                    t.clips.push(...t.clips.map(c => ({ ...c, id: uid('c'), bar: c.bar + old })));
                project.bars *= 2;
            });
        else if (action === 'place-clip') {
            const t = project.tracks.find(t => t.id === el.dataset.track), bar = +el.dataset.bar;
            openModal(`第 ${bar + 1} 小节 · 放入片段`, `<div class="clip-choices">${t.patterns.map(p => button('place-pattern', p.name, 'grid', 'soft-btn', `data-track="${t.id}" data-pattern="${p.id}" data-bar="${bar}" ${canPlace(t, p, bar, project.bars) ? '' : 'disabled'}`)).join('')}${button('place-new-pattern', '新建空白片段', 'plus', 'dark-btn', `data-track="${t.id}" data-bar="${bar}"`)}</div><p class="modal-copy">已有片段放入后共享内容。需要分别修改时，选择色块并点击“独立副本”。</p>`);
        }
        else if (action === 'place-pattern' || action === 'place-new-pattern') {
            mutate(() => {
                const t = project.tracks.find(t => t.id === el.dataset.track), bar = +el.dataset.bar, p = action === 'place-new-pattern' ? newPattern('片段 ' + String.fromCharCode(65 + t.patterns.length % 26)) : t.patterns.find(p => p.id === el.dataset.pattern);
                if (!canPlace(t, p, bar, project.bars))
                    throw Error('这里没有足够的空位。');
                if (action === 'place-new-pattern')
                    t.patterns.push(p);
                const c = { id: uid('c'), patternId: p.id, bar };
                t.clips.push(c);
                S.trackId = t.id;
                S.patternId = p.id;
                S.clipId = c.id;
            });
            closeModal();
        }
        else if (['edit-clip', 'duplicate-clip', 'unlink-clip', 'delete-clip'].includes(action)) {
            const t = project.tracks.find(t => t.clips.some(c => c.id === S.clipId)), c = t?.clips.find(c => c.id === S.clipId);
            if (!c)
                return;
            if (action === 'edit-clip') {
                openPattern({ trackId: t.id, clipId: c.id });
            }
            else
                mutate(() => {
                    const p = t.patterns.find(p => p.id === c.patternId);
                    if (action === 'delete-clip') {
                        t.clips = t.clips.filter(x => x.id !== c.id);
                        S.clipId = null;
                    }
                    if (action === 'unlink-clip') {
                        const cp = copyPattern(p);
                        t.patterns.push(cp);
                        c.patternId = cp.id;
                        S.patternId = cp.id;
                    }
                    if (action === 'duplicate-clip') {
                        let bar = firstFreeBar(t, p, project.bars, c.bar + p.bars);
                        if (bar < 0) {
                            bar = project.bars;
                            if (bar + p.bars > 256)
                                throw Error('超过 256 小节上限。');
                            project.bars = Math.ceil((bar + p.bars) / 4) * 4;
                        }
                        const cp = { ...c, id: uid('c'), bar };
                        t.clips.push(cp);
                        S.clipId = cp.id;
                    }
                });
        }
        else if (action === 'reset-mix')
            confirmAction('重置混音？', '各轨音量恢复到 65%，左右居中，取消静音与独奏，恢复少量混响。音符和音色保持不变。', () => mutate(() => {
                for (const t of project.tracks) {
                    t.volume = .65;
                    t.pan = 0;
                    t.mute = false;
                    B.soloIds = [];
                    t.fx = { reverb: .2, delay: 0, drive: 0 };
                }
                project.master = .8;
            }));
    }
    document.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target || target.disabled)
            return;
        e.preventDefault();
        handleAction(target.dataset.action, target);
    });
    document.addEventListener('dblclick', e => {
        const c = e.target.closest('[data-clip]');
        if (c) {
            S.clipId = c.dataset.clip;
            handleAction('edit-clip', c);
        }
    });
    function handleField(el) {
        if(el.dataset.field==='reduce-transparency'){G.appearance.set({transparency:el.checked?'reduced':'normal'});return;}
        if (composer.handleField(el) || materials.handleField(el))
            return;
        const f = el.dataset.field, v = el.value;
        if(f==='audition-mode'){playback.endAudition();S.auditionMode=v;return;}
        if (f === 'editor-track') {
            selectTrack(v);
            return;
        }
        if (f === 'input-snap') {
            S.inputSnap = el.checked;
            render();
            return;
        }
        if (f === 'viewport-span') {
            const w = G.viewportFor(S, track());
            w.span = +v;
            w.low = clamp(w.low, 0, 127 - w.span);
            render();
            return;
        }
        if (f === 'monitor-track') {
            const id = el.dataset.id;
            B.selectedTrackIds = el.checked ? [...new Set([...B.selectedTrackIds, id])] : B.selectedTrackIds.filter(x => x !== id);
            if (B.target === 'tracks') {
                if (B.selectedTrackIds.length)
                    playback.updateProject();
                else
                    playback.setTarget('song');
            }
            render();
            return;
        }
        if (f === 'preset-select') {
            mutate(() => { G.pinPreset(project, v); track().preset = v; });
            preview(track(), defaultPitch(track()));
            return;
        }
        if (f === 'scope') {
            playback.setTarget(v);
            render();
            return;
        }
        if (f === 'chord') {
            S.chord = v;
            return;
        }
        if (f === 'pattern-length') {
            resizePattern(+v);
            return;
        }
        mutate(() => {
            if (f === 'bpm') {
                engine.stop();
                project.bpm = clamp(Math.round(+v) || 100, 40, 240);
            }
            if (f === 'key')
                project.key = +v;
            if (f === 'scale')
                project.scale = v;
            if (f === 'arp')
                track().pipeline.arp = v;
            if (f === 'arp-rate')
                track().pipeline.rate = +v;
            if (f === 'sample-root')
                project.assets[track().preset.slice(7)].root = +v;
            if (f === 'sample-mode')
                project.assets[track().preset.slice(7)].mode = v;
        });
    }
    document.addEventListener('change', e => {
        if (e.target.id?.startsWith('transpose-'))
            playback.endAudition();
        if (e.target.dataset.field)
            handleField(e.target);
        if (e.target.dataset.range) {
            if (rangeBefore) {
                markChanged(rangeBefore);
                rangeBefore = null;
            }
            render();
        }
    });
    document.addEventListener('input', e => {
        const el = e.target;
        if (el.dataset.field==='catalog-search'){materials.handleField(el);return;}
        if (el.id === 'sound-search') {
            S.query = el.value;
            $('#sound-cards').innerHTML = soundCards();
            return;
        }
        if (!el.dataset.range)
            return;
        if (!rangeBefore)
            rangeBefore = snapshot();
        const [group, key] = el.dataset.range.split('.'), v = +el.value, t = project.tracks.find(t => t.id === el.dataset.track) || track();
        if (group === 'project')
            project[key] = v;
        else if (group === 'track')
            t[key] = v;
        else
            t[group][key] = v;
        playback.updateProject();
        const readout = el.closest('.slider-control')?.querySelector('b');
        if (readout)
            readout.textContent = group === 'pipeline' ? (key === 'transpose' ? v + ' 半音' : v + ' ticks') : key === 'attack' ? Math.round(v * 1000) + ' ms' : key === 'release' ? v.toFixed(2) + ' s' : key === 'pan' ? v === 0 ? '居中' : (v < 0 ? '左 ' : '右 ') + Math.round(Math.abs(v) * 100) : Math.round(v * 100) + '%';
        const db = $(`[data-volume="${t.id}"]`);
        if (db && key === 'volume')
            db.textContent = (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '−∞') + ' dB';
    });
    const interactions = G.createEditorInteractions({ S, B, getProject: () => project, setProject: p => { project=p; },
        track, pattern, snapshot, markChanged, render, drawGrid, preview, selectedNotes, noteMenu, openPattern, toast,
        closeModal, togglePlay, undo, redo, handleAction, mutate, copyNotes, pasteNotes, deleteNotes,
        interact: () => { interacted=true; }, beginRange: () => { rangeBefore=snapshot(); },
        commitRange: () => { if (rangeBefore) { markChanged(rangeBefore); rangeBefore=null; } },
        hasForm: () => !!pendingForm, submitForm: () => pendingForm?.()
    });
    function updateTransport() {
        const btn = $('[data-action="play"]');
        if (btn && btn.getAttribute('aria-label') !== (engine.playing ? '暂停' : '播放')) {
            btn.innerHTML = icon(engine.playing ? 'pause' : 'play');
            btn.setAttribute('aria-label', engine.playing ? '暂停' : '播放');
            btn.classList.toggle('playing', engine.playing);
        }
        const r = $('#runtime-status');
        const label=engine.error ? '播放出现问题：' + engine.error.message : engine.playing ? `音频时钟运行中${engine.skippedEvents ? ' · 音符过密，部分声音被限流' : ''}` : engine.pausedAt ? '已暂停 · 再次播放从这里继续' : '就绪 · 空格播放';
        if(r && r.textContent!==label) r.textContent=label;
    }
    function updatePlayhead() {
        const ph = $('#playhead');
        if (!ph)
            return;
        if (!engine.playing && !engine.pausedAt) {
            ph.setAttribute('visibility', 'hidden');
            return;
        }
        let pos = engine.position();
        if (B.audition) {
            ph.setAttribute('visibility', 'hidden');
            return;
        }
        if (B.target === 'bar')
            pos += S.page * BAR;
        if (B.target === 'song' || B.target === 'tracks') {
            const clip = track().clips.find(c => c.patternId === S.patternId && pos >= c.bar * BAR && pos < (c.bar + pattern().bars) * BAR);
            if (!clip) {
                ph.setAttribute('visibility', 'hidden');
                return;
            }
            pos -= clip.bar * BAR;
        }
        const visible = pos >= S.page * BAR && pos < (S.page + 1) * BAR;
        ph.setAttribute('visibility', visible ? 'visible' : 'hidden');
        ph.setAttribute('transform', `translate(${geo.left + (pos - S.page * BAR) / STEP * geo.cw} 0)`);
    }
    const audioMeterBuffer = new Float32Array(1024);
    let animationLast = 0;
    function animation(time) {
        requestAnimationFrame(animation);
        // Keep audio scheduling independent; only throttle visual work while idle or hidden.
        if (document.hidden || time - animationLast < (engine.playing ? 34 : 250)) return;
        animationLast = time;
        const pos = engine.position(), bar = Math.floor(pos / BAR) + 1, beat = Math.floor(pos % BAR / PPQ) + 1, step = Math.floor(pos % PPQ / STEP) + 1, clock = $('#position');
        const clockText=String(bar).padStart(3, '0') + `<span> : ${String(beat).padStart(2, '0')} : ${String(step).padStart(2, '0')}</span>`;
        if(clock && clock.innerHTML!==clockText) clock.innerHTML=clockText;
        updatePlayhead();
        const mc = $('#master-meter');
        if (mc) {
            const c = mc.getContext('2d');
            c.clearRect(0, 0, mc.width, mc.height);
            let peak = 0;
            if (engine.graph?.analyser) {
                engine.graph.analyser.getFloatTimeDomainData(audioMeterBuffer);
                for (const v of audioMeterBuffer)
                    peak = Math.max(peak, Math.abs(v));
            }
            for (let i = 0; i < 14; i++) {
                const css=getComputedStyle(document.documentElement);c.fillStyle = peak > i / 14 ? css.getPropertyValue(i>11?'--warning':'--green') : css.getPropertyValue('--grid-major');
                c.fillRect(i * 5.5, 8, 3.5, 15);
            }
        }
        if (S.view === 'arrange') {
            let line = $('#arrange-playhead');
            if (!line && $('.arrange-inner')) {
                $('.arrange-inner').insertAdjacentHTML('beforeend', '<div id="arrange-playhead"></div>');
                line = $('#arrange-playhead');
            }
            if (line) {
                line.style.left = `calc(${pos / BAR / project.bars * 100}% + ${G.UI_METRICS.trackHead * (1 - pos / BAR / project.bars)}px)`;
                line.style.display = engine.playing && !B.audition && ['song', 'tracks'].includes(B.target) ? 'block' : 'none';
            }
        }
        if (S.view === 'mix')
            for (const [id, bus] of engine.graph?.buses || []) {
                const el = $(`[data-meter="${id}"]`);
                if (el && bus.meter) {
                    bus.meter.getFloatTimeDomainData(audioMeterBuffer);
                    let peak = 0;
                    for (const x of audioMeterBuffer)
                        peak = Math.max(peak, Math.abs(x));
                    el.style.height = clamp((20 * Math.log10(peak || .00001) + 48) / 48 * 100, 0, 100) + '%';
                }
            }
        if (!engine.playing)
            $$('[data-meter]').forEach(el => el.style.height = '0%');
        updateTransport();
    }
    let resizeTimer = null, lastCompact=window.matchMedia("(max-width:600px)").matches;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const compact=window.matchMedia('(max-width:600px)').matches;
            if(compact!==lastCompact){lastCompact=compact;render();}
            else if (!interactions.getDrag() && S.view === 'edit') drawGrid();
        }, 100);
    });
    window.addEventListener('beforeunload', e => {
        if (S.saveStatus === '正在保存…' || S.saveStatus.includes('失败')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    /** Small public API for automated testing and future integrations. */
    globalThis.GridToneApp = { version: '1.3.0', getProject: () => snapshot(), loadProject, getState: () => clone({ ...S, clipboard: !!S.clipboard, scope: B.target, loop: B.loop }), getPlayback: () => clone(B), getHistory: () => ({ undo: history.length, redo: future.length }), materials, composer, openPattern, changeView, engine, playback, render };
    render();
    requestAnimationFrame(animation);
    (async () => {
        try {
            const packs = await G.loadCatalogPacks();
            for (const pack of packs || []) {
                try {
                    G.installCatalog(pack);
                }
                catch (e) {
                    toast('部分素材没有载入：' + e.message);
                }
            }
            const saved = await loadLocal();
            if (saved && !interacted) {
                project = G.pinDocument(validateProject(saved));
                S.trackId = project.tracks[0].id;
                S.patternId = project.tracks[0].patterns[0].id;
                G.restoreWorkspace(S, project);
                G.reconcileSession(S, project, B);
            }
            S.saveStatus = saved ? '已保存在本机' : '示例已载入 · 修改后自动保存';
        }
        catch (e) {
            S.saveStatus = '本机存储不可用 · 请下载工程';
        }
        render();
    })();
})(globalThis.GridTone ||= {});
