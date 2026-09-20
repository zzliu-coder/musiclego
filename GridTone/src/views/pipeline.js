/** View renderer. Receives the current document and session; never mutates either. */
(function (G) {
    'use strict';
    G.views ||= {};
    G.views.renderPipeline = function (C) {
        const { project, S, B, track, pattern, button, ib, icon, esc, miniPattern, slider, presetName, trackIcon, soundCards, waveIllustration, renderSound, renderPipeline } = C;
        const { KEYS, PRESETS, clamp, noteName, presetById, canPlace } = G;
        const t = track();
        return `<section class="pipeline-editor"><p class="scope-note">实时演奏处理 · 原始音符保留。</p><div class="pipeline-controls"><section><h3>琶音</h3><label class="field-row">方向<select data-field="arp" ${t.kind === 'drum' ? 'disabled' : ''}>${Object.entries({ off: '关闭', up: '向上', down: '向下', bounce: '往返' }).map(([v, l]) => `<option value="${v}" ${t.pipeline.arp === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="field-row">音符间隔<select data-field="arp-rate">${[[480, '八分'], [240, '十六分'], [120, '三十二分']].map(([v, l]) => `<option value="${v}" ${t.pipeline.rate === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p>处理同时开始、同样长度的和弦。</p></section><section><h3>本轨移调与错拍</h3>${t.kind === 'drum' ? '<p>鼓轨保留鼓件编号，不应用移调。</p>' : slider('实时移调', 'pipeline', 'transpose', t.pipeline.transpose, -24, 24, 1, t.pipeline.transpose + ' 半音')}${slider('轻微错拍', 'pipeline', 'humanize', t.pipeline.humanize, 0, 60, 1, t.pipeline.humanize + ' ticks')}</section></div><details><summary>处理顺序与写入音符</summary><p>原始音符 → 琶音 → 移调与律动 → 本轨乐器 → 混音。</p><p>展开会写入本轨全部音乐块，试听与导出使用同一结果，可撤销。</p>${button('bake-pipeline', '展开为音符', 'check', 'soft-btn')}</details></section>`;
    };
})(globalThis.GridTone ||= {});
