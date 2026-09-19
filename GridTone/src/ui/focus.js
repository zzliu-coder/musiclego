/** Focus survives deterministic view renders and modal navigation. No song state here. */
(function (G) {
  'use strict';
  const esc = CSS.escape;
  function selectorFor(el) {
    if (!el?.matches?.('button,input,select,textarea,a,summary,[tabindex]')) return null;
    if (el.id) return '#' + esc(el.id);
    let selector = el.tagName.toLowerCase();
    for (const name of ['data-batch-field','data-index','data-collection','data-family','data-kind','data-library-field','data-filter','data-command','data-action','data-field','data-range','data-id','data-track','data-tab','data-group','data-view','data-tool','data-page','data-category','data-clip','aria-label']) {
      if (el.hasAttribute(name)) selector += `[${name}="${esc(el.getAttribute(name))}"]`;
    }
    for (const parent of ['.modal','.properties-sidebar','.top-actions','.editor-breadcrumb','.editor-subtabs','.view-tabs','.arrange-bottom','.selection-bar']) {
      if (el.closest(parent)) return parent + ' ' + selector;
    }
    return selector;
  }
  function captureFocus() {
    const el=document.activeElement, selector=selectorFor(el);
    if (!selector) return null;
    return {el,selector,index:[...document.querySelectorAll(selector)].indexOf(el),start:el.selectionStart,end:el.selectionEnd};
  }
  function restoreFocus(token) {
    if (!token) return false;
    const el=token.el?.isConnected ? token.el : [...document.querySelectorAll(token.selector)][Math.max(0,token.index)];
    if (!el || el.disabled || el.closest('[inert]')) return false;
    el.focus({preventScroll:true});
    if (typeof token.start==='number' && el.setSelectionRange) {
      try { el.setSelectionRange(token.start,token.end); } catch { /* Non-text inputs have no text selection. */ }
    }
    return true;
  }
  let returnFocus=null;
  const modal = {
    open(title,body,subtitle='') {
      const overlay=document.querySelector('#overlay');
      if (!overlay.children.length) returnFocus=captureFocus();
      const focus=overlay.children.length?captureFocus():null;
      overlay.innerHTML=G.ui.Dialog({title,body,subtitle});
      document.querySelector('#app').inert=true;if(document.querySelector('#studio-library'))document.querySelector('#studio-library').inert=true;
      const node=overlay.querySelector('#form-value,[autofocus]') || overlay.querySelector('#modal-title');
      requestAnimationFrame(()=>{if(!restoreFocus(focus)&&node?.isConnected)node.focus({preventScroll:true});});
    },
    close() {
      document.querySelector('#overlay').replaceChildren();
      document.querySelector('#app').inert=false;if(document.querySelector('#studio-library'))document.querySelector('#studio-library').inert=false;
      restoreFocus(returnFocus);returnFocus=null;
    },
    keydown(e) {
      if(e.key!=='Tab') return;
      const els=[...document.querySelectorAll('.modal button:not([disabled]),.modal input:not([disabled]),.modal select:not([disabled]),.modal a[href],.modal [tabindex="0"]')].filter(x=>x.getClientRects().length);
      const first=els[0],last=els.at(-1),at=document.activeElement;
      if (!els.includes(at)) { (e.shiftKey?last:first)?.focus();e.preventDefault(); }
      else if(e.shiftKey&&at===first){last?.focus();e.preventDefault();}
      else if(!e.shiftKey&&at===last){first?.focus();e.preventDefault();}
    }
  };
  Object.assign(G.ui,{captureFocus,restoreFocus,modal});
})(globalThis.GridTone ||= {});
