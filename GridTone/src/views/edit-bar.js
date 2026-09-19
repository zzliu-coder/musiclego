/** The sole basic editing toolbar. Its target survives DOM focus changes. */
(function(G){G.views||={};
 G.views.renderEditBar=function({project,S,button,ib,esc}){
  if(S.view==='mix')return '';
  const a=G.resolveEditTarget(project,S),label=G.editTargetLabel(project,S),state=id=>G.editCommandState(project,S,id);
  const actions=['copy','cut','paste','duplicate','delete'].map(id=>{const d=state(id);return button('edit-command',d.label,d.icon,id==='delete'?'quiet delete-command':'quiet',`data-command="${id}" ${d.enabled?'':'disabled'} title="${esc(d.reason||d.label+' · '+d.shortcut)}" aria-label="${esc(d.label+' · '+label.title)}"`);}).join('');
  const hasPhrase=['notes','range'].includes(a.kind)||a.kind==='clips'&&a.ids.length===1;
  const changeLabel=hasPhrase?'生成 / 变化':a.kind==='track'?'音轨属性':'工具';
  let destination='';if(S.editClipboard){const type=S.editClipboard.kind;destination=type==='track'?'新增独立音轨':type==='clips'?G.editPositionLabel(S.arrangeCursor?.tick||0):['notes','range'].includes(a.kind)?G.editPositionLabel(a.kind==='range'?a.range.start:S.cursor||0):'请在画板指定落点';}
  return `<section class="edit-command-bar" id="edit-command-bar" role="toolbar" aria-label="统一编辑操作" data-edit-kind="${a.kind}"><div class="edit-target-label" aria-live="polite"><strong>${esc(label.title)}</strong><small>${esc(label.detail)}</small></div><div class="edit-primary-actions">${actions}${button('edit-command','全选','select','quiet',`data-command="select-all" ${state('select-all').enabled?'':'disabled'}`)}</div><div class="edit-secondary-actions">${a.kind==='clips'&&a.ids.length===1?button('edit-open','编辑','pencil','quiet'):''}${button('edit-tools',changeLabel,hasPhrase?'spark':'mix','quiet',a.kind==='none'?'disabled':'')}</div>${destination?`<span class="paste-destination" title="${esc(destination)}">粘贴 → ${esc(destination)}</span>`:''}</section>`;
 };
})(globalThis.GridTone||={});
