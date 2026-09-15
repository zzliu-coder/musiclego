/** Catalog workflow. Candidate projects are disposable; Apply is a single document command. */
(function (G) {
    'use strict';
    class CatalogUI {
        constructor(context) { this.c = context; this.category = 'templates'; this.selected = null; this.options = null; this.role='all'; this.search=''; }
        roleOf(x){return x.role || (x.type==='song'?'song':x.kind==='drum'?'drums':x.id.includes('chord')?'chords':x.id.includes('bass')?'bass':'melody');}
        items(){const p=this.c.getProject(),all=this.category==='templates'?G.catalogContents().templates:this.category==='drumkits'?G.projectKits(p):G.projectPresets(p);const q=this.search.trim().toLowerCase();return all.filter(x=>(this.category!=='templates'||this.role==='all'||this.roleOf(x)===this.role)&&(!q||[x.name,x.description,x.category,...(x.tags||[])].join(' ').toLowerCase().includes(q)));}
        cards(){const esc=this.c.esc,category=this.category,roleNames={drums:'鼓点',melody:'旋律',bass:'贝斯',chords:'和弦',song:'整曲起点'};return this.items().map(x=>{
            const type=category==='templates'?(x.type==='song'?'整曲起点 · '+x.project.bars+' 小节':roleNames[this.roleOf(x)]+' · '+x.bars+' 小节') : category==='drumkits'?x.rows.length+' 个鼓件':x.category+' · '+(G.soundEngineLabel?.(x)||x.engine);
            let drawing='';if(x.notes?.length){const lo=Math.min(...x.notes.map(n=>n.pitch)),hi=Math.max(lo+6,...x.notes.map(n=>n.pitch));drawing=`<svg class="template-notation" viewBox="0 0 260 34" aria-hidden="true">${x.notes.slice(0,220).map(n=>`<rect x="${n.start/(x.bars*G.BAR)*260}" y="${28-(n.pitch-lo)/(hi-lo)*25}" width="${Math.max(2,n.duration/(x.bars*G.BAR)*260-1)}" height="2.5" rx="1.2" fill="currentColor"/>`).join('')}</svg>`;}
            return `<button class="catalog-card" data-action="catalog-select" data-kind="${category}" data-id="${esc(x.id)}"><small>${esc(type)}${x.bpm?' · '+x.bpm+' BPM':''}</small><strong>${esc(x.name)}</strong>${drawing}<p>${esc(x.description||'可配置的乐器与鼓件集合。')}</p><span>预听与使用 →</span></button>`;
        }).join('')||'<p class="catalog-empty">没有匹配的素材，换一个关键词试试。</p>';}
        updateCards(){const node=document.querySelector('#catalog-cards');if(node)node.innerHTML=this.cards();const count=document.querySelector('#catalog-count');if(count)count.textContent=this.items().length+' 项';}
        listing(category = this.category) {
            this.category = category;this.selected = null;this.c.playback.endAudition();
            const { button, esc, openModal } = this.c, items = G.catalogContents();
            openModal('模板与素材', `<div class="catalog-top"><nav class="catalog-tabs">${[['templates', '音乐模板'], ['presets', '音色预设'], ['drumkits', '鼓组']].map(([k, n]) => button('catalog-tab', n, '', this.category === k ? 'active' : 'quiet', `data-category="${k}" aria-pressed="${this.category===k}"`)).join('')}</nav>${button('import-catalog', '导入素材包', 'upload', 'soft-btn')}</div><p class="modal-copy">先听，再应用。内容会展开为普通音符；预听保持当前作品不变。</p>${category==='templates'?`<nav class="catalog-role-tabs" aria-label="模板角色">${[['all','全部'],['song','整曲起点'],['drums','鼓点'],['chords','和弦'],['melody','旋律'],['bass','贝斯']].map(([id,l])=>button('catalog-role',l,'',this.role===id?'active':'quiet',`data-role="${id}" aria-pressed="${this.role===id}"`)).join('')}</nav>`:''}<div class="catalog-filter-line"><input type="search" data-field="catalog-search" aria-label="搜索素材" placeholder="搜索名称、风格或用途" value="${esc(this.search)}"><small id="catalog-count">${this.items().length} 项</small></div><div class="catalog-grid" id="catalog-cards">${this.cards()}</div><div class="catalog-footer"><span>已导入 ${items.packs.length} 个素材包</span>${button('example-catalog', '示例素材包', 'download', 'quiet')}${items.packs.length ? button('export-catalog', '备份素材库', 'save', 'quiet') : ''}</div>`);
        }
        select(kind, id) {
            if (kind === 'templates') {
                const t = G.getTemplate(id), p = this.c.getProject(), s = this.c.getSession(), track = p.tracks.find(t => t.id === s.trackId), mode = t.type === 'pattern' && track.kind === t.kind ? 'new' : 'new-track';
                this.selected = t;
                this.options = { mode, trackId: track.id, patternId: s.patternId, bar: 0, adapt: 'original', applySound: mode === 'new-track' };
                if (t.type === 'pattern' && mode === 'new') {
                    const free = G.firstFreeBar(track, t, p.bars);
                    this.options.bar = free < 0 ? p.bars : free;
                }
                this.detail();
                return;
            }
            const p = this.c.getProject(), s = this.c.getSession(), track = p.tracks.find(t => t.id === s.trackId), { button, esc, openModal } = this.c;
            const object = kind === 'drumkits' ? G.resolveKit(id, p) : G.resolvePreset(id, p);
            if (!object || object.missing)
                throw Error('素材不可用。');
            this.selected = { type: 'resource', kind, id, name: object.name };
            this.options = { trackId: track.id };
            const needsDrum = kind === 'drumkits' || object.engine === 'drum', allowed = p.tracks.filter(t => (t.kind === 'drum') === needsDrum);
            this.options.trackId = allowed.some(t => t.id === track.id) ? track.id : allowed[0]?.id || 'new-track';
            openModal('使用' + (kind === 'drumkits' ? '鼓组' : '音色'), `<h3>${esc(object.name)}</h3><p class="modal-copy">影响所选音轨全部片段。新音轨会附带一个可编辑的试听片段。</p><label class="form-label">目标音轨<select data-field="catalog-track">${allowed.map(t => `<option value="${t.id}" ${t.id === this.options.trackId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="new-track" ${this.options.trackId === 'new-track' ? 'selected' : ''}>新增音轨</option></select></label><div class="modal-actions">${button('catalog-back', '返回素材库', '', 'quiet')}${button('catalog-preview', '预听结果', 'headphones', 'soft-btn')}${button('catalog-apply', '确认使用', 'check', 'dark-btn')}</div>`);
        }
        detail() {
            const t = this.selected, { button, esc, openModal } = this.c, p = this.c.getProject(), o = this.options;
            const song = t.type === 'song', tracks = p.tracks.filter(tr => tr.kind === t.kind), target = tracks.find(tr => tr.id === o.trackId);
            const pat = target?.patterns.find(p => p.id === o.patternId), refs = target?.clips.filter(c => c.patternId === o.patternId).length || 0;
            openModal(t.name, `<p class="modal-copy">${esc(t.description)}</p><div class="template-summary"><span>${song ? '完整曲目 · ' + t.project.tracks.length + ' 轨 / ' + t.project.bars + ' 小节' : (t.kind === 'drum' ? '鼓点' : '音符') + '模板 · ' + t.bars + ' 小节'}</span><span>${song ? '速度 ' + t.project.bpm + ' BPM' : G.KEYS[t.key] + ' · ' + ({ major: '大调', minor: '小调', pentatonic: '五声音阶', chromatic: '半音阶' }[t.scale])}</span></div>
   ${song ? '<p class="resource-warning">确认使用将替换当前整首作品。可以撤销恢复；重要作品请先下载工程。预听保持当前工程不变。</p>' : `<div class="form-grid"><label class="form-label">应用方式<select data-field="catalog-mode">${[['new', '新增独立片段'], ['replace', '替换当前片段的内容'], ['new-track', '新增音轨和片段']].map(([v, l]) => `<option value="${v}" ${o.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${o.mode !== 'new-track' ? `<label class="form-label">目标音轨<select data-field="catalog-track">${tracks.map(tr => `<option value="${tr.id}" ${tr.id === o.trackId ? 'selected' : ''}>${esc(tr.name)}</option>`).join('')}</select></label>` : ''}
   ${o.mode === 'replace' ? `<label class="form-label">替换片段<select data-field="catalog-pattern">${(target?.patterns || []).map(pat => `<option value="${pat.id}" ${pat.id === o.patternId ? 'selected' : ''}>${esc(pat.name)} · ${pat.bars} 小节</option>`).join('')}</select></label>` : `<label class="form-label">插入第几小节<input type="number" data-field="catalog-bar" min="1" max="256" step="1" value="${o.bar + 1}"></label>`}
   ${t.kind === 'melodic' ? `<label class="form-label">音高处理<select data-field="catalog-adapt">${[['original', '保持模板原调'], ['key', '整体移到当前参考主音'], ['adapt', '按级数适配当前调式']].map(([v, l]) => `<option value="${v}" ${o.adapt === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}</div>
   ${o.mode !== 'new-track' ? `<label class="catalog-check"><input type="checkbox" data-field="catalog-sound" ${o.applySound ? 'checked' : ''}> 同时换成本模板建议的音色${t.kind === 'drum' ? '与鼓组' : ''}（影响本轨全部片段）</label>` : ''}
   ${o.mode === 'replace' ? `<p class="resource-warning">将替换 ${esc(pat?.name || '所选片段')}；${refs} 处共享引用同步变化。较短模板会重复填满现有片段。所有修改可以一次撤销。</p>` : '<p class="modal-copy">新增片段拥有独立编号，后续修改不会影响原素材。遇到已占用位置会阻止应用。</p>'}`}
   <p id="catalog-feedback" class="resource-feedback" role="status"></p><div class="modal-actions">${button('catalog-back', '返回素材库', '', 'quiet')}${button('catalog-preview', '预听结果', 'headphones', 'soft-btn')}${button('stop', '停止试听', 'stop', 'quiet')}${button('catalog-apply', song ? '确认替换作品' : '确认应用', 'check', 'dark-btn')}</div>`);
        }
        candidate() {
            const t = this.selected, p = this.c.getProject();
            if (!t)
                throw Error('请选择素材。');
            if (t.type !== 'resource')
                return G.applyTemplate(p, t, this.options);
            const q = G.clone(p), resource = t.kind === 'drumkits' ? G.resolveKit(t.id, q) : G.resolvePreset(t.id, q), kind = t.kind === 'drumkits' || resource.engine === 'drum' ? 'drum' : 'melodic';
            let tr = q.tracks.find(t => t.id === this.options.trackId);
            if (this.options.trackId === 'new-track') {
                if (q.tracks.length >= 64)
                    throw Error('音轨达到上限。');
                tr = G.newTrack(kind, q.tracks.length);
                tr.name = resource.name;
                q.tracks.push(tr);
                tr.patterns[0].notes = kind === 'drum' ? G.DRUMS.slice(0, 3).map((d, i) => G.newNote(d.pitch, i * 960, 240, .7)) : [60, 64, 67].map((p, i) => G.newNote(p, i * 960, 720, .65));
            }
            if (!tr || tr.kind !== kind)
                throw Error('请选择正确类型的音轨。');
            if (t.kind === 'drumkits') {
                G.pinKit(q, t.id);
                tr.drumkitId = t.id;
                if (this.options.trackId === 'new-track')
                    tr.patterns[0].notes = resource.rows.slice(0, 4).map((row, i) => G.newNote(row.pitch, i * 960, 240, .7));
            }
            else {
                G.pinPreset(q, t.id);
                tr.preset = t.id;
            }
            const s = this.c.getSession(), pat = tr.patterns.find(p => p.id === s.patternId) || tr.patterns[0];
            G.assertPlayable(q, [tr.id]);
            return { project: G.validateProject(q), trackId: tr.id, patternId: pat.id, clipId: tr.clips.find(c => c.patternId === pat.id)?.id || null };
        }
        async preview() { try {
            const result = this.candidate(), scope = this.selected.type === 'song' ? { kind: 'song', soloIds: [] } : { kind: 'pattern', trackId: result.trackId, patternId: result.patternId, ignoreMute: true };
            const started=await this.c.playback.audition(result.project, scope, '素材预听 · ' + this.selected.name);
            if(started)this.feedback('正在预听候选，当前工程保持不变。');
        }
        catch (e) {
            this.feedback(e.message);
        } }
        apply() { try {
            const result = this.candidate();
            this.c.closeModal();
            this.c.commit(result);
            this.c.toast('已应用，内容可以继续编辑；可用撤销恢复。');
        }
        catch (e) {
            this.feedback(e.message);
        } }
        feedback(message) { const el = document.querySelector('#catalog-feedback'); if (el)
            el.textContent = message; this.c.toast(message); }
        handleField(el) {
            if (el.dataset.field==='catalog-search'){this.search=el.value;this.updateCards();return true;}
            if (!el.dataset.field?.startsWith('catalog-'))
                return false;
            this.c.playback.endAudition();
            const key = el.dataset.field.slice(8), o = this.options;
            if (!o)
                return true;
            if (key === 'mode') {
                o.mode = el.value;
                if (o.mode === 'new-track') {
                    o.bar = 0;
                    o.applySound = true;
                }
            }
            if (key === 'track') {
                o.trackId = el.value;
                const t = this.c.getProject().tracks.find(t => t.id === el.value);
                if (t)
                    o.patternId = t.patterns[0].id;
            }
            if (key === 'pattern')
                o.patternId = el.value;
            if (key === 'bar')
                o.bar = Number(el.value) - 1;
            if (key === 'adapt')
                o.adapt = el.value;
            if (key === 'sound')
                o.applySound = el.checked;
            if (this.selected?.type === 'pattern' && ['mode', 'track', 'pattern'].includes(key))
                this.detail();
            return true;
        }
        async importFile(file) {
            try {
                if (file.size > 40 * 1024 * 1024)
                    throw Error('素材包文件上限 40 MB。');
                const raw = JSON.parse(await file.text());
                const result = G.installCatalog(raw);
                const saved = this.c.getProject();
                this.c.repin();
                let persistent = true;
                try {
                    await G.saveCatalogPacks(G.catalogContents().packs);
                }
                catch {
                    persistent = false;
                }
                this.listing();
                this.c.render();
                const message = result.duplicate ? '相同素材包已经存在。' : `已导入 ${result.pack.name}：${result.pack.templates.length} 模板、${result.pack.presets.length} 音色、${result.pack.drumkits.length} 鼓组。`;
                this.c.toast(message + (persistent ? '' : ' 本机素材库存储不可用，请保存原素材包；已使用的声音会随工程保存。'));
            }
            catch (e) {
                this.c.toast('没有导入：' + e.message);
            }
        }
        handleAction(action, el) {
            if(action==='catalog-role'){this.role=el.dataset.role;this.listing();return true;}
            if(action==='catalog'){this.role=el?.dataset.role||'all';this.search='';this.listing('templates');return true;}
            try {
                if (action === 'catalog-tab') {
                    this.listing(el.dataset.category);
                    return true;
                }
                if (action === 'catalog-select') {
                    this.select(el.dataset.kind, el.dataset.id);
                    return true;
                }
                if (action === 'catalog-back') {
                    this.listing();
                    return true;
                }
                if (action === 'catalog-preview') {
                    this.preview();
                    return true;
                }
                if (action === 'catalog-apply') {
                    this.apply();
                    return true;
                }
                if (action === 'import-catalog') {
                    this.c.pickFile('.gridtonepack,.json,application/json', f => this.importFile(f));
                    return true;
                }
                if (action === 'example-catalog') {
                    G.downloadBlob(new Blob([JSON.stringify(G.EXAMPLE_CATALOG, null, 2)], { type: 'application/json' }), '声格_示例素材包.gridtonepack');
                    return true;
                }
                if (action === 'export-catalog') {
                    const packs = G.catalogContents().packs;
                    const combined = { format: 'gridtone.catalog', version: 1, id: 'backup.' + Date.now(), name: '我的素材库备份', presets: [], drumkits: [], templates: [], assets: {} };
                    for (const k of ['presets', 'drumkits', 'templates'])
                        combined[k] = [...new Map(packs.flatMap(p => p[k]).map(x => [x.id, x])).values()];
                    for (const p of packs)
                        Object.assign(combined.assets, p.assets);
                    G.downloadBlob(new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' }), '声格_素材库备份.gridtonepack');
                    return true;
                }
            }
            catch (e) {
                this.c.toast(e.message);
                return true;
            }
            return false;
        }
    }
    G.CatalogUI = CatalogUI;
})(globalThis.GridTone ||= {});
