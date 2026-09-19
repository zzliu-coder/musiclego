(function (G) {
    'use strict';
    const { BAR, STEP, PPQ, KEYS, SCALES, DRUMS, PRESETS, clamp, uid, clone, noteName, inScale, newNote, newPattern, newTrack, blankProject, demoProject, validateProject, transformNotes, chordNotes, processPattern, canPlace, firstFreeBar, copyPattern, presetById, AudioEngine, encodeMidi, downloadBlob, safeFilename, saveLocal, loadLocal } = G;
    const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
    const { esc, icon, button, ib, miniPattern, slider } = G.ui;
    const engine = new AudioEngine();
    let project = G.recipeProject('studio.combo.warm');
    function refreshPalette(p){const old=['#9a79dd','#e99b6c','#a28cce','#86909e','#cb819a','#8da289','#b79a83','#799fba'];p.tracks.forEach(t=>{if(old.includes(t.color.toLowerCase()))t.color=t.kind==='drum'?'#f66570':/bass/.test(t.preset)?'#34b995':/和弦/.test(t.name)?'#ee9552':'#2875f5';});return p;}
    let pendingPitch = null;
    const S = G.createEditorSession(project), B = G.createPlaybackContext();
    S.continuous=true;S.editorHeight=Math.max(280,Math.min(430,innerHeight-430));
    project.tracks.forEach(t=>t.color=t.kind==='drum'?'#f66570':/bass/.test(t.preset)?'#34b995':/和弦/.test(t.name)?'#ee9552':'#2875f5');
    const lead=project.tracks.find(t=>/旋律/.test(t.name))||project.tracks[0];G.openPatternInSession(S,project,{trackId:lead.id,edit:false});G.fitViewport(S,lead,lead.patterns[0]);
    const playback = new G.PlaybackController(engine, () => project, () => S, B, () => { updateTransport(); const l = $('#playback-label'); if (l)
        l.textContent = G.playbackLabel(project, S, B); }, message => toast(message));
    function snapshot() { const copy = clone({ ...project, assets: {} }); copy.assets = Object.fromEntries(Object.entries(project.assets).map(([id, a]) => [id, { ...a }])); historySelections.set(copy,clone({trackId:S.trackId,patternId:S.patternId,clipId:S.clipId,clipIds:S.clipIds,selected:S.selected,editTarget:S.editTarget,noteRange:S.noteRange,cursor:S.cursor,arrangeCursor:S.arrangeCursor})); return copy; }
    function fingerprint(p) { return JSON.stringify(p); }
    const history = [], future = [], historySelections=new WeakMap();
    function restoreHistorySelection(document){const selection=historySelections.get(document);if(selection){const {_timePlayback,...saved}=clone(selection);Object.assign(S,saved);if(_timePlayback)Object.assign(B,_timePlayback);}}
    let rangeMixOnly=true;
    let pendingSave = Promise.resolve(), pendingSnapshot = null;
    let saveTimer = null, toastTimer = null, interacted = false, rangeBefore = null, recording = null, recordingRequest = null, renderCounter = 0, persistSerial = 0;
    const track = () => project.tracks.find(t => t.id === S.trackId) || project.tracks[0];
    const pattern = () => track().patterns.find(p => p.id === S.patternId) || track().patterns[0];
    const toolTrack = () => ['properties','sound','pipeline'].includes(S.rightPanel) ? project.tracks.find(t=>t.id===S.inspectorTrackId)||track() : track();
    function syncSelection() { return G.reconcileSession(S, project, B); }
    function toast(message) { $('#toast').textContent = G.ui.format.error(message); $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
    function markChanged(before, mixOnly=false) {
        for(const t of project.tracks)for(const p of t.patterns)if(p.retention)p.retention.notes=p.retention.notes.filter(n=>p.notes.some(x=>x.id===n.id));
        try { validateProject(project); }
        catch (e) { project = before; syncSelection(); toast(e.message); return {ok:false,error:{message:e.message}}; }
        if (fingerprint(before) === fingerprint(project))
            return {ok:true,changed:false};
        history.push(before);
        if (history.length > 60)
            history.shift();
        future.length = 0;
        persist();
        mixOnly ? playback.updateMix() : playback.updateProject();
        return {ok:true,changed:true};
    }
    function mutate(fn, { draw = true } = {}) {
        const before = snapshot();
        if(S.timeTransaction){historySelections.get(before)._timePlayback=clone({range:B.range,startTick:B.startTick,target:B.target});}
        const selection = {trackId:S.trackId,patternId:S.patternId,clipId:S.clipId,selected:[...S.selected],clipIds:[...S.clipIds],editTarget:clone(S.editTarget),cursor:S.cursor,arrangeCursor:clone(S.arrangeCursor),noteRange:clone(S.noteRange),editorOpen:S.editorOpen};
        try {
            const result=G.executeCommand(before,draft=>{
                project=draft;
                fn();
                for(const t of project.tracks)for(const p of t.patterns)if(p.retention)p.retention.notes=p.retention.notes.filter(n=>p.notes.some(x=>x.id===n.id));
                return project;
            },selection);
            if(!result.ok)throw Object.assign(Error(result.error.message),{code:result.error.code});
            project=result.document;
            const committed=markChanged(before);
            syncSelection();
            if (draw)
                render();
            return committed;
        }
        catch (e) {
            project = before;
            Object.assign(S,selection);
            syncSelection();
            render();
            toast(e.message);
            return {ok:false,error:{code:e.code||'INVALID_COMMAND',message:e.message}};
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
                if(serial===persistSerial && copy.id===project.id){S.saveStatus = e.code==='SAVE_CONFLICT'?'保存冲突 · 请另存副本':'本机保存失败 · 请重试或下载';S.saveError=G.ui.format.error(e);}
            }
            updateStatus();
    }
    async function flushSave() {
        clearTimeout(saveTimer);
        if (pendingSnapshot) {const copy=pendingSnapshot;pendingSnapshot=null;await runSave(copy,persistSerial);}
        await pendingSave;
        if(/失败|冲突/.test(S.saveStatus))throw Error(S.saveError||S.saveStatus);
    }
    function updateStatus(){
        const footer=$('#storage-status');if(!footer)return;const bad=/失败|不可用|冲突/.test(S.saveStatus);footer.textContent=S.saveStatus;footer.classList.toggle('storage-warning',bad);footer.setAttribute('aria-label',bad?S.saveStatus+'。请重试保存或下载作品文件。':S.saveStatus);
        const actions=$('#save-status-actions');if(actions){actions.hidden=!bad;actions.title=S.saveError||S.saveStatus;}
    }
    async function showProjects() {
        try {
            const rows=await G.projects.list();
            openModal('我的作品', `<p class="modal-copy">${esc(S.saveStatus)}${S.saveError?' · '+esc(S.saveError):''}</p><div class="menu-grid">${button('new-project','新建作品','plus','dark-btn')}${button('open-project','导入作品','folder')}${button('project-copy','另存为新作品','copy')}${button('retry-save','重试保存','save')}${button('discard-reload','放弃本页修改并载入存档','undo','quiet')}${button('export-project','下载当前作品','download')}${button('recoveries','当前作品恢复点','undo')}</div><div class="project-list">${rows.map(r=>`<article><strong>${esc(r.title)}</strong><p>${r.tracks} 轨 · ${r.bars} 小节 · ${new Date(r.updatedAt).toLocaleString()}</p><div class="modal-actions">${button('project-open',r.id===project.id?'重新打开已存版本':'打开','folder','soft-btn',`data-id="${r.id}"`)}${button('project-download','下载','download','quiet',`data-id="${r.id}"`)}${button('project-delete','删除','trash','danger-btn',`data-id="${r.id}" ${r.id===project.id?'disabled title="先切换到另一作品，再删除这一份"':''}`)}</div></article>`).join('')||'<p>编辑后会自动保存第一份作品。</p>'}</div>`);
        } catch(e){toast(e.message);}
    }
    function undo() {
        if (!history.length)
            return;
        interactions?.cancel();
        const current=snapshot();if(historySelections.get(history.at(-1))?._timePlayback)historySelections.get(current)._timePlayback=clone({range:B.range,startTick:B.startTick,target:B.target});
        future.push(current);
        project = history.pop();restoreHistorySelection(project);
        playback.updateProject();
        syncSelection();
        persist();
        render();
    }
    function redo() {
        if (!future.length)
            return;
        interactions?.cancel();
        const current=snapshot();if(historySelections.get(future.at(-1))?._timePlayback)historySelections.get(current)._timePlayback=clone({range:B.range,startTick:B.startTick,target:B.target});
        history.push(current);
        project = future.pop();restoreHistorySelection(project);
        playback.updateProject();
        syncSelection();
        persist();
        render();
    }
    function openPattern(options={}) {
        const previousTrack=S.trackId;
        const opened=G.openPatternInSession(S,project,{...options,edit:false});
        S.view='arrange';S.editorTab='notes';
        if(options.forceOpen!==false&&!S.editorManuallyClosed||options.edit===true){S.editorOpen=true;S.editorManuallyClosed=false;}
        if(options.activation==='notes')G.activateNotes(S,project);
        else if(options.activation!=='preserve')G.activateClips(S,project,S.clipId?[S.clipId]:[],S.trackId);
        if(S.trackId!==previousTrack){S.tab='全部';S.query='';}
        if(opened.changed)playback.editorChanged();render();
    }
    function changeView(view) {
        if(S.modal)closeModal();
        if(view==='sound'){openInspector('sound',S.trackId);return;}
        if(view==='edit'){S.view='arrange';S.editorOpen=true;S.editorManuallyClosed=false;G.activateNotes(S,project);render();return;}
        if(view==='mix'&&S.view!=='mix'){S.compositionTarget=clone(S.editTarget);S.compositionPanel=S.rightPanel;S.rightPanel=null;}
        else if(view!=='mix'&&S.view==='mix'){S.editTarget=S.compositionTarget||{kind:'none'};S.rightPanel=S.compositionPanel||null;}
        S.view=view==='mix'?'mix':'arrange';render();
    }
    function selectTrack(id){
        if(!project.tracks.some(t=>t.id===id))return;
        G.setEditTarget(S,project,{kind:'track',trackId:id});S.arrangeCursor={trackId:id,tick:S.arrangeCursor?.tick||0};
        openInspector('properties',id);
    }
    function selectPattern(id){openPattern({patternId:id,edit:true});}
    function editOpen(){
        const a=G.resolveEditTarget(project,S);
        if(a.kind==='clips'&&a.items.length===1){const x=a.items[0];openPattern({trackId:x.track.id,clipId:x.clip.id,edit:true,activation:'preserve'});return;}
        S.editorOpen=true;S.editorManuallyClosed=false;S.view='arrange';render();
    }
    function openInspector(type,trackId){
        playback.endAudition();S.rightPanel=type;S.inspectorTrackId=trackId||G.activeEditTrack(project,S).id;render();
    }
    function runEdit(id,confirm=true){
        const a=G.resolveEditTarget(project,S),state=G.editCommandState(project,S,id);
        if(!state.enabled){toast(state.reason);return {ok:false};}
        if(confirm&&(['delete','cut'].includes(id)&&a.kind==='track'||id==='clear')){
            const captured=clone(S.editTarget),identity=G.contentHash(captured),projectId=project.id;
            confirmAction(id==='clear'?'清空音乐块内容？':'删除整条音轨？',id==='clear'?`会清空「${esc(a.pattern.name)}」的全部音符，${a.track.clips.filter(c=>c.patternId===a.pattern.id).length} 处关联会一起改变。可一次撤销。`:`删除「${esc(a.track.name)}」及其 ${a.track.clips.length} 个音乐块。可一次撤销。`,()=>{if(project.id!==projectId||G.contentHash(S.editTarget)!==identity){toast('操作目标已变化，请重新选择。');return;}runEdit(id,false);});return {ok:true,pending:true};
        }
        try{
            const result=G.performEditCommand(project,S,id);
            if(result.changed){const out=mutate(()=>{project=result.document;Object.assign(S,result.patch);});if(!out.ok)return out;}
            else{Object.assign(S,result.patch);syncSelection();render();}
            if(['copy','cut'].includes(id)&&S.editClipboard){void G.publishMusicalClipboard(S.editClipboard).then(r=>{if(!r.system&&id==='cut')toast('已剪切，可在本工作台粘贴；系统剪贴板未授权。');});}
            if(result.message)toast(result.message);return {ok:true,changed:result.changed};
        }catch(e){toast(e.message);return {ok:false,error:{message:e.message}};}
    }
    async function saveCurrent(){
        const active=document.activeElement;if(G.keymap.textTarget(active))active.blur();
        persist();try{await flushSave();toast('当前作品已保存到本机。');}catch(e){toast('保存没有完成：'+e.message+'。请下载作品文件备份。');}
    }
    async function pasteSystem(){
        const targetMusic=()=>{const a=G.resolveEditTarget(project,S);return G.contentHash(a.kind==='notes'||a.kind==='range'?{pattern:a.pattern,kind:a.track.kind}:a.kind==='clips'?a.items.map(x=>({clip:x.clip,pattern:x.pattern})):a.kind==='track'?a.track:null);};
        const id=project.id,target=G.contentHash(S.editTarget),music=targetMusic(),cursor=S.cursor,position=G.contentHash(S.arrangeCursor);
        let incoming=null,readSucceeded=false;
        try{if(navigator.clipboard?.readText){const raw=await navigator.clipboard.readText();readSucceeded=true;incoming=G.parseMusicalClipboard(raw);}}catch(e){if(e instanceof SyntaxError||/格式|内容无效|过大|保留字段/.test(e.message)){toast('没有粘贴：'+e.message);return;}}
        if(project.id!==id||G.contentHash(S.editTarget)!==target||S.cursor!==cursor||G.contentHash(S.arrangeCursor)!==position||targetMusic()!==music){toast('粘贴位置或内容已变化，请在目标位置重新粘贴。');return;}
        if(readSucceeded&&!incoming){toast('剪贴板中没有乐构音乐内容。文字可粘贴到名称或备注中。');return;}
        const prior=S.editClipboard;if(incoming)S.editClipboard=incoming;
        const outcome=runEdit('paste');if(!outcome.ok&&incoming)S.editClipboard=prior;
    }
    function showTimeTools(){
        S.timeDialog={id:project.id,hash:G.contentHash(project)};
        const from=B.range?Math.floor(B.range[0]/BAR)+1:1,to=B.range?Math.ceil(B.range[1]/BAR):Math.min(4,project.bars);
        openModal('长度与时间编辑',`<p>作品共 ${project.bars} 小节。循环范围只控制试听，作品长度在这里修改。</p><section class="inspector-section"><h3>作品长度</h3><label class="form-label">保留小节数<input id="song-bars" type="number" min="1" max="256" value="${project.bars}"></label><div class="button-row">${button('time-apply','设置长度','check','soft-btn','data-mode="resize"')}${button('time-apply','去掉尾部空白','scissors','quiet','data-mode="trim"')}</div><p>缩短时保护全部已放置音乐块，包括空白音乐块。</p></section><section class="inspector-section"><h3>编辑全轨时间范围</h3><div class="form-grid"><label class="form-label">从第几小节<input id="time-from" type="number" min="1" max="${project.bars}" value="${from}"></label><label class="form-label">到第几小节（包含）<input id="time-to" type="number" min="1" max="${project.bars}" value="${to}"></label></div><p>清除内容保留时间；删除时间让后面的全部音轨前移。清除会在所选范围留下休止；删除会连接前后时间。范围外长音保持连续，跨删除两端的同一长音缩短后连续发声。整次可撤销。</p><div class="button-row">${button('time-apply','清除这段内容','eraser','soft-btn','data-mode="clear"')}${button('time-apply','删除这段时间','trash','danger-btn','data-mode="delete"')}</div></section><div class="modal-actions">${button('close-modal','关闭','','quiet')}</div>`);
    }
    function applyTimeTools(mode){
        try{if(S.timeDialog?.id!==project.id||S.timeDialog.hash!==G.contentHash(project))throw Error('作品已变化，请重新打开时间编辑。');
        const result=mode==='resize'?G.resizeSong(project,Number($('#song-bars').value)):mode==='trim'?G.trimSong(project):G.editSongTime(project,{kind:mode,startBar:Number($('#time-from').value)-1,endBar:Number($('#time-to').value)});
        const count=result.splitCount||0,base={id:project.id,hash:G.contentHash(project)};const apply=()=>{if(project.id!==base.id||G.contentHash(project)!==base.hash){toast('作品已经变化，请重新打开时间编辑。原稿保持。');closeModal();return;}playback.endAudition();const previousPlayback=clone({range:B.range,startTick:B.startTick,target:B.target});playback.stop();Object.assign(B,previousPlayback);S.timeTransaction=true;let out;try{out=catalogContext.commit(result);}finally{S.timeTransaction=false;}if(out?.ok===false){toast(out.error.message);return;}closeModal();render();toast(mode==='delete'?'已删除时间，后面的音轨同步前移。':mode==='clear'?'已清除所选内容，时间长度保持。':'作品长度已更新。');};
        if(mode==='clear'||mode==='delete')confirmAction('确认'+(mode==='delete'?'删除时间':'清除内容')+'？',`作用于所有音轨。${mode==='delete'?'后面的内容将同步前移。':'所选时间仍然保留。'}${count?'边界内容会拆分成'+count+'个片段。':''}可以一次撤销。`,apply);else apply();
        }catch(e){S.timeTransaction=false;toast(e.message);}
    }
    function keyboardSettings(){
        openModal('键盘与平台',`<p>当前：${G.keymap.platform()==='mac'?'Mac':'Windows / Linux'}。文字输入与中文输入法优先。</p><label class="form-label">键位配置<select data-field="keymap-platform"><option value="auto" ${G.keymap.preference()==='auto'?'selected':''}>跟随系统</option><option value="mac" ${G.keymap.preference()==='mac'?'selected':''}>Mac</option><option value="windows" ${G.keymap.preference()==='windows'?'selected':''}>Windows / Linux</option></select></label><table class="keymap-table">${Object.entries(G.keymap.bindings).map(([id,d])=>`<tr><td>${esc(d.label)}</td><td><kbd>${esc(G.keymap.label(id))}</kbd></td></tr>`).join('')}</table><p class="field-note">保存写入本机存档；下载备份请用导出。复制/剪切优先保留本页剪贴板，系统权限允许时也能跨窗口粘贴。Windows键位已配置，实机兼容性单独验证。</p>`);
    }
    function transformSelection(action){
        const a=G.resolveEditTarget(project,S);if(!['notes','range'].includes(a.kind)){toast('先选择音符或时间范围。');return;}
        const ids=a.kind==='notes'?a.ids:a.pattern.notes.filter(n=>n.start>=a.range.start&&n.start+n.duration<=a.range.end).map(n=>n.id);
        if(!ids.length){toast('先选择可编辑的完整音符。');return;}
        mutate(()=>{const p=project.tracks.find(t=>t.id===a.trackId).patterns.find(p=>p.id===a.patternId),source=p.notes.filter(n=>ids.includes(n.id));
            let changed;if(action==='quantize')changed=G.quantizeStarts(source,S.snap,p.bars*BAR,a.kind==='range'?a.range:null);
            else if(action.startsWith('duration:'))changed=G.durationNotes(source,action.slice(9),p.bars*BAR,S.cursor);
            else if(action==='velocity'){const v=Number($('#selection-velocity')?.value)/100;if(!(v>=.01&&v<=1))throw Error('力度范围为1—100%。');changed=source.map(n=>({...n,velocity:v}));}
            else if(action==='reverse'){const from=a.kind==='range'?a.range.start:Math.min(...source.map(n=>n.start)),to=a.kind==='range'?a.range.end:Math.max(...source.map(n=>n.start+n.duration));changed=source.map(n=>({...n,start:from+to-n.start-n.duration}));}
            else changed=action==='mirror-scale'?G.mirrorDegree(source,project.key,project.scale):transformNotes(source,action,p.bars*BAR);
            p.notes=p.notes.filter(n=>!ids.includes(n.id)).concat(changed);S.selected=changed.map(n=>n.id);G.activateNotes(S,project);
        });
    }
    function prepareCreation(mode){
        const a=G.resolveEditTarget(project,S),global=['recipe','arrange','mix','ensemble'].includes(mode);
        if(!global&&a.kind==='track'){toast('先在编排里选择这条轨道的一块音乐。');return false;}
        if(!global&&a.kind==='clips'){
            if(a.items.length!==1){toast('先选择一个音乐块进行创作。');return false;}
            const x=a.items[0];G.openPatternInSession(S,project,{trackId:x.track.id,clipId:x.clip.id,edit:false});S.editorOpen=true;S.editorManuallyClosed=false;
        }
        if(!global&&!S.editorOpen){editOpen();}
        return true;
    }
    function startCreation(mode,owner='creation'){
        if(!prepareCreation(mode))return;
        playback.endAudition();S.rightPanel=owner;
        if(owner==='composer'){
            if(composer.options&&composer.projectId===project.id)composer.render();else composer.open();
        }else{
            const old=creation.session,matching=old&&old.base.id===project.id&&old.target.trackId===S.trackId&&old.target.clipId===S.clipId;
            if(matching&&(!mode||old.mode===mode))creation.refresh();else{
                creation.open(mode);
                const a=G.resolveEditTarget(project,S);if(a.kind==='range'&&creation.session){creation.session.start=a.range.start;creation.session.end=a.range.end;creation.render();}
            }
        }
        render();
    }
    function trackIcon(t) { return t.kind === 'drum' ? 'drum' : presetById(t.preset, project).category === '低音' ? 'bass' : presetById(t.preset, project).category === '键盘' ? 'piano' : 'melody'; }
    function presetName(t) { return t.preset.startsWith('sample:') ? project.assets[t.preset.slice(7)]?.name || '自定义音源' : presetById(t.preset, project).name; }
    function defaultPitch(t) { return t.kind === 'drum' ? (G.drumsFor(project, t).find(r => !r.missing)?.pitch ?? 36) : (t.patterns.find(p=>p.id===S.patternId)||t.patterns[0]).notes[0]?.pitch || 60; }
    function preview(t, pitch, d = .25) { engine.preview(t, pitch, project, d).catch(e => toast(e.message)); }
    let creationMarkup='',creationFocus=null;const panelMarkup={creation:'',composer:''};
    function openCreation(title,body,subtitle='',owner='creation'){
        if(!creationFocus)creationFocus=G.ui.captureFocus();
        const other=owner==='creation'?'composer':'creation',otherDraft=other==='creation'?!!creation.session:!!composer.options;
        const resume=otherDraft?`<div class="tool-resume">${button('resume-tool',other==='creation'?'回到生成草稿':'回到和弦草稿','undo','quiet',`data-panel="${other}"`)}</div>`:'';
        const draft=owner==='creation'?creation.session:null,local=draft&&G.CREATION_OPERATIONS[draft.mode].scope==='instance',dt=draft?.base.tracks.find(t=>t.id===draft.target.trackId);const shortContext=local?`${dt?.name||'音乐块'} · 块内 ${G.ui.format.range(draft.start,draft.end)}`:owner==='composer'?'当前和弦草稿 · 放入前作品保持':'整首作品 · 采用前保持原稿';
        const markup=G.ui.PanelHeader({title,subtitle:shortContext,closeAction:'creation-close'})+`<p class="creation-dock-subtitle">${esc(subtitle)}</p>${resume}${body}`;
        panelMarkup[owner]=markup;if(S.rightPanel!==owner)return;
        creationMarkup=markup;const dock=$('#creation-dock');if(dock){dock.hidden=false;G.patchDOM(dock,markup);}
    }
    function closeCreation(owner=S.rightPanel){
        const visible=owner===S.rightPanel;
        if(owner==='composer'){composer.reset();panelMarkup.composer='';}
        else{creation.session?.flow?.cancel();creation.session=null;panelMarkup.creation='';}
        if(!visible)return;
        S.rightPanel=null;creationMarkup='';const dock=$('#creation-dock');if(dock){dock.hidden=true;dock.innerHTML='';}
        if(!G.ui.restoreFocus(creationFocus))$('.workspace-tabs .active')?.focus({preventScroll:true});creationFocus=null;drawCandidateProjection();
    }
    const catalogContext = { getProject: () => project, getSession: () => S, playback, button, esc, openModal, closeModal,
        openCreation:(title,body,subtitle='')=>openCreation(title,body,subtitle,'creation'),openComposer:(title,body,subtitle='')=>openCreation(title,body,subtitle,'composer'),closeCreation,toast,pickFile,render,
        showTemplates:role=>{library.open('rhythm');library.role=role||'all';library.render();},openTarget:options=>openPattern(options),
        updateProjection:()=>drawCandidateProjection(),fitProjection:()=>fitCandidateProjection(),
        repin: () => mutate(() => { G.pinDocument(project); }),
        commit: result => {
            const wholeSong = result.project.id !== project.id;
            if (wholeSong) { return loadProject(result.project).then(()=>({ok:true,changed:true})).catch(e => {toast(e.message);return {ok:false,changed:false,error:{message:e.message}};}); }
            if(wholeSong)playback.stop();else playback.endAudition();
            return mutate(() => {
                project = refreshPalette(result.project);
                if(result.timeEdit){G.reconcileSongTime(S,B,result.timeEdit);const selected=G.reconcileSession(S,project,B);S.cursor=G.clamp(S.cursor||0,0,selected.pattern.bars*BAR-1);}
                if (wholeSong) {
                    Object.assign(S, G.createEditorSession(project));
                    Object.assign(B, G.createPlaybackContext());
                }
                if(result.trackId&&result.patternId){
                    const prior={trackId:S.trackId,patternId:S.patternId},active=G.resolveEditTarget(project,S);
                    G.openPatternInSession(S,project,{trackId:result.trackId,patternId:result.patternId,clipId:result.clipId,edit:false});
                    if(['notes','range'].includes(active.kind)&&prior.trackId===result.trackId){G.activateNotes(S,project);}
                    else if(!['creation','composer','sound','properties','pipeline'].includes(S.rightPanel)){G.activateClips(S,project,result.clipId?[result.clipId]:[],result.trackId);}
                }
            });
        }
    };
    const materials = new G.CatalogUI(catalogContext), composer = new G.ComposerUI(catalogContext), creation = new G.CreationUI(catalogContext), shelf = new G.TemplateShelf(catalogContext,materials);
    const library=new G.StudioLibrary(catalogContext,shelf);catalogContext.openLibrary=(kind,id,trackId)=>library.open(kind,id,trackId);
    function inspectorScrollKey(){
        const owner=S.rightPanel;if(!owner)return '';
        if(['properties','sound','pipeline'].includes(owner))return owner+':'+S.inspectorTrackId;
        if(owner==='creation')return owner+':'+(creation.session?.target.trackId||'')+':'+(creation.session?.target.clipId||'');
        if(owner==='composer')return owner+':'+(composer.options?.trackId||'')+':'+(composer.options?.patternId||'');
        const a=G.resolveEditTarget(project,S);return owner+':'+(owner==='edit'?[a.kind,a.trackId,a.patternId].join(':'):project.id);
    }
    function render() {
        const previousPanel=$('#creation-dock');S.panelScrolls||={};
        if(previousPanel?.dataset.panelKey)S.panelScrolls[previousPanel.dataset.panelKey]=previousPanel.scrollTop;
        // Preserve scroll and focus across deterministic DOM renders.
        const previous = $('.view-content');
        if (previous?.dataset.scrollkey) {
            S.scrolls[previous.dataset.scrollkey] = { x: previous.scrollLeft, y: previous.scrollTop };
            for (const el of previous.querySelectorAll('[data-scroll]'))
                S.scrolls[el.dataset.scroll==='arrange'?'component:arrange':el.dataset.scrollkey||'editor:'+previous.dataset.opened+':'+el.dataset.scroll] = { x: el.scrollLeft, y: el.scrollTop };
        }
        const focusToken = G.ui.captureFocus();
        syncSelection();
        renderCounter++;
        const t=track(),p=pattern(),scrollKey='workspace:'+S.view;
        if(['properties','sound','pipeline'].includes(S.rightPanel)&&!project.tracks.some(t=>t.id===S.inspectorTrackId))S.rightPanel=null;
        creationMarkup=panelMarkup[S.rightPanel]||'';
        G.patchDOM($('#app'), G.views.renderShell({ ...viewContext(), engine, history, future, renderEditor, renderArrange, renderMix, scrollKey }));
        $$('input[type=range]').forEach(el=>el.style.setProperty('--range-progress',((+el.value-(+el.min||0))/(+el.max-(+el.min||0))*100)+'%'));
        updateStatus();
        if (S.view !== 'mix' && S.editorOpen)
            drawGrid();
        updateTransport();
        const current=$('.view-content');current.dataset.opened=S.trackId+':'+S.patternId;
        const scroll=S.scrolls[scrollKey];
        if (scroll) {
            current.scrollLeft = scroll.x;
            current.scrollTop = scroll.y;
        }
        for (const el of current.querySelectorAll('[data-scroll]')) {
            const v = S.scrolls[el.dataset.scroll==='arrange'?'component:arrange':'editor:'+S.trackId+':'+S.patternId+':'+el.dataset.scroll];
            if (v) {
                el.scrollLeft = v.x;
                el.scrollTop = v.y;
            }
        }
        G.ui.restoreFocus(focusToken);
        creation.refresh();composer.refresh();
        const panel=$('#creation-dock'),panelKey=inspectorScrollKey();if(panel){panel.dataset.panelKey=panelKey;if(panelKey)panel.scrollTop=S.panelScrolls[panelKey]||0;}
        G.motion?.afterRender(S);
        if (S.modal) document.querySelector('#app').inert = true;
        G.saveWorkspace(S, project.id);
        if(library.visible)library.render({focus:true});if(library.batch)library.paintBatch();
    }
    function baseContext(){return {project,S,B,compact:false,track,pattern,button,ib,icon,esc,miniPattern,slider,presetName,trackIcon,drafts:{creation:!!creation.session,composer:!!composer.options}};}
    function toolContext(){const t=toolTrack(),context=baseContext();return {...context,track:()=>t,pattern:()=>t.patterns.find(p=>p.id===S.patternId)||t.patterns[0],slider:(label,group,key,value,min=0,max=1,step=.01,display='',id='')=>slider(label,group,key,value,min,max,step,display,id||(group==='project'?'':t.id)),soundCards:()=>G.views.soundCards({...context,track:()=>t}),waveIllustration,renderSound,renderPipeline};}
    function viewContext(){return {...baseContext(),creationMarkup,shelfMarkup:library.batchMarkup()||shelf.render(),inspectorMarkup:G.views.renderInspector({...baseContext(),renderSound,renderPipeline}),renderSound,renderPipeline,soundCards,waveIllustration};}
    function renderEditor(){return G.views.renderEditor(viewContext());}
    function renderPipeline(){return G.views.renderPipeline(toolContext());}
    function getRows(){return G.visiblePitches(project,S,track(),pattern());}
    let geo={width:960,left:72,top:28,row:26,cw:55,rows:[],height:0};
    function refreshEditUI(){const el=$('#editbar-host');if(el)G.patchDOM(el,G.views.renderEditBar(baseContext()));}
    function drawGrid(){const next=G.views.drawPianoRoll({...baseContext(),getRows,drag:interactions?.getDrag()});if(next){geo=next;interactions?.setGeometry(next);updatePlayhead();drawCandidateProjection();}}
    function drawCandidateProjection(){G.ui.drawCandidateProjection(creation?.projection?.(),geo);}
    function fitCandidateProjection(){const x=creation.session;if(!x||x.flow?.state!=='ready')return;const notes=x.candidates.flatMap(r=>r.project.tracks.find(t=>t.id===r.trackId)?.patterns.find(p=>p.id===r.patternId)?.notes||[]);if(!notes.length)return;const v=G.viewportFor(S,track()),pitches=notes.concat(pattern().notes).map(n=>n.pitch),lo=Math.min(...pitches),hi=Math.max(...pitches);v.low=Math.max(0,lo-2);v.span=Math.min(127-v.low,Math.max(12,hi-lo+4));drawGrid();G.saveWorkspace(S,project.id);}
    function renderArrange(){return G.views.renderArrange(baseContext());}
    function soundCards(){return G.views.soundCards(toolContext());}
    function renderSound(){return G.views.renderSound({...toolContext(),compact:true});}
    function waveIllustration(t) { return G.views.waveIllustration(t,project); }

    function renderMix() { return G.views.renderMix(viewContext()); }
    let pendingConfirm = null, pendingForm = null;
    function openModal(title, body, subtitle = '') {
        S.modal = true;
        G.ui.modal.open(title, body, subtitle);
    }
    function closeModal() {
        if(recordingRequest){recordingRequest.cancelled=true;recordingRequest=null;}
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
    function openHelp(){openModal('乐构 · 操作与作用范围',`<div class="help-note"><b>一个创作工作台：</b>从编排选择音乐块，下方打开音符。点击音轨名称查看本轨设置；收起或放大下方编辑器只改变布局。混音是另一个工作区。</div><div class="help-note"><b>先看操作栏左侧：</b>它写明正在操作音乐块、音符、音轨或时间范围。删除只作用于这个明确对象。工具按钮或素材搜索获得焦点，不会偷换音乐目标；文本框中的删除只处理文本。</div><div class="keymap-summary">${Object.entries(G.keymap.bindings).map(([id,b])=>`<span><kbd>${esc(G.keymap.label(id))}</kbd> ${esc(b.label)}</span>`).join('')}${button('keyboard-settings','键盘与平台设置','piano','quiet')}</div><div class="help-table">${[[G.keymap.label('copy')+' / '+G.keymap.label('paste'),'复制 / 粘贴当前对象。复制保留落点；粘贴使用编辑落点，不跟随播放游标。'],[G.keymap.label('duplicate'),'复制一份独立内容，接在当前选择之后。'],[G.keymap.label('delete'),'删除当前对象；删音乐块只移除一个编排位置。'],[G.keymap.label('select-all'),'全选当前音符画板，或全选编排中的音乐块。'],[G.keymap.label('undo'),'撤销；加 Shift 重做。'],['空格','播放 / 暂停。输入框与按钮保留自己的键盘行为。'],['B / V / R / E / H','画板内：画笔、选择、时间范围、橡皮、浏览。'],['方向键','音符左右按网格移动，上下半音；Alt 左右微调，Shift 上下八度。'],['Ctrl / ⌘ + 滚轮','缩放时间轴；再加 Shift 调整音高行距。']].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('')}</div><div class="help-note"><b>素材与生成：</b>左边试听、选择或拖入模板；右边生成方案并比较。暂时切换到音色可保留本次会话的草稿，从“恢复生成草稿”返回。方案固定原目标，来源改变时需要重新生成。关闭草稿代表取消。</div><div class="help-note"><b>音色与共享：</b>本轨音色、演奏处理影响整条轨道。关联重复共同使用乐句内容；“复制一份”默认独立。清空音乐块内容是明确的单独操作，会提示所有共享引用。</div><div class="help-note"><b>保存与导出：</b>底部显示实际保存状态。重要作品请下载 .gridtone 备份。默认 WAV / MIDI 导出全曲；选择“当前试听”可以导出未应用方案。作品文件始终保存已应用的完整作品。</div><div class="modal-actions">${button('close-modal','返回工作台','check','dark-btn')}</div>`); }
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
        const target = {trackId:S.trackId,patternId:S.patternId};
        mutate(() => {
            const t=project.tracks.find(t=>t.id===target.trackId),p=t?.patterns.find(p=>p.id===target.patternId);
            if(!p)throw Error('编辑目标已不存在。');
            const old = p.bars, proposed = { ...p, bars };
            for (const c of t.clips.filter(c => c.patternId === p.id)) {
                if (!canPlace(t, proposed, c.bar, project.bars, c.id))
                    throw Error('扩展后会碰到相邻音乐块。先在编排中留出空位，或创建一个新音乐块。');
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
    function copyNotes(){return runEdit('copy');}
    function pasteNotes(){return runEdit('paste');}
    function deleteNotes(){return runEdit('delete');}
    async function togglePlay() { await playback.toggle(); render(); }
    function transposeDialog() {
        if (track().kind === 'drum') {
            toast('鼓组按鼓件编辑。');
            return;
        }
        const tid = S.trackId, pid = S.patternId, ids = [...S.selected], before = fingerprint(project);
        const sourceKey = project.key, sourceScale = project.scale;
        const candidate = () => { if (fingerprint(project) !== before)
            throw Error('作品在预览期间发生了变化，请重新打开移调窗口。'); return G.pitchCandidate(project, tid, pid, ids, { mode: $('#transpose-mode').value, semitones: Number($('#transpose-amount').value), sourceKey, sourceScale, targetKey: Number($('#transpose-key').value), targetScale: $('#transpose-scale').value }); };
        pendingPitch = { candidate, tid, pid };
        openModal('移调与调式适配', `<p class="modal-copy">作用于 ${ids.length ? '选中的 ' + ids.length + ' 个音符' : '本音乐块全部音符'}。试听保持原稿；确认后写入实际音符，可一次撤销。</p><label class="form-label">方式<select id="transpose-mode"><option value="semitone">整体移动半音 · 保持音程</option><option value="key">整体换主音 · 最近方向</option><option value="adapt">按级数适配调式 · 保留原有变化音偏移</option></select></label><div class="form-grid"><label class="form-label">移动半音（方式一）<input id="transpose-amount" type="number" min="-24" max="24" step="1" value="2"></label><label class="form-label">目标主音（方式二、三）<select id="transpose-key">${KEYS.map((v, i) => `<option value="${i}" ${i === sourceKey ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="form-label">目标调式（方式三）<select id="transpose-scale">${Object.entries({ major: '大调', minor: '小调', pentatonic: '五声音阶', chromatic: '半音阶' }).map(([k, l]) => `<option value="${k}" ${k === sourceScale ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div><p class="modal-copy">级数适配适用于同音级数的音阶（例如大调到小调）；原调外音保留相对最近调内音的半音偏移。参考调性保持原设置。</p><div class="modal-actions">${button('preview-pitch', '试听结果', 'headphones', 'soft-btn')}${button('stop', '停止试听', 'stop', 'quiet')}${button('apply-pitch', '确认修改', 'check', 'dark-btn')}</div>`);
    }
    function exportDialog() { openModal('导出作品', `<label class="field-row export-scope">导出范围<select id="export-scope"><option value="song">整首作品 · ${project.bars} 小节</option><option value="pattern">当前音乐块 · ${pattern().bars} 小节</option><option value="current">当前试听范围（含临时只听）</option></select></label><div class="export-options">${button('export-wav', 'WAV 音频', 'wave', 'soft-btn export-option')}${button('export-midi', 'MIDI 乐谱', 'piano', 'soft-btn export-option')}${button('export-project', '乐构工程', 'file', 'soft-btn export-option')}</div><div class="export-descriptions"><p>默认导出作品混音，保留作品静音设置，忽略临时只听。作品文件始终包含全曲。</p><p><b>WAV</b>：44.1 kHz / 16-bit 立体声，包含音色与效果，附 3 秒尾音。单次最多 3 分钟。</p><p><b>MIDI</b>：导出音符、速度、移调、琶音和律动，供其他编曲软件继续编辑；具体音色与音频效果不会随 MIDI 保留。</p><p><b>乐构工程</b>：保存整首作品的所有音符、设置和自定义音源，可重新打开接着写。</p></div><p id="export-progress" class="export-progress" role="status"></p>`); }
    async function doExport(type) {
        const range = $('#export-scope')?.value || 'song', selection=playback.exportSelection(type==='project'?'song':range);
        const exportProject=selection.project,scope=selection.scope,name=safeFilename(project.title)+(range==='song'?'':'_'+safeFilename(range==='pattern'?pattern().name:selection.label));
        try {
            if (type === 'project') {
                downloadBlob(new Blob([JSON.stringify(exportProject, null, 2)], { type: 'application/json' }), safeFilename(project.title) + '.gridtone');
                toast('作品已打包，包含自定义音源。');
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
        creation.session?.flow?.cancel();creation.session=null;composer.reset();panelMarkup.creation='';panelMarkup.composer='';creationMarkup='';shelf.finishPlacement('project-changed',{render:false});
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
                throw Error('作品文件超过 40 MB。');
            await loadProject(JSON.parse(await file.text()));
            toast('已打开作品：' + project.title);
        }
        catch (e) {
            toast('没有导入：' + e.message);
        }
    }
    async function addSample(blob, name) {
        const destination={projectId:project.id,trackId:toolTrack().id};
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
            if(project.id!==destination.projectId)throw Error('作品已切换，请在目标作品中重新导入音源。');
            const committed=mutate(() => {
                const size = Object.values(project.assets).reduce((s, a) => s + a.data.length * .75, 0) + data.length * .75;
                if (size > G.LIMITS.assetsBytes)
                    throw Error('内嵌音源已超过 24 MB。');
                let t=project.tracks.find(t=>t.id===destination.trackId);if(!t)throw Error('目标音轨已删除，请重新选择音轨。');
                const id = uid('a');
                project.assets[id] = { name: name.replace(/\.[^.]+$/, ''), root: 60, mode: 'pitched', data };
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
                S.rightPanel='sound';S.inspectorTrackId=t.id;
                S.tab='全部';
            });
            if(committed?.ok===false)throw Error(committed.error.message);
            closeModal();
            toast('音源已加入，并会随作品文件一起保存。');
        }
        catch (e) {
            toast('音源没有导入：' + e.message);
        }
    }
    async function recordSample() {
        if(recordingRequest||recording)return;
        const request={cancelled:false,projectId:project.id};let acquiredStream=null;recordingRequest=request;
        openModal('允许使用麦克风', '<p>请在浏览器中允许录音。关闭此窗口即可取消，本次授权返回后也不会开始录制。</p>'+button('close-modal','取消','','quiet'));
        try {
            if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder)
                throw Error('当前环境不能录音。请使用 localhost 或 HTTPS 打开，或直接导入音频文件。');
            const stream = acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
            if(request.cancelled||project.id!==request.projectId){stream.getTracks().forEach(t=>t.stop());return;}
            recordingRequest=null;
            const recorder = new MediaRecorder(stream), chunks = [];
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
            acquiredStream?.getTracks().forEach(t=>t.stop());if(recording?.stream===acquiredStream){clearTimeout(recording.timer);clearInterval(recording.interval);recording=null;}
            if(!request.cancelled){closeModal();toast('录音未开始：'+e.message+'。也可以导入音频文件。');}
        }finally{if(recordingRequest===request)recordingRequest=null;}
    }
    function noteMenu(){const label=G.editTargetLabel(project,S);openModal(label.title,`<p>${esc(label.detail)}</p><div class="menu-grid">${['copy','paste','duplicate','delete','select-all'].map(id=>{const d=G.editCommandState(project,S,id);return button('context-edit',d.label,d.icon,'quiet',`data-command="${id}" ${d.enabled?'':'disabled'}`);}).join('')}${button('context-tools','变形与精细编辑','mix','soft-btn')}</div>`);}
    function appearanceDialog() {
        const a=G.appearance.get();
        openModal('外观与动效', `<div class="appearance-grid">${[['crystal','暖白磁贴','安静暖白 · 浅厚度音乐块'],['pearl','奶油浅瓷','微暖表面 · 同一套操作']].map(([id,name,desc])=>`<button class="skin-card ${a.skin===id?'active':''}" data-action="choose-skin" data-skin="${id}" aria-pressed="${a.skin===id}"><span class="skin-swatch ${id}" aria-hidden="true"></span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><label class="field-row"><span>减少透明度</span><input type="checkbox" data-field="reduce-transparency" ${a.transparency==='reduced'?'checked':''}></label><label class="field-row"><span>减少动态效果</span><input type="checkbox" data-field="reduce-motion" ${a.motion==='reduced'?'checked':''}></label><p class="appearance-note">音乐磁贴保留浅厚度，画板与音符时间保持稳定。减少动态时保留选中、吸附和播放位置提示；系统的减少动态设置也会自动生效。</p>`, '轻触、拿起、落定。');
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
            bankRequest=null;closeModal();S.soundSource='recorded';S.tab='全部';library.open('sound',id,S.inspectorTrackId);library.legacy=true;library.render();toast(bank.name+' 已就绪。点击试听，或使用到本轨。');
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
        if(['ArrowLeft','ArrowRight'].includes(action)){
            const a=G.resolveEditTarget(project,S);if(a.kind!=='clips'||!a.ids.length)return;
            mutate(()=>{const r=G.moveClips(project,a.ids,action==='ArrowLeft'?-1:1);project=r.project;S.clipIds=r.ids;G.activateClips(S,project,r.ids,a.trackId);});return;
        }
        return runEdit(action==='select-all'?'select-all':action);
    }
    let noteOriginal=null,noteIds=[];
    function noteInspector(){
        noteOriginal=snapshot();noteIds=[...S.selected];const ns=selectedNotes();
        openModal('精细编辑',`<p>${ns.length?'修改所选 '+ns.length+' 个音符':'修改当前音乐块全部音符'} · 可先比较，再应用</p><div class="precise-fields"><label>微时移（ticks，960 = 一拍）<input id="note-time" type="number" value="0" step="1"></label><label>移调（半音）<input id="note-pitch" type="number" value="0" min="-24" max="24"></label><label>力度（1–100%，留空保持）<input id="note-velocity" type="number" min="1" max="100" placeholder="保持原力度"></label><label>时长倍率<input id="note-length" type="number" min="0.1" max="8" step="0.1" value="1"></label></div><div class="modal-actions">${button('note-preview-original','试听修改前','headphones','soft-btn')}${button('note-preview-candidate','试听修改后','headphones','soft-btn')}${button('note-apply','应用修改','check','dark-btn')}</div>`);
    }
    function noteCandidate(){
        const next=clone(noteOriginal),t=next.tracks.find(t=>t.id===S.trackId),p=t.patterns.find(p=>p.id===S.patternId),dt=Number($('#note-time').value),dp=Number($('#note-pitch').value),factor=Number($('#note-length').value),vel=$('#note-velocity').value;
        if(!Number.isFinite(dt)||!Number.isInteger(dp)||Math.abs(dp)>24||!Number.isFinite(factor)||factor<=0||factor>8||vel!==''&&(!Number.isFinite(+vel)||+vel<1||+vel>100))throw Error('请填写有效的时间、音高、时长和力度。');
        for(const n of p.notes){if(noteIds.length&&!noteIds.includes(n.id))continue;n.start=Math.round(n.start+dt);n.duration=Math.max(1,Math.round(n.duration*factor));if(t.kind!=='drum')n.pitch+=dp;if(vel!=='')n.velocity=Number(vel)/100;if(n.start<0||n.start+n.duration>p.bars*BAR||n.pitch<0||n.pitch>127)throw Error('结果超出音乐块或音高边界，请缩小修改幅度。');}
        return next;
    }
    function editorMore(){openInspector('edit');}
    async function showRecoveries(){try{const rows=await G.listRecoveries(project.id);openModal('恢复版本',`<p>保留最近 10 个自动恢复点，间隔至少 30 秒。恢复可以撤销。</p><div class="recovery-list">${rows.length?rows.map(r=>button('restore-recovery',esc(r.title)+' · '+new Date(r.time).toLocaleString(),'undo','soft-btn',`data-id="${r.id}"`)).join(''):'修改作品后会生成恢复点。'}</div>`);}catch(e){toast(e.message);}}

    function handleAction(action, el) {
        if(library.handle(action,el))return;
        if(action==='keyboard-settings'){keyboardSettings();return;}
        if(action==='save-current'){void saveCurrent();return;}
        const legacyCommands={'duplicate-pattern':'duplicate','duplicate-track':'duplicate','remove-track':'delete','clear-pattern':'clear','duplicate-clip':'linked','unlink-clip':'unlink','delete-clip':'delete'};
        if(legacyCommands[action]){if(S.modal)closeModal();runEdit(legacyCommands[action]);return;}
        if(action==='open-pattern-id'){openPattern({trackId:el.dataset.track,patternId:el.dataset.pattern,edit:true,activation:'notes'});return;}
        if(action==='time-tools'){showTimeTools();return;}
        if(action==='time-apply'){applyTimeTools(el.dataset.mode);return;}
        if(action==='sound-full'){openInspector('sound',el.dataset.track);openModal('调整当前声音',G.views.renderSoundParameters(toolContext()));return;}
        if(action==='sound-test-current'){const t=project.tracks.find(t=>t.id===el.dataset.track);if(!t){toast('目标音轨已删除。');return;}const pat=t.patterns.find(p=>p.notes.length)||t.patterns[0];if(pat.notes.length)void playback.audition(snapshot(),{kind:'pattern',trackId:t.id,patternId:pat.id,ignoreMute:true},'当前音轨与参数');else preview(t,defaultPitch(t),.6);return;}
        if(action==='sound-resources'){openInspector('sound',el.dataset.track);openModal('声音资源与导入',`<p>目标音轨：${esc(toolTrack().name)}。录音与导入完成后仍可选择是否采用。</p><div class="button-column">${button('record','录音','mic','soft-btn')}${button('import-sample','导入音频','upload','soft-btn')}${button('import-catalog','导入音源包','folder','soft-btn')}${button('catalog-tab','管理鼓组与资源','drum','quiet','data-category="drumkits"')}</div><details class="inspector-section"><summary>可选实录音源</summary><p>首次载入需要联网；成功后再到音色选择器使用。</p>${G.SAMPLE_BANKS.map(b=>button('load-sample-bank',b.name,'download','quiet',`data-id="${b.id}"`)).join('')}</details><div class="modal-actions">${button('close-modal','关闭','','quiet')}</div>`);return;}
if(action==='structure-tools'){openInspector('arrangement');return;}
        if(action==='note-inspector'){
            const a=G.resolveEditTarget(project,S);if(!['notes','range'].includes(a.kind)||a.kind==='notes'&&!a.ids.length){toast('请先选择音符。');return;}
            S.selected=a.kind==='range'?a.pattern.notes.filter(n=>n.start>=a.range.start&&n.start+n.duration<=a.range.end).map(n=>n.id):a.ids;
            if(!S.selected.length){toast('选区中没有完整音符。');return;}noteInspector();return;
        }
        if(action==='transpose-dialog'){
            const a=G.resolveEditTarget(project,S);if(!['notes','range'].includes(a.kind)){toast('请先选择音符。');return;}
            S.selected=a.kind==='range'?a.pattern.notes.filter(n=>n.start>=a.range.start&&n.start+n.duration<=a.range.end).map(n=>n.id):a.ids;
            if(!S.selected.length){toast('请先选择音符。');return;}transposeDialog();return;
        }

        if(action==='context-edit'){closeModal();if(el.dataset.command==='paste')void pasteSystem();else runEdit(el.dataset.command);return;}
        if(action==='context-tools'){closeModal();openInspector('edit');return;}

        if(action==='edit-command'){if(el.dataset.command==='paste')void pasteSystem();else runEdit(el.dataset.command);return;}
        if(action==='edit-open'){editOpen();return;}
        if(action==='edit-transform'){transformSelection(el.dataset.transform);return;}
        if(action==='edit-duration'){transformSelection('duration:'+el.dataset.duration);return;}
        if(action==='edit-velocity'){transformSelection('velocity');return;}
        if(action==='edit-tools'){const a=G.resolveEditTarget(project,S);openInspector(a.kind==='track'?'properties':'edit',a.trackId);return;}
        if(action==='canvas-settings'){openInspector('view',S.trackId);return;}
        if(action==='inspector-tab'){openInspector(el.dataset.panel,el.dataset.track);return;}
        if(action==='inspector-close'){S.rightPanel=null;playback.endAudition();render();return;}
        if(action==='resume-tool'){const owner=el.dataset.panel;if(owner==='creation'&&!creation.session||owner==='composer'&&!composer.options){toast('这份草稿已经结束。');return;}playback.endAudition();S.rightPanel=owner;if(owner==='creation')creation.refresh();else composer.refresh();render();return;}
        if(action==='return-draft-target'){const owner=el.dataset.panel,target=owner==='composer'?composer.options:creation.session?.target;if(!target)return;const t=project.tracks.find(t=>t.id===target.trackId),clip=t?.clips.find(c=>c.id===target.clipId)||t?.clips.find(c=>c.patternId===target.patternId);if(!t||!clip){toast('草稿目标已不存在。');return;}openPattern({trackId:t.id,clipId:clip.id,edit:true,activation:'notes'});S.rightPanel=owner;render();return;}
        if(action==='creation-close'){if(S.rightPanel==='composer'){composer.reset();playback.endAudition();closeCreation();}else creation.close();render();return;}
        if(action==='open-instance'){openPattern({trackId:el.dataset.track,clipId:el.dataset.clipId,edit:true});return;}
        if(action==='open-sound'){openInspector('sound',el.dataset.track||G.activeEditTrack(project,S).id);return;}
        if(action==='editor-tab'){if(el.dataset.tab==='notes'){editOpen();S.rightPanel=null;render();}else openInspector(el.dataset.tab,S.trackId);return;}
        if(action==='creation'||action==='recipes'){startCreation(action==='recipes'?'recipe':el?.dataset.mode);return;}
        if(action==='composer'){startCreation(undefined,'composer');return;}
        if(action==='harmony-editor'){if(!prepareCreation())return;S.rightPanel='creation';if(!creation.session)creation.open();creation.harmonyEditor();return;}
        if(action==='track-options'||action==='rename-track'){selectTrack(el.dataset.id||G.activeEditTrack(project,S).id);return;}
        if(action==='new-blank-clip'){
            const a=G.resolveEditTarget(project,S),tid=el.dataset.track||a.trackId||S.arrangeCursor?.trackId||S.trackId;
            const bar=el.dataset.bar!==undefined?Number(el.dataset.bar):Math.floor((S.arrangeCursor?.tick||0)/BAR);
            mutate(()=>{const t=project.tracks.find(t=>t.id===tid),p=newPattern('新乐句',1);if(!t||!canPlace(t,p,bar,project.bars))throw Error('当前位置已有内容，请在空白小节设置落点。');
                t.patterns.push(p);const c={id:uid('c'),patternId:p.id,bar};t.clips.push(c);G.openPatternInSession(S,project,{trackId:t.id,clipId:c.id});S.selected=[];G.activateClips(S,project,[c.id],t.id);});return;
        }
        if(action==='place-clip'){const tid=el.dataset.track,tick=Number(el.dataset.bar)*BAR;S.arrangeCursor={trackId:tid,tick};G.activateClips(S,project,[],tid);render();return;}
        if(action==='clip-menu'){openInspector('edit');return;}
        if(['copy-notes','paste-notes','delete-notes','menu-copy','menu-delete'].includes(action)){runEdit(action.includes('copy')?'copy':action.includes('paste')?'paste':'delete');return;}
        if(action==='select-all'){runEdit('select-all');return;}
        if(action==='transform'){transformSelection(el.dataset.transform);return;}

        if(S.modal&&['fit-notes','zoom-out','zoom-in','pattern','duplicate-pattern','duplicate-clip','unlink-clip','transform','shorten-notes','lengthen-notes','split-notes','split-at-cursor','octave-up','octave-down','scale-lock','listen-pattern','listen-bar','clear-solo'].includes(action))closeModal();
        if(action==='workspace-menu'){openModal('乐构 · 工作台',`<div class="studio-tools-menu">${button('project-menu','我的作品','folder')}${button('catalog','模板与素材','grid')}${button('view','混音台','mix','','data-view="mix"')}${button('appearance','外观与动效','spark')}${button('keyboard-settings','键盘与平台','piano')}${button('save-current','保存当前作品','save')}${button('help','操作帮助','help')}</div>`);return;}
        if(action==='preview-track'){const t=project.tracks.find(t=>t.id===el.dataset.id);if(t){openPattern({trackId:t.id});playback.start('pattern').then(render);}return;}
        if(action==='close-editor'){S.editorOpen=false;S.editorExpanded=false;S.editorManuallyClosed=true;if(['notes','range'].includes(S.editTarget.kind))G.setEditTarget(S,project,{kind:'none'});render();return;}
        if(action==='expand-editor'){S.editorExpanded=!S.editorExpanded;render();return;}
        if(action==='clear-range'){playback.setRange(null);render();return;}
        if(action==='track-options'){S.trackId=el.dataset.id;handleAction('rename-track',el);return;}
        if(action==='clip-menu'){openModal('音乐块操作',`<div class="studio-tools-menu">${button('clips-copy','复制','copy')}${button('clips-paste','粘贴')}${button('clips-duplicate','独立复制')}${button('duplicate-clip','重复引用','link')}${button('unlink-clip','转为独立音乐块','split')}${button('clips-delete','删除','trash')}</div><p>普通复制相互独立；重复引用共享音符。跨轨移动会使用目标轨音色。</p>`);return;}
        if(action.startsWith('clips-')){closeModal();clipCommand(action.slice(6));return;}
        if(action==='note-inspector'){noteInspector();return;}
        if(action==='note-preview-original'||action==='note-preview-candidate'){try{playback.audition(action==='note-preview-original'?noteOriginal:noteCandidate(),{kind:'pattern',trackId:S.trackId,patternId:S.patternId,ignoreMute:true},action==='note-preview-original'?'修改前':'修改后');}catch(e){toast(e.message);}return;}
        if(action==='note-apply'){try{const candidate=noteCandidate();closeModal();mutate(()=>project=candidate);}catch(e){toast(e.message);}return;}
        if(action==='editor-more'){editorMore();return;}
        if(action==='retry-save'){persist();flushSave().then(showProjects).catch(e=>toast(e.message));return;}
        if(action==='discard-reload'){confirmAction('放弃本页尚未保存的修改？','将打开这份作品最后成功保存的版本。',async()=>{try{clearTimeout(saveTimer);pendingSnapshot=null;await pendingSave.catch(()=>{});const saved=await G.projects.load(project.id);if(!saved)throw Error('尚无存档，请先下载当前作品。');pendingSave=Promise.resolve();S.saveStatus='已保存在本机';await loadProject(saved,{fromLibrary:true});}catch(e){toast(e.message);}});return;}
        if(action==='project-copy'){const copy=G.copyProject(project);clearTimeout(saveTimer);pendingSnapshot=null;G.projects.save(copy).then(()=>{pendingSave=Promise.resolve();S.saveStatus='已保存在本机';return loadProject(copy,{fromLibrary:true});}).catch(e=>toast(e.message));return;}
        if(action==='project-open'){confirmAction('打开已保存的作品？','当前修改会先保存。保存冲突时，可以先另存为新作品。',()=>flushSave().then(()=>G.projects.load(el.dataset.id)).then(p=>{if(!p)throw Error('作品已不存在。');return loadProject(p,{fromLibrary:true});}).catch(e=>toast(e.message)));return;}
        if(action==='project-download'){G.projects.load(el.dataset.id).then(p=>downloadBlob(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),safeFilename(p.title)+'.gridtone')).catch(e=>toast(e.message));return;}
        if(action==='project-delete'){confirmAction('删除这份本机作品？','只删除选定作品及其恢复点。建议先下载作品备份。',()=>G.projects.delete(el.dataset.id).then(showProjects).catch(e=>toast(e.message)));return;}
        if(action==='recoveries'){showRecoveries();return;}
        if(action==='restore-recovery'){G.loadRecovery(el.dataset.id,project.id).then(p=>{if(p){closeModal();mutate(()=>project=G.pinDocument(validateProject(p)));}}).catch(e=>toast(e.message));return;}

        if(action==='sound-source'){playback.endAudition();S.soundSource=el.dataset.source;S.tab='全部';S.query='';render();return;}
        if(action==='sound-audition'){try{soundAudition(el.dataset.id);}catch(e){toast(e.message);}return;}
        if(action==='load-sample-bank'){loadSampleBank(el.dataset.id);return;}
        if(action==='audition-key'){preview(toolTrack(),+el.dataset.pitch,.5);return;}
        if(action==='key-octave'){S.keyOctave=G.clamp((S.keyOctave??4)+Number(el.dataset.delta),1,6);render();return;}

        if(action==='appearance'){appearanceDialog();return;}
        if(action==='choose-skin'){G.appearance.set({skin:el.dataset.skin});appearanceDialog();return;}
        if (shelf.handleAction(action,el) || creation.handleAction(action, el) || composer.handleAction(action, el) || materials.handleAction(action, el))
            return;
        const id = el.dataset.id;
        if (action === 'home') {
            changeView('arrange');
        }
        else if (action === 'view')
            changeView(el.dataset.view);
        else if (action === 'open-current')
            openPattern({ patternId: S.patternId });
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
            textForm('音乐块名称', pattern().name, v => mutate(() => pattern().name = v));
        else if (action === 'add-track')
            openModal('添加音轨', `<div class="track-choices">${[['epiano', '和弦 / 键盘', '用几个长音，搭出歌曲的情绪。', 'piano'], ['roundbass', '贝斯 / 低音', '让节奏有一个稳稳的底。', 'bass'], ['marimba', '旋律 / 主音', '画出你想哼唱的那条线。', 'melody'], ['drums', '鼓机 / 打击乐', '用 16 格，写一段身体会跟着动的节奏。', 'drum'], ['cloudpad', '氛围 / 长音', '慢慢展开，让画面更宽一些。', 'wave']].map(([id, l, d, ic]) => `<button class="track-choice" data-action="create-track" data-preset="${id}"><span>${icon(ic, 27)}</span><div><strong>${l}</strong><p>${d}</p></div>${icon('plus', 20)}</button>`).join('')}</div>`);
        else if (action === 'create-track') {
            mutate(() => {
                if (project.tracks.length >= 64)
                    throw Error('当前版本最多支持 64 条音轨。');
                const preset = el.dataset.preset, t = newTrack(preset === 'drums' ? 'drum' : 'melodic', project.tracks.length, preset);
                t.name = presetById(preset).name;
                // The creation choice declares a role; later sound changes never infer it.
                t.role = ({epiano:'chords',roundbass:'bass',marimba:'melody',drums:'drums',cloudpad:'texture'})[preset]||'unspecified';
                if (preset === 'roundbass')
                    G.viewportFor(S, t).low = 24;
                project.tracks.push(t);
                S.trackId = t.id;
                S.patternId = t.patterns[0].id;
                S.view='arrange';S.selected=[];S.editorOpen=true;S.editorManuallyClosed=false;G.activateClips(S,project,[t.clips[0].id],t.id);S.rightPanel='properties';S.inspectorTrackId=t.id;
            });
            closeModal();
        }
        else if (action === 'add-pattern')
            mutate(() => addPatternAndPlace(track(), newPattern('音乐块 ' + String.fromCharCode(65 + track().patterns.length % 26))));
        else if (action === 'duplicate-pattern')
            mutate(() => addPatternAndPlace(track(), copyPattern(pattern())));
        else if (action === 'transpose-dialog')
            transposeDialog();
        else if (action === 'preview-pitch') {
            try {
                const p = pendingPitch.candidate();
                playback.audition(p, { kind: 'pattern', trackId: pendingPitch.tid, patternId: pendingPitch.pid, ignoreMute: true }, '移调方案 · 原稿保持不变');
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
            confirmAction('清空当前音乐块？', '同一音乐块在编排中的所有引用会一起更新。可以用撤销恢复。', () => mutate(() => { pattern().notes = []; S.selected = []; }));
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
            const tid=toolTrack().id;mutate(() => {G.pinPreset(project,id);project.tracks.find(t=>t.id===tid).preset=id;});preview(toolTrack(),defaultPitch(toolTrack()));
        }
        else if (action === 'custom-preset') {
            if (toolTrack().kind === 'drum') {
                toast('请先添加一条旋律轨，用它演奏自定义音源。');
                return;
            }
            mutate(() => toolTrack().preset = 'sample:' + id);
            preview(toolTrack(), 60);
        }
        else if (action === 'preview')
            preview(toolTrack(), defaultPitch(toolTrack()), .8);
        else if (action === 'bake-pipeline')
            confirmAction('把处理结果写回音符？', '将本轨所有音乐块的琶音、移调与轻微错拍变为实际音符，然后复位这些处理器。全曲 Swing 保持不变。', () => mutate(() => { const t = toolTrack(); t.patterns.forEach(p => {const status=G.harmonyStatus(p);p.notes = processPattern(p, t, { ...project, swing: 0 });G.bakeHarmony(p,Math.round(t.pipeline.transpose),status);}); t.pipeline = { transpose: 0, arp: 'off', rate: STEP, humanize: 0 }; }));
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
            confirmAction(action === 'new-project' ? '开始一张空白画板？' : '重新载入示例？', '当前作品会先保存，再打开新作品。可在“我的作品”中随时切回。', () => { loadProject(action === 'new-project' ? blankProject() : demoProject()).then(()=>{S.view='arrange';S.editorOpen=false;G.setEditTarget(S,project,{kind:'none'});render();}).catch(e=>toast(e.message)); });
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
            openModal(`第 ${bar + 1} 小节 · 放入音乐块`, `<div class="clip-choices">${t.patterns.map(p => button('place-pattern', p.name, 'grid', 'soft-btn', `data-track="${t.id}" data-pattern="${p.id}" data-bar="${bar}" ${canPlace(t, p, bar, project.bars) ? '' : 'disabled'}`)).join('')}${button('place-new-pattern', '新建空白音乐块', 'plus', 'dark-btn', `data-track="${t.id}" data-bar="${bar}"`)}</div><p class="modal-copy">已有音乐块放入后共享内容。需要分别修改时，选择色块并点击“独立副本”。</p>`);
        }
        else if (action === 'place-pattern' || action === 'place-new-pattern') {
            mutate(() => {
                const t = project.tracks.find(t => t.id === el.dataset.track), bar = +el.dataset.bar, p = action === 'place-new-pattern' ? newPattern('音乐块 ' + String.fromCharCode(65 + t.patterns.length % 26)) : t.patterns.find(p => p.id === el.dataset.pattern);
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
            else {
                const target={trackId:t.id,clipId:c.id};
                mutate(() => {
                    const t=project.tracks.find(t=>t.id===target.trackId),c=t?.clips.find(c=>c.id===target.clipId);
                    if(!c)throw Error('音乐块位置已不存在。');
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
        try{handleAction(target.dataset.action,target);}catch(error){toast(error.message);}
    });
    document.addEventListener('focusin',e=>{if(e.target.id==='gridframe'&&S.editTarget.kind!=='range'){G.activateNotes(S,project);refreshEditUI();}});
    document.addEventListener('dblclick', e => {
        const c = e.target.closest('[data-clip]');
        if (c) {
            S.clipId=c.dataset.clip;S.trackId=c.dataset.track;S.editorManuallyClosed=false;S.editorOpen=true;
            openPattern({trackId:c.dataset.track,clipId:c.dataset.clip,edit:true});
        }else{const blank=e.target.closest('.empty-bar');if(blank)handleAction('new-blank-clip',blank);}
    });
    function handleField(el) {
        if(el.dataset.field==='keymap-platform'){G.keymap.setPlatform(el.value);keyboardSettings();render();return;}
        if(el.dataset.field==='inspector-name'||el.dataset.field==='inspector-role'){
            const id=el.dataset.track;mutate(()=>{const t=project.tracks.find(t=>t.id===id);if(!t)throw Error('音轨已删除。');if(el.dataset.field==='inspector-name'){const v=el.value.trim();if(!v)throw Error('名称不能为空。');t.name=v.slice(0,60);}else t.role=el.value;});return;
        }
        if(el.dataset.field==='scale-display'){S.showScale=el.checked;render();return;}

        if(el.dataset.field==='reduce-motion'){G.appearance.set({motion:el.checked?'reduced':'normal'});return;}
        if(el.dataset.field==='reduce-transparency'){G.appearance.set({transparency:el.checked?'reduced':'normal'});return;}
        if (shelf.handleField(el) || creation.handleField(el) || composer.handleField(el) || materials.handleField(el))
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
        if(f==='active-track'){selectTrack(v);return;}
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
                toolTrack().pipeline.arp = v;
            if (f === 'arp-rate')
                toolTrack().pipeline.rate = +v;
            if (f === 'sample-root')
                project.assets[toolTrack().preset.slice(7)].root = +v;
            if (f === 'sample-mode')
                project.assets[toolTrack().preset.slice(7)].mode = v;
        });
    }
    document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-field="bpm"],[data-field="loop-from"],[data-field="loop-to"]')){e.preventDefault();handleField(e.target);e.target.blur();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!S.modal&&e.target.closest('#creation-dock')&&!interactions?.getDrag()){e.preventDefault();e.stopImmediatePropagation();creation.close();}},true);
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
        if(el.dataset.field==='shelf-search'){shelf.handleField(el);return;}
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
            readout.textContent = G.ui.format.parameter(group,key,v);
        const db = $(`[data-volume="${t.id}"]`);
        if (db && key === 'volume')
            db.textContent = (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '−∞') + ' dB';
    });
    const interactions = G.createEditorInteractions({ S, B, getProject: () => project, setProject: p => { project=p; },
        track, pattern, snapshot, markChanged, render, drawGrid, preview, selectedNotes, noteMenu, openPattern, toast,
        closeModal, togglePlay, undo, redo, handleAction, mutate, copyNotes, pasteNotes, deleteNotes,
        interact: () => { interacted=true; }, beginRange: () => { rangeBefore=snapshot(); },
        commitRange: () => { if (rangeBefore) { markChanged(rangeBefore,rangeMixOnly); rangeBefore=null; } },
        editorChanged:()=>playback.editorChanged(), seek: tick=>playback.seek(tick), setRange: range=>playback.setRange(range), seekPattern:tick=>{const c=track().clips.find(c=>c.id===S.clipId);playback.seek(tick+(['song','tracks'].includes(B.target)?(c?.bar||0)*BAR:0));}, clipCommand, runEdit, save:saveCurrent, pasteSystem, selectionChanged:refreshEditUI, zoom: zoomCanvas,
        hasForm: () => !!pendingForm, submitForm: () => pendingForm?.()
    });
    function updateTransport() {
        library?.reflectAudition();
        shelf?.reflectAudition();
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
        if (S.saveStatus === '正在保存…' || /失败|冲突/.test(S.saveStatus)) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    /** Small public API for automated testing and future integrations. */
    globalThis.GridToneApp = { version: '2.2.1', getProject: () => snapshot(), loadProject, getState: () => clone({ ...S, clipboard: !!S.clipboard, scope: B.target, loop: B.loop }), getPlayback: () => clone(B), getHistory: () => ({ undo: history.length, redo: future.length }), runEdit, saveCurrent, pasteSystem, openInspector, selectTrack, activateTarget:target=>{G.setEditTarget(S,project,target);render();}, transformSelection, materials, composer, creation, shelf, library, flushSave, openPattern, changeView, engine, playback, render };
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
            S.saveStatus = '本机存储不可用 · 请下载作品文件';
        }
        render();
    })();
})(globalThis.GridTone ||= {});
