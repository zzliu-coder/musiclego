/** Platform key bindings are data. Commands and selection never depend on physical keys. */
(function(G){'use strict';
 const defaults=Object.freeze({copy:{key:'c',mod:true,label:'复制'},paste:{key:'v',mod:true,label:'粘贴'},cut:{key:'x',mod:true,label:'剪切'},undo:{key:'z',mod:true,label:'撤销'},redo:{key:'z',mod:true,shift:true,label:'重做'},'select-all':{key:'a',mod:true,label:'全选'},duplicate:{key:'d',mod:true,label:'复制一份'},save:{key:'s',mod:true,label:'保存到本机'},delete:{keys:['Backspace','Delete'],label:'删除选中内容'}});
 let preference='auto';try{preference=localStorage.getItem('legou.keymap.platform')||'auto';}catch{}
 const platform=()=>{if(['mac','windows'].includes(preference))return preference;return /Mac|iPhone|iPad/i.test(globalThis.navigator?.userAgentData?.platform||globalThis.navigator?.platform||'')?'mac':'windows';};
 const textTarget=target=>!!target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""],[role="textbox"]');
 function resolve(e,context={}){
  if(e.defaultPrevented||e.isComposing||e.keyCode===229||context.modal)return null;
  const current=context.platform||platform(),mod=current==='mac'?e.metaKey&&!e.ctrlKey:e.ctrlKey&&!e.metaKey;
  if(e.altKey)return null;
  if(mod&&!e.shiftKey&&String(e.key).toLowerCase()==='s')return 'save';
  if(textTarget(e.target)||context.text)return null;
  if(current==='windows'&&mod&&!e.shiftKey&&String(e.key).toLowerCase()==='y')return 'redo';
  for(const [id,b]of Object.entries(defaults)){
   if(id==='save')continue;
   if(b.mod?!mod:(e.ctrlKey||e.metaKey))continue;
   if(!!b.shift!==!!e.shiftKey)continue;
   if(b.keys?b.keys.includes(e.key):String(e.key).toLowerCase()===b.key)return id;
  }return null;
 }
 function label(id,plat=platform()){
  const b=defaults[id];if(!b)return '';
  if(id==='delete')return plat==='mac'?'⌫ / Fn ⌫':'Delete / Backspace';
  return (b.mod?(plat==='mac'?'⌘ ':'Ctrl + '):'')+(b.shift?(plat==='mac'?'⇧ ':'Shift + '):'')+b.key.toUpperCase();
 }
 function setPlatform(value){if(!['auto','mac','windows'].includes(value))throw Error('平台配置无效。');preference=value;try{localStorage.setItem('legou.keymap.platform',value);}catch{}return platform();}
 function parseClipboard(text){
  if(typeof text!=='string'||!text.startsWith('LEGOUCLIP/1\n'))return null;
  if(text.length>40*1024*1024)throw Error('剪贴板内容过大，请使用作品文件传递。');
  const value=JSON.parse(text.slice(12));G.assertDataTree(value);
  if(value?.version!==1||!['track','clips','notes','range'].includes(value.kind))throw Error('剪贴板格式无效。');
  if(['notes','range'].includes(value.kind)&&(!Array.isArray(value.notes)||value.notes.length>G.LIMITS.notes||!['drum','melodic'].includes(value.trackKind)||!Number.isFinite(value.span)||value.span<1||value.span>G.LIMITS.bars*G.BAR))throw Error('音符剪贴板内容无效。');
  if(value.kind==='clips'&&(!Array.isArray(value.tracks)||value.tracks.length>10000||!Number.isFinite(value.span)||value.span<1||value.span>G.LIMITS.bars))throw Error('音乐块剪贴板内容无效。');
  if(value.kind==='track'&&(!value.track||!Array.isArray(value.track.patterns)||!Array.isArray(value.track.clips)))throw Error('音轨剪贴板内容无效。');
  return G.clone(value);
 }
 let publishQueue=Promise.resolve();
 function publish(clipboard){const captured=G.clone(clipboard),job=publishQueue.catch(()=>{}).then(()=>writeClipboard(captured));publishQueue=job;return job;}
 async function writeClipboard(clipboard){
  if(!globalThis.navigator?.clipboard?.writeText)return {system:false};
  try{await navigator.clipboard.writeText('LEGOUCLIP/1\n'+JSON.stringify(clipboard));return {system:true};}catch{return {system:false};}
 }
 G.keymap={bindings:defaults,preference:()=>preference,platform,setPlatform,resolve,label,textTarget};G.parseMusicalClipboard=parseClipboard;G.publishMusicalClipboard=publish;
})(globalThis.GridTone ||= {});
