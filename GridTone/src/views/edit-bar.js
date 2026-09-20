/** The sole basic editing toolbar. Its target survives DOM focus changes. */
(function(G){G.views||={};
 G.views.renderEditBar=function({project,S,button,ib,esc}){
  if(S.view==='mix')return '';
  const a=G.resolveEditTarget(project,S),label=G.editTargetLabel(project,S),state=id=>G.editCommandState(project,S,id);
  const compact=S.view==='arrange';
  let destination='';if(S.editClipboard){const type=S.editClipboard.kind;destination=type==='track'?'新增独立音轨':type==='clips'?G.editPositionLabel(S.arrangeCursor?.tick||0):['notes','range'].includes(a.kind)?G.editPositionLabel(a.kind==='range'?a.range.start:S.cursor||0):'请在画板指定落点';}
  const actions=['copy','cut','paste','duplicate','delete'].map(id=>{const d=state(id);return button('edit-command',d.label,d.icon,id==='delete'?'quiet small-btn delete-command':'quiet small-btn',`data-command="${id}" ${d.enabled?'':'disabled'} title="${esc((d.reason||d.label+' · '+d.shortcut)+(id==='paste'&&destination?' · 粘贴 → '+destination:''))}" aria-label="${esc(d.label+' · '+label.title)}"`);}).join('');
  const hasPhrase=['notes','range'].includes(a.kind)||a.kind==='clips'&&a.ids.length===1;
  const changeLabel=hasPhrase?'生成 / 变化':a.kind==='track'?'音轨属性':'工具';

  if(compact){
   const title=a.kind==='notes'&&!a.ids.length?'音符 · 未选中':a.kind==='none'?'尚未选择':a.kind==='track'?'音轨':a.kind==='range'?'时间选区':label.title;
   const detail=a.kind==='none'?'点选音乐块或音符':a.kind==='track'?a.track.name:label.detail;
   const pasteHint=destination?`<small class="paste-destination">粘贴 → ${esc(destination)}</small>`:'';
   const target=`<details class="edit-scope" data-component="target-module"><summary aria-label="当前编辑对象：${esc(title+' · '+detail)}" title="${esc(label.title+' · '+detail)}"><span class="edit-target-label" aria-live="polite"><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${G.ui.icon('down',12)}</summary><div class="edit-scope-detail"><strong>${esc(label.title)}</strong><span>${esc(detail)}</span>${pasteHint}<small>编辑命令作用于当前对象。</small>${a.kind==='clips'&&a.ids.length===1?button('edit-open','编辑选中的音乐块','pencil','quiet small-btn'):''}</div></details>`;
   const contextActions=`${button('edit-tools',hasPhrase?'生成':changeLabel,hasPhrase?'spark':'mix','quiet small-btn',`title="${esc(changeLabel+' · '+label.title)}" aria-label="${esc(changeLabel)}" ${a.kind==='none'?'disabled':''}`)}`;
   return `<section class="edit-command-bar unified-edit" id="edit-command-bar" role="toolbar" aria-label="统一编辑操作" data-density="compact" data-edit-kind="${a.kind}">${target}<div class="edit-primary-actions" role="group" aria-label="基础编辑">${actions}${button('edit-command','全选','select','quiet small-btn',`data-command="select-all" ${state('select-all').enabled?'':'disabled'}`)}</div><div class="edit-secondary-actions">${contextActions}</div></section>`;
  }
  return `<section class="edit-command-bar" id="edit-command-bar" role="toolbar" aria-label="统一编辑操作" data-edit-kind="${a.kind}"><div class="edit-target-module" data-component="target-module" role="group" aria-label="当前编辑对象"><div class="edit-target-label" aria-live="polite"><strong>${esc(label.title)}</strong><small>${esc(label.detail)}</small></div><div class="edit-secondary-actions">${a.kind==='clips'&&a.ids.length===1?button('edit-open','编辑','pencil','quiet small-btn'):''}${button('edit-tools',changeLabel,hasPhrase?'spark':'mix','quiet small-btn',a.kind==='none'?'disabled':'')}</div></div><div class="edit-primary-actions action-tray" data-component="action-tray" role="group" aria-label="基础编辑">${actions}${button('edit-command','全选','select','quiet small-btn',`data-command="select-all" ${state('select-all').enabled?'':'disabled'}`)}</div>${destination?`<span class="paste-destination" title="${esc(destination)}">粘贴 → ${esc(destination)}</span>`:''}</section>`;
 };
})(globalThis.GridTone||={});
