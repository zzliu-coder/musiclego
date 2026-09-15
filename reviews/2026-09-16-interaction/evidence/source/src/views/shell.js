/** Global chrome + workspaces. Rendering has no document mutations. */
(function (G) {
 G.views ||= {};
 G.views.renderShell = function (C) {
 const { project,S,B,engine,history,future,track,pattern,button,ib,icon,esc,renderEditor,renderArrange,renderMix,scrollKey }=C;
 const t=track(),p=pattern();
        const scopeOptions = [['song', '全曲'], ...(S.view === 'edit' ? [['pattern', `本片段 · ${p.bars} 小节`], ['bar', '当前小节']] : []), ['tracks', `所选音轨 · ${B.selectedTrackIds.length} 轨`]];
        return `<div class="app-shell studio-v12 ${S.sidebar ? 'sidebar-open' : ''}">
  <main class="main">
    <header class="topbar"><div class="breadcrumbs"><a class="compact-brand" href="#" data-action="home"><span class="brand-mark"><i></i><i></i><i></i><i></i></span><b>声格</b><small>GRIDTONE</small></a><span class="slash">/</span><button class="project-name" data-action="rename-song">${esc(project.title)}</button><span class="save-status"></span></div>
    <div class="top-actions">${button('project-menu', '工程', 'folder', 'quiet')}${ib('undo', '撤销 · Ctrl / ⌘ Z', 'undo', history.length ? '' : 'disabled')}${ib('redo', '重做 · Ctrl / ⌘ Shift Z', 'redo', future.length ? '' : 'disabled')}${button('appearance', '外观', 'spark', 'quiet appearance-btn')}${ib('help', '使用帮助', 'help')}${button('export', '导出', 'download', 'dark-btn')}</div></header>
    <section class="transport" aria-label="播放控制">
      <div class="transport-controls">${button('play', '', engine.playing ? 'pause' : 'play', 'play-btn', `aria-label="${engine.playing ? '暂停' : '播放'}" title="空格：播放 / 暂停"`)}${ib('stop', '停止全部声音', 'stop')}${button('loop', '', 'loop', `icon-btn ${B.loop ? 'on' : ''}`, `title="循环" aria-label="循环播放" aria-pressed="${B.loop}"`)}</div>
      <div class="transport-field target-field"><label for="play-target">试听范围</label><select id="play-target" data-field="scope" aria-label="试听范围">${scopeOptions.map(([v, l]) => `<option value="${v}" ${B.target === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="transport-field bpm-field"><label for="bpm">速度</label><div><input id="bpm" type="number" min="40" max="240" value="${project.bpm}" data-field="bpm" aria-label="速度 BPM"><span>BPM</span></div></div>
      <div class="transport-field meter-field"><label>拍号 / 网格</label><div><strong>4 / 4</strong><span>1/16</span></div></div>
      <div class="transport-right"><div class="clock"><strong id="position">001<span> : 01 : 01</span></strong><small id="playback-label">${esc(G.playbackLabel(project, S, B))}</small></div><canvas id="master-meter" width="76" height="30" aria-label="实时音频电平"></canvas></div>
    </section>
    <nav class="view-tabs" aria-label="主工作区">${[['arrange', '编排', 'arrange'], ['mix', '混音', 'mix']].map(([id, label, ic]) => button('view', label, ic, (id === 'arrange' ? S.view !== 'mix' : S.view === 'mix') ? 'active' : '', `data-view="${id}"`)).join('')}
      <div class="workspace-actions">${button('catalog', '模板与素材', 'folder', 'quiet')}${button('toggle-sidebar', S.sidebar ? '收起属性' : '音轨属性', 'menu', `quiet ${S.sidebar ? 'on' : ''}`, `aria-label="音轨属性" aria-expanded="${S.sidebar}"`)}</div></nav>
    ${G.missingResources(project).length ? `<div class="missing-banner" role="status"><strong>需要补齐声音</strong><span>${esc(G.missingResources(project).slice(0, 3).map(x => x.message).join("；"))}</span>${button("import-catalog", "导入素材包", "upload", "quiet")}${button("open-sound", "选择替代音色", "wave", "quiet")}</div>` : ""}
    <div class="workspace-body"><div class="view-content" data-scrollkey="${esc(scrollKey)}" data-workspace="${S.view}">${S.view === 'edit' ? renderEditor() : S.view === 'arrange' ? renderArrange() : renderMix()}</div>
      ${S.sidebar ? `<div class="sidebar-backdrop" data-action="dismiss-sidebar" aria-hidden="true"></div>` + G.views.renderProperties(C) : ''}
    </div><footer class="statusbar"><span id="storage-status" role="status" aria-live="polite"></span><span id="runtime-status"></span><span>4/4 · 960 PPQ</span></footer>
  </main></div>`;

 };
})(globalThis.GridTone ||= {});
