(function (G) {
    'use strict';
    const { BAR, STEP, PPQ, KEYS, SCALES, DRUMS, PRESETS, clamp, uid, clone, noteName, inScale, newNote, newPattern, newTrack, blankProject, demoProject, validateProject, transformNotes, chordNotes, processPattern, canPlace, firstFreeBar, copyPattern, presetById, AudioEngine, encodeMidi, downloadBlob, safeFilename, saveLocal, loadLocal } = G;
    const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
    const { esc, icon, button, ib, miniPattern, slider } = G.ui;
    const engine = new AudioEngine();
    let project = G.applyTemplate(blankProject(), G.getTemplate('prism.song.glass')).project;
    function refreshPalette(p){const old=['#9a79dd','#e99b6c','#a28cce','#86909e','#cb819a','#8da289','#b79a83','#799fba'];p.tracks.forEach(t=>{if(old.includes(t.color.toLowerCase()))t.color=t.kind==='drum'?'#f66570':/bass/.test(t.preset)?'#34b995':/和弦/.test(t.name)?'#ee9552':'#2875f5';});return p;}
    let pendingPitch = null;
    const S = G.createEditorSession(project), B = G.createPlaybackContext();
    S.continuous=innerWidth>700;S.editorHeight=Math.max(400,Math.min(580,innerHeight-340));
    project.tracks.forEach(t=>t.color=t.kind==='drum'?'#f66570':/bass/.test(t.preset)?'#34b995':/和弦/.test(t.name)?'#ee9552':'#2875f5');
    const lead=project.tracks.find(t=>/旋律/.test(t.name))||project.tracks[0];G.openPatternInSession(S,project,{trackId:lead.id});G.fitViewport(S,lead,lead.patterns[0]);
    const playback = new G.PlaybackController(engine, () => project, () => S, B, () => { updateTransport(); const l = $('#playback-label'); if (l)
        l.textContent = G.playbackLabel(project, S, B); }, message => toast(message));
    function snapshot() { const copy = clone({ ...project, assets: {} }); copy.assets = Object.fromEntries(Object.entries(project.assets).map(([id, a]) => [id, { ...a }])); return copy; }
    function fingerprint(p) { return JSON.stringify(p); }
    const history = [], future = [];
    let rangeMixOnly=true;
    let pendingSave = Promise.resolve(), pendingSnapshot = null;
    let saveTimer = null, toastTimer = null, interacted = false, rangeBefore = null, recording = null, renderCounter = 0, persistSerial = 0;
    const track = () => project.tracks.find(t => t.id === S.trackId) || project.tracks[0];
    const pattern = () => track().patterns.find(p => p.id === S.patternId) || track().patterns[0];
    function syncSelection() { return G.reconcileSession(S, project, B); }
    function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
    function markChanged(before, mixOnly=false) {
        for(const t of project.tracks)for(const p of t.patterns)if(p.retention)p.retention.notes=p.retention.notes.filter(n=>p.notes.some(x=>x.id===n.id));
        try { validateProject(project); }
        catch (e) { project = before; syncSelection(); toast(e.message); return; }
        if (fingerprint(before) === fingerprint(project))
            return;
        history.push(before);
        if (history.length > 60)
            history.shift();
        future.length = 0;
        persist();
        mixOnly ? playback.updateMix() : playback.updateProject();
    }
    function mutate(fn, { draw = true } = {}) {
        const before = snapshot();
        const selection = {trackId:S.trackId,patternId:S.patternId,clipId:S.clipId,selected:[...S.selected],clipIds:[...S.clipIds]};
        try {
            const result=G.executeCommand(before,draft=>{
                project=draft;
                fn();
                for(const t of project.tracks)for(const p of t.patterns)if(p.retention)p.retention.notes=p.retention.notes.filter(n=>p.notes.some(x=>x.id===n.id));
                return project;
            },selection);
            if(!result.ok)throw Object.assign(Error(result.error.message),{code:result.error.code});
            project=result.document;
            markChanged(before);
            syncSelection();
            if (draw)
                render();
        }
        catch (e) {
            project = before;
            Object.assign(S,selection);
            syncSelection();
            render();
            toast(e.message);
        }
    }
    function persist() {
        S.saveStatus = '正在保存…';
        updateStatus();
        clearTimeout(saveTimer);
        const serial = ++persistSerial, copy = snapshot();
        pendingSnapshot = copy;
        saveTimer = setTimeout(() => runSave(copy, serial), 350);
    }
    async function runSave(copy, serial) {
        if (pendingSnapshot === copy) pendingSnapshot = null;
        pendingSave = saveLocal(copy);
        try {
                await pendingSave;
                if (copy.id === project.id) await G.projects.activate(copy.id);
                if (serial === persistSerial && copy.id === project.id) {
                    S.saveStatus = '已保存在本机';
                    S.saveError = '';
                }
            }
            catch (e) {
                if(serial===persistSerial && copy.id===project.id){S.saveStatus = e.code==='SAVE_CONFLICT'?'保存冲突 · 请另存副本':'本机保存失败 · 请重试或下载';S.saveError=e.message;}
            }
            updateStatus();
    }
    async function flushSave() {
        clearTimeout(saveTimer);
        if (pendingSnapshot) {const copy=pendingSnapshot;pendingSnapshot=null;await runSave(copy,persistSerial);}
        await pendingSave;
        if(/失败|冲突/.test(S.saveStatus))throw Error(S.saveError||S.saveStatus);
    }
    function updateStatus() {
        const el = $('.save-status');
        if (el)
            el.innerHTML = `<i class="status-dot ${/失败|不可用/.test(S.saveStatus) ? 'warning' : ''}"></i>${esc(S.saveStatus)}`;
        const footer=$('#storage-status');if(footer){footer.textContent=S.saveStatus;footer.classList.toggle('storage-warning',/失败|不可用/.test(S.saveStatus));}
    }
    async function showProjects() {
        try {
            const rows=await G.projects.list();
            openModal('我的作品', `<p class="modal-copy">${esc(S.saveStatus)}${S.saveError?' · '+esc(S.saveError):''}</p><div class="menu-grid">${button('new-project','新建作品','plus','dark-btn')}${button('open-project','导入工程','folder')}${button('project-copy','另存为新作品','copy')}${button('retry-save','重试保存','save')}${button('discard-reload','放弃本页修改并载入存档','undo','quiet')}${button('export-project','下载当前工程','download')}${button('recoveries','当前作品恢复点','undo')}</div><div class="project-list">${rows.map(r=>`<article><strong>${esc(r.title)}</strong><p>${r.tracks} 轨 · ${r.bars} 小节 · ${new Date(r.updatedAt).toLocaleString()}</p><div class="modal-actions">${button('project-open',r.id===project.id?'重新打开已存版本':'打开','folder','soft-btn',`data-id="${r.id}"`)}${button('project-download','下载','download','quiet',`data-id="${r.id}"`)}${button('project-delete','删除','trash','danger-btn',`data-id="${r.id}" ${r.id===project.id?'disabled title="先切换到另一作品，再删除这一份"':''}`)}</div></article>`).join('')||'<p>编辑后会自动保存第一份作品。</p>'}</div>`);
        } catch(e){toast(e.message);}
    }
    function undo() {
        if (!history.length)
            return;
        interactions?.cancel();
        future.push(snapshot());
        project = history.pop();
        playback.updateProject();
        syncSelection();
        persist();
        render();
    }
    function redo() {
        if (!future.length)
            return;
        interactions?.cancel();
        history.push(snapshot());
        project = future.pop();
        playback.updateProject();
        syncSelection();
        persist();
        render();
    }
    function openPattern(options) {
        S.editorOpen=true;
        const previousTrack=S.trackId;
        const previousTab=S.editorTab;
        G.openPatternInSession(S, project, options);
        if(options.preserveEditorTab && S.view==='edit') S.editorTab=previousTab;
        if(S.trackId!==previousTrack){S.tab='全部';S.query='';if(track().kind==='drum'&&S.soundSource==='recorded')S.soundSource='curated';}
        playback.editorChanged();
        render();
    }
    function changeView(view) {
        if(S.modal)closeModal();
        if(view==='edit')S.editorOpen=true;
        if (view === 'sound') {
            S.view = 'edit';
            S.editorTab = 'sound';
            render();
            return;
        }
        // View changes preserve the active listening scope and audio clock.
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
            const wholeSong = result.project.id !== project.id;
            if (wholeSong) { return loadProject(result.project).catch(e => toast(e.message)); }
            if(wholeSong)playback.stop();else playback.endAudition();
            mutate(() => {
                project = refreshPalette(result.project);
                if (wholeSong) {
                    Object.assign(S, G.createEditorSession(project));
                    Object.assign(B, G.createPlaybackContext());
                }
                G.openPatternInSession(S, project, { trackId: result.trackId, patternId: result.patternId, clipId: result.clipId, edit: !wholeSong });
            });
        }
    };
    const materials = new G.CatalogUI(catalogContext), composer = new G.ComposerUI(catalogContext), creation = new G.CreationUI(catalogContext);
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
        const t = track(), p = pattern(), scrollKey = S.view + ':' + S.trackId + ':' + S.patternId + ':' + S.editorTab;
        G.patchDOM($('#app'), G.views.renderShell({ ...viewContext(), engine, history, future, renderEditor, renderArrange, renderMix, scrollKey }));
        $$('input[type=range]').forEach(el=>el.style.setProperty('--range-progress',((+el.value-(+el.min||0))/(+el.max-(+el.min||0))*100)+'%'));
        updateStatus();
        if (S.view !== 'mix' && S.editorOpen && S.editorTab === 'notes')
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
        G.motion?.afterRender(S);
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
    function exportDialog() { openModal('导出作品', `<label class="field-row export-scope">导出范围<select id="export-scope"><option value="song">整首作品 · ${project.bars} 小节</option><option value="pattern">当前片段 · ${pattern().bars} 小节</option><option value="current">当前试听范围（含临时只听）</option></select></label><div class="export-options">${button('export-wav', 'WAV 音频', 'wave', 'export-option')}${button('export-midi', 'MIDI 乐谱', 'piano', 'export-option')}${button('export-project', '乐构工程', 'file', 'export-option')}</div><div class="export-descriptions"><p>默认导出作品混音，保留作品静音设置，忽略临时只听。工程文件始终包含全曲。</p><p><b>WAV</b>：44.1 kHz / 16-bit 立体声，包含音色与效果，附 3 秒尾音。单次最多 3 分钟。</p><p><b>MIDI</b>：导出音符、速度、移调、琶音和律动，供其他编曲软件继续编辑；具体音色与音频效果不会随 MIDI 保留。</p><p><b>乐构工程</b>：保存整首作品的所有音符、设置和自定义音源，可重新打开接着写。</p></div><p id="export-progress" class="export-progress" role="status"></p>`); }
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
    let switchQueue = Promise.resolve();
    function loadProject(raw, options = {}) {
        const captured = clone(raw);
        const next = switchQueue.catch(()=>{}).then(()=>loadProjectNow(captured,options));
        switchQueue = next;
        return next;
    }
    async function loadProjectNow(raw, { fromLibrary = false, asCopy = false } = {}) {
        let checked = refreshPalette(G.pinDocument(validateProject(raw)));
        await flushSave();
        if (!fromLibrary && (asCopy || await G.projects.read('documents',checked.id))) checked = G.copyProject(checked);
        // Verify the destination is durable before replacing the active session.
        await G.projects.save(checked);
        await G.projects.activate(checked.id);
        playback.stop();
        history.length=0;
        future.length = 0;
        project = checked;
        Object.assign(S, G.createEditorSession(project));
        Object.assign(B, G.createPlaybackContext());
        G.restoreWorkspace(S, project);
        syncSelection();
        S.saveStatus = '已保存在本机';
        S.saveError = '';
        closeModal();
        render();
    }
    async function importProject(file) {
        try {
            if (file.size > 40 * 1024 * 1024)
                throw Error('工程文件超过 40 MB。');
            await loadProject(JSON.parse(await file.text()));
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
    function noteMenu() { openModal('音符操作', `<p class="modal-copy">已选择 ${S.selected.length} 个音符。拖动音符可以移动，拖右边缘可以改长度。</p><div class="menu-grid">${G.ui.MenuItem({action:'menu-copy', label:'复制', icon:'copy'})}${button('menu-split', '从中间拆开', 'split', 'soft-btn')}${button('split-at-cursor', '在编辑光标拆开', 'split', 'soft-btn')}${button('menu-delete', '删除', 'trash', 'soft-btn')}${button('select-all', '全选', '', 'soft-btn')}</div>`); }
    function appearanceDialog() {
        const a=G.appearance.get();
        openModal('外观与动效', `<div class="appearance-grid">${[['crystal','清白','清爽白色 · 彩色键帽'],['pearl','暖白','柔和暖白 · 彩色键帽']].map(([id,name,desc])=>`<button class="skin-card ${a.skin===id?'active':''}" data-action="choose-skin" data-skin="${id}" aria-pressed="${a.skin===id}"><span class="skin-swatch ${id}" aria-hidden="true"></span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><label class="field-row"><span>减少透明度</span><input type="checkbox" data-field="reduce-transparency" ${a.transparency==='reduced'?'checked':''}></label><label class="field-row"><span>减少动态效果</span><input type="checkbox" data-field="reduce-motion" ${a.motion==='reduced'?'checked':''}></label><p class="appearance-note">音符与乐句保留轻微厚度，网格保持稳定。减少动态时保留选中、吸附和播放位置提示；系统的减少动态设置也会自动生效。</p>`, '轻触、拿起、落定。');
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
    function zoomCanvas(delta,clientX,clientY,vertical=false){
        const sc=$('.grid-scroll');if(!sc)return;const rect=sc.getBoundingClientRect(),anchor=clientX??(rect.left+rect.width/2),anchorY=clientY??rect.top+rect.height/2,v=G.viewportFor(S,track());
        const oldWidth=geo.width,oldHeight=geo.height,x=sc.scrollLeft+anchor-rect.left,y=sc.scrollTop+anchorY-rect.top;
        if(vertical)v.rowHeight=clamp(v.rowHeight+delta*2,10,42);else v.zoomX=clamp(v.zoomX+delta*.25,.5,6);
        drawGrid();sc.scrollLeft=x*geo.width/oldWidth-(anchor-rect.left);sc.scrollTop=y*geo.height/oldHeight-(anchorY-rect.top);G.saveWorkspace(S,project.id);
    }
    function clipCommand(action){
        const ids=S.clipIds.length?S.clipIds:S.clipId?[S.clipId]:[],items=G.clipSelection(project,ids);
        if(action==='copy'||action==='duplicate'){
            if(!items.length)return;S.clipClipboard=clone(items.map(x=>({trackId:x.track.id,kind:x.track.kind,bar:x.clip.bar,pattern:x.pattern})));
            if(action==='copy'){toast('已复制 '+items.length+' 个片段，粘贴在播放起点。');return;}
        }
        if(action==='delete'){mutate(()=>{project.tracks.forEach(t=>t.clips=t.clips.filter(c=>!ids.includes(c.id)));S.clipIds=[];S.clipId=null;});return;}
        if(action==='ArrowLeft'||action==='ArrowRight'){mutate(()=>{const result=G.moveClips(project,ids,action==='ArrowLeft'?-1:1);project=result.project;S.clipIds=result.ids;});return;}
        if(action==='paste'||action==='duplicate'){
            if(!S.clipClipboard?.length)return;
            mutate(()=>{
                const list=S.clipClipboard,min=Math.min(...list.map(x=>x.bar)),span=Math.max(...list.map(x=>x.bar+x.pattern.bars))-min;
                const at=action==='duplicate'?Math.max(...items.map(x=>x.clip.bar+x.pattern.bars)):Math.floor((B.startTick||0)/BAR);
                if(at+span>256)throw Error('超过 256 小节上限。');project.bars=Math.max(project.bars,at+span);
                const newIds=[];
                for(const x of list){const t=list.length===1?track():project.tracks.find(t=>t.id===x.trackId)||track();if(t.kind!==x.kind)throw Error('请粘贴到同类型音轨。');const pat=copyPattern(x.pattern),bar=at+x.bar-min;if(!canPlace(t,pat,bar,project.bars))throw Error('粘贴位置已有片段，请先点时间尺选择空白位置。');t.patterns.push(pat);const c={id:uid('c'),bar,patternId:pat.id};t.clips.push(c);newIds.push(c.id);}
                S.clipIds=newIds;S.clipId=newIds[0];const first=G.clipSelection(project,newIds)[0];S.trackId=first.track.id;S.patternId=first.pattern.id;
            });
        }
    }
    let noteOriginal=null,noteIds=[];
    function noteInspector(){
        noteOriginal=snapshot();noteIds=[...S.selected];const ns=selectedNotes();
        openModal('精细编辑',`<p>${ns.length?'修改所选 '+ns.length+' 个音符':'修改当前片段全部音符'} · 可先比较，再应用</p><div class="precise-fields"><label>微时移（ticks，960 = 一拍）<input id="note-time" type="number" value="0" step="1"></label><label>移调（半音）<input id="note-pitch" type="number" value="0" min="-24" max="24"></label><label>力度（1–100%，留空保持）<input id="note-velocity" type="number" min="1" max="100" placeholder="保持原力度"></label><label>时长倍率<input id="note-length" type="number" min="0.1" max="8" step="0.1" value="1"></label></div><div class="modal-actions">${button('note-preview-original','试听修改前','headphones','soft-btn')}${button('note-preview-candidate','试听修改后','headphones','soft-btn')}${button('note-apply','应用修改','check','dark-btn')}</div>`);
    }
    function noteCandidate(){
        const next=clone(noteOriginal),t=next.tracks.find(t=>t.id===S.trackId),p=t.patterns.find(p=>p.id===S.patternId),dt=Number($('#note-time').value),dp=Number($('#note-pitch').value),factor=Number($('#note-length').value),vel=$('#note-velocity').value;
        if(!Number.isFinite(dt)||!Number.isInteger(dp)||Math.abs(dp)>24||!Number.isFinite(factor)||factor<=0||factor>8||vel!==''&&(!Number.isFinite(+vel)||+vel<1||+vel>100))throw Error('请填写有效的时间、音高、时长和力度。');
        for(const n of p.notes){if(noteIds.length&&!noteIds.includes(n.id))continue;n.start=Math.round(n.start+dt);n.duration=Math.max(1,Math.round(n.duration*factor));if(t.kind!=='drum')n.pitch+=dp;if(vel!=='')n.velocity=Number(vel)/100;if(n.start<0||n.start+n.duration>p.bars*BAR||n.pitch<0||n.pitch>127)throw Error('结果超出片段或音高边界，请缩小修改幅度。');}
        return next;
    }
    function editorMore(){const t=track(),p=pattern();
        openModal('编辑工具',`<h3>画布</h3><div class="studio-tools-menu"><label><input data-field="continuous" type="checkbox" ${S.continuous?'checked':''}>连续显示全部小节</label>${button('fit-notes','适配音符','grid')}${button('zoom-out','缩小','minus')}${button('zoom-in','放大','plus')}${button('note-inspector','精细编辑','pencil')}</div><h3>片段</h3><div class="studio-tools-menu">${t.patterns.map(x=>button('pattern',esc(x.name),'','soft-btn',`data-id="${x.id}"`)).join('')}${button('add-pattern','新片段','plus')}${button('duplicate-pattern','创建独立副本','copy')}</div><label>片段长度 <select data-field="pattern-length">${G.PATTERN_BARS.map(n=>`<option value="${n}" ${p.bars===n?'selected':''}>${n} 小节</option>`).join('')}</select></label><h3>创作辅助</h3><div class="studio-tools-menu">${button('composer','和弦进行','chord','soft-btn')}${button('catalog','素材模板','folder','soft-btn')}${button('groove','Swing / 律动','wave')}${button('transpose-dialog','移调 / 调式适配','piano')}${button('scale-lock','简化音阶显示','grid')}${button('octave-down','浏览低八度','minus')}${button('octave-up','浏览高八度','plus')}</div><div class="studio-tools-menu"><label>参考主音 <select data-field="key">${KEYS.map((k,i)=>`<option value="${i}" ${project.key===i?'selected':''}>${k}</option>`).join('')}</select></label><label>参考音阶 <select data-field="scale">${Object.keys(SCALES).map(k=>`<option value="${k}" ${project.scale===k?'selected':''}>${({major:'大调',minor:'小调',pentatonic:'五声音阶',chromatic:'半音阶'})[k]}</option>`).join('')}</select></label><label><input data-field="input-snap" type="checkbox" ${S.inputSnap?'checked':''}>新音符吸附调内</label></div><h3>音符操作</h3><div class="studio-tools-menu">${[['up','升八度'],['down','降八度'],['mirror','半音镜像'],['mirror-scale','调内镜像'],['reverse','时间反转'],['humanize','力度变化']].map(([v,l])=>button('transform',l,'','quiet',`data-transform="${v}"`)).join('')}${button('shorten-notes','时长减半')}${button('lengthen-notes','时长加倍')}${button('split-notes','从中间拆开')}${button('split-at-cursor','在编辑光标拆开')}${button('clear-pattern','清空片段','trash')}</div><h3>试听范围</h3><div class="studio-tools-menu">${button('listen-pattern','当前片段')}${button('listen-bar','当前小节')}${button('clear-solo','全曲')}</div><p>参考调性不改变已有音符。共享片段的修改会同步到全部引用。</p>`);
    }
    async function showRecoveries(){try{const rows=await G.listRecoveries(project.id);openModal('恢复版本',`<p>保留最近 10 个自动恢复点，间隔至少 30 秒。恢复可以撤销。</p><div class="recovery-list">${rows.length?rows.map(r=>button('restore-recovery',esc(r.title)+' · '+new Date(r.time).toLocaleString(),'undo','soft-btn',`data-id="${r.id}"`)).join(''):'修改作品后会生成恢复点。'}</div>`);}catch(e){toast(e.message);}}

    function handleAction(action, el) {
        if(S.modal&&['fit-notes','zoom-out','zoom-in','pattern','duplicate-pattern','duplicate-clip','unlink-clip','transform','shorten-notes','lengthen-notes','split-notes','split-at-cursor','octave-up','octave-down','scale-lock','listen-pattern','listen-bar','clear-solo'].includes(action))closeModal();
        if(action==='workspace-menu'){openModal('乐构 · 工作台',`<div class="studio-tools-menu">${button('project-menu','工程','folder')}${button('catalog','模板与素材','grid')}${button('view','混音台','mix','','data-view="mix"')}${button('appearance','外观与动效','spark')}${button('help','操作帮助','help')}</div>`);return;}
        if(action==='preview-track'){const t=project.tracks.find(t=>t.id===el.dataset.id);if(t){openPattern({trackId:t.id});playback.start('pattern').then(render);}return;}
        if(action==='close-editor'){S.editorOpen=false;render();return;}
        if(action==='expand-editor'){S.editorExpanded=!S.editorExpanded;render();return;}
        if(action==='clear-range'){playback.setRange(null);render();return;}
        if(action==='track-options'){S.trackId=el.dataset.id;handleAction('rename-track',el);return;}
        if(action==='clip-menu'){openModal('片段操作',`<div class="studio-tools-menu">${button('clips-copy','复制','copy')}${button('clips-paste','粘贴')}${button('clips-duplicate','独立复制')}${button('duplicate-clip','重复引用','link')}${button('unlink-clip','转为独立片段','split')}${button('clips-delete','删除','trash')}</div><p>普通复制相互独立；重复引用共享音符。跨轨移动会使用目标轨音色。</p>`);return;}
        if(action.startsWith('clips-')){closeModal();clipCommand(action.slice(6));return;}
        if(action==='note-inspector'){noteInspector();return;}
        if(action==='note-preview-original'||action==='note-preview-candidate'){try{playback.audition(action==='note-preview-original'?noteOriginal:noteCandidate(),{kind:'pattern',trackId:S.trackId,patternId:S.patternId,ignoreMute:true},action==='note-preview-original'?'修改前':'修改后');}catch(e){toast(e.message);}return;}
        if(action==='note-apply'){try{const candidate=noteCandidate();closeModal();mutate(()=>project=candidate);}catch(e){toast(e.message);}return;}
        if(action==='editor-more'){editorMore();return;}
        if(action==='retry-save'){persist();flushSave().then(showProjects).catch(e=>toast(e.message));return;}
        if(action==='discard-reload'){confirmAction('放弃本页尚未保存的修改？','将打开这份作品最后成功保存的版本。',async()=>{try{clearTimeout(saveTimer);pendingSnapshot=null;await pendingSave.catch(()=>{});const saved=await G.projects.load(project.id);if(!saved)throw Error('尚无存档，请先下载当前工程。');pendingSave=Promise.resolve();S.saveStatus='已保存在本机';await loadProject(saved,{fromLibrary:true});}catch(e){toast(e.message);}});return;}
        if(action==='project-copy'){const copy=G.copyProject(project);clearTimeout(saveTimer);pendingSnapshot=null;G.projects.save(copy).then(()=>{pendingSave=Promise.resolve();S.saveStatus='已保存在本机';return loadProject(copy,{fromLibrary:true});}).catch(e=>toast(e.message));return;}
        if(action==='project-open'){confirmAction('打开已保存的作品？','当前修改会先保存。保存冲突时，可以先另存为新作品。',()=>flushSave().then(()=>G.projects.load(el.dataset.id)).then(p=>{if(!p)throw Error('作品已不存在。');return loadProject(p,{fromLibrary:true});}).catch(e=>toast(e.message)));return;}
        if(action==='project-download'){G.projects.load(el.dataset.id).then(p=>downloadBlob(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),safeFilename(p.title)+'.gridtone')).catch(e=>toast(e.message));return;}
        if(action==='project-delete'){confirmAction('删除这份本机作品？','只删除选定作品及其恢复点。建议先下载工程备份。',()=>G.projects.delete(el.dataset.id).then(showProjects).catch(e=>toast(e.message)));return;}
        if(action==='recoveries'){showRecoveries();return;}
        if(action==='restore-recovery'){G.loadRecovery(el.dataset.id,project.id).then(p=>{if(p){closeModal();mutate(()=>project=G.pinDocument(validateProject(p)));}}).catch(e=>toast(e.message));return;}

        if(action==='sound-source'){playback.endAudition();S.soundSource=el.dataset.source;S.tab='全部';S.query='';render();return;}
        if(action==='sound-audition'){try{soundAudition(el.dataset.id);}catch(e){toast(e.message);}return;}
        if(action==='load-sample-bank'){loadSampleBank(el.dataset.id);return;}
        if(action==='audition-key'){preview(track(),+el.dataset.pitch,.5);return;}
        if(action==='key-octave'){S.keyOctave=G.clamp((S.keyOctave??4)+Number(el.dataset.delta),1,6);render();return;}

        if(action==='appearance'){appearanceDialog();return;}
        if(action==='choose-skin'){G.appearance.set({skin:el.dataset.skin});appearanceDialog();return;}
        if (creation.handleAction(action, el) || composer.handleAction(action, el) || materials.handleAction(action, el))
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
            S.editorTab = el.dataset.tab;S.editorExpanded=S.editorTab!=='notes';
            render();
        }
        else if (action === 'editor-group') {
            S.editorGroup = S.editorGroup === el.dataset.group ? null : el.dataset.group;
            render();
        }
        else if (action === 'fit-notes') {
            const v=G.fitViewport(S, track(), pattern());v.rowHeight=clamp(Math.floor((($('.grid-scroll')?.clientHeight||360)-110)/v.span),14,32);v.zoomX=1;
            render();const sc=$('.grid-scroll');if(sc)sc.scrollTop=0;
        }
        else if (action === 'zoom-in' || action === 'zoom-out') {
            zoomCanvas(action==='zoom-in'?1:-1);
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
            {const before=snapshot(),t=project.tracks.find(t=>t.id===id);if(t)t.mute=!t.mute;markChanged(before,true);render();}
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
            openModal('音轨设置', `<label class="form-label">名称<input id="form-value" value="${esc(track().name)}" maxlength="60"></label><label class="form-label">声部角色<select data-field="track-role">${[['unspecified','未指定'],['melody','旋律'],['bass','贝斯'],['chords','和弦'],['drums','鼓点'],['texture','伴奏 / 氛围']].map(([v,l])=>`<option value="${v}" ${(track().role||'unspecified')===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="modal-actions">${button('duplicate-track', '复制整条音轨', 'copy', 'soft-btn')}${button('remove-track', '删除这条音轨', 'trash', 'danger-btn')}${button('submit-form', '保存', 'check', 'dark-btn')}</div>`);
        }
        else if (action === 'duplicate-track') {
            const result = G.duplicateTrack(project, S.trackId);
            closeModal();
            mutate(() => { project = result.project; G.openPatternInSession(S, project, result); });
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
                const selected = selectedNotes();
                if (action === 'shorten-notes' && selected.some(n => n.duration === 1)) toast('部分音符已到最短 1 tick。');
                const changed = new Map(G.durationNotes(selected, action === 'shorten-notes' ? 'half' : 'double', pattern().bars * BAR).map(n => [n.id, n]));
                pattern().notes = pattern().notes.map(n => changed.get(n.id) || n);
            });
        else if (action === 'split-notes' || action === 'menu-split' || action === 'split-at-cursor') {
            mutate(() => {
                const p = pattern(), result = [];
                for (const n of p.notes) {
                    if (S.selected.includes(n.id)) {
                        result.push(...G.durationNotes([n], action === 'split-at-cursor' ? 'cursor' : 'split', p.bars * BAR, S.cursor));
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
            confirmAction('把处理结果写回音符？', '将本轨所有片段的琶音、移调与轻微错拍变为实际音符，然后复位这些处理器。全曲 Swing 保持不变。', () => mutate(() => { const t = track(); t.patterns.forEach(p => {p.notes = processPattern(p, t, { ...project, swing: 0 });G.bakeHarmony(p,Math.round(t.pipeline.transpose));}); t.pipeline = { transpose: 0, arp: 'off', rate: STEP, humanize: 0 }; }));
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
            showProjects();
        else if (action === 'new-project' || action === 'load-demo')
            confirmAction(action === 'new-project' ? '开始一张空白画板？' : '重新载入示例？', '当前作品会先保存，再打开新作品。可在“我的作品”中随时切回。', () => { loadProject(action === 'new-project' ? blankProject() : demoProject()).then(()=>{S.view='edit';render();}).catch(e=>toast(e.message)); });
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
            S.clipId = c.dataset.clip;S.trackId=c.dataset.track;S.editorExpanded=true;
            handleAction('edit-clip', c);
        }
    });
    function handleField(el) {
        if(el.dataset.field==='reduce-motion'){G.appearance.set({motion:el.checked?'reduced':'normal'});return;}
        if(el.dataset.field==='reduce-transparency'){G.appearance.set({transparency:el.checked?'reduced':'normal'});return;}
        if (creation.handleField(el) || composer.handleField(el) || materials.handleField(el))
            return;
        const f = el.dataset.field, v = el.value;
        if(f==='snap'){S.snap=Number(v);render();return;}
        if(f==='continuous'){S.continuous=el.checked;render();return;}
        if(f==='editor-page'){S.page=+v;render();return;}
        if(f==='loop-from'||f==='loop-to'){const a=(Number(document.querySelector('[data-field="loop-from"]').value)-1)*BAR,b=Number(document.querySelector('[data-field="loop-to"]').value)*BAR;if(a>=0&&b>a&&b<=project.bars*BAR)playback.setRange([a,b]);else toast('循环结束需要晚于开始。');render();return;}

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
        if(f==='track-role'){mutate(()=>track().role=v);return;}
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
    document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-field="bpm"],[data-field="loop-from"],[data-field="loop-to"]')){e.preventDefault();handleField(e.target);e.target.blur();}});
    document.addEventListener('change', e => {
        if (e.target.id?.startsWith('transpose-'))
            playback.endAudition();
        if (e.target.dataset.field || e.target.dataset.harmony)
            handleField(e.target);
        if (e.target.dataset.range) {
            if (rangeBefore) {
                markChanged(rangeBefore,rangeMixOnly);
                rangeBefore = null;
            }
            render();
        }
    });
    document.addEventListener('input', e => {
        const el = e.target;
        if(el.type==='range')el.style.setProperty('--range-progress',((+el.value-(+el.min||0))/(+el.max-(+el.min||0))*100)+'%');
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
        rangeMixOnly=group!=='pipeline'&&key!=='swing';
        rangeMixOnly?playback.updateMix():playback.updateProject();
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
        commitRange: () => { if (rangeBefore) { markChanged(rangeBefore,rangeMixOnly); rangeBefore=null; } },
        editorChanged:()=>playback.editorChanged(), seek: tick=>playback.seek(tick), setRange: range=>playback.setRange(range), seekPattern:tick=>{const c=track().clips.find(c=>c.id===S.clipId);playback.seek(tick+(['song','tracks'].includes(B.target)?(c?.bar||0)*BAR:0));}, clipCommand, zoom: zoomCanvas,
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
        let pos = playback.position();
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
        const offset=geo.offset||0;const visible = pos >= offset && pos < offset + (geo.bars||1)*BAR;
        ph.setAttribute('visibility', visible ? 'visible' : 'hidden');
        ph.setAttribute('transform', `translate(${geo.left + (pos - (geo.offset||0)) / STEP * geo.cw} 0)`);
    }
    const audioMeterBuffer = new Float32Array(1024);
    let animationLast = 0;
    function animation(time) {
        requestAnimationFrame(animation);
        if (!document.hidden) { updatePlayhead();G.motion?.playback({project,S,B,engine,position:playback.position()}); const line=$('#arrange-playhead'),lane=$('.arrange-lane');if(line&&lane){line.style.left=($('.ruler-label')?.offsetWidth||G.UI_METRICS.trackHead)+'px';line.style.transform='translateX('+(playback.position()/BAR/project.bars*lane.clientWidth)+'px)';line.style.display=!B.audition&&['song','tracks'].includes(B.target)?'block':'none';}}
        // Keep audio scheduling independent; only throttle visual work while idle or hidden.
        if (document.hidden || time - animationLast < (engine.playing ? 100 : 300)) return;
        animationLast = time;
        const pos = playback.position(), bar = Math.floor(pos / BAR) + 1, beat = Math.floor(pos % BAR / PPQ) + 1, step = Math.floor(pos % PPQ / STEP) + 1, clock = $('#position');
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
            else if (!interactions.getDrag() && S.view !== 'mix' && S.editorOpen) drawGrid();
        }, 100);
    });
    window.addEventListener('beforeunload', e => {
        if (S.saveStatus === '正在保存…' || S.saveStatus.includes('失败')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    /** Small public API for automated testing and future integrations. */
    globalThis.GridToneApp = { version: '1.6.0', getProject: () => snapshot(), loadProject, getState: () => clone({ ...S, clipboard: !!S.clipboard, scope: B.target, loop: B.loop }), getPlayback: () => clone(B), getHistory: () => ({ undo: history.length, redo: future.length }), materials, composer, creation, flushSave, openPattern, changeView, engine, playback, render };
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
                project = refreshPalette(G.pinDocument(validateProject(saved)));
                S.trackId = project.tracks[0].id;
                S.patternId = project.tracks[0].patterns[0].id;
                G.restoreWorkspace(S, project);
                G.reconcileSession(S, project, B);
            }
            if(!interacted)S.saveStatus = saved ? '已保存在本机' : '示例已载入 · 修改后自动保存';
        }
        catch (e) {
            S.saveStatus = '本机存储不可用 · 请下载工程';
        }
        render();
    })();
})(globalThis.GridTone ||= {});
