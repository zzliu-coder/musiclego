/** Keyed rendering shared by production views. */
(function(G){
 // Keyed DOM reconciliation keeps scroll containers, capture targets and focus alive.
 G.patchDOM=function(parent,markup){
  const tpl=document.createElement('template');tpl.innerHTML=markup;
  const key=n=>n.nodeType===1?(n.id?'id:'+n.id:n.hasAttribute('data-note')?'note:'+n.getAttribute('data-note'):n.hasAttribute('data-clip')?'clip:'+n.getAttribute('data-clip'):n.hasAttribute('data-row-key')?'row:'+n.getAttribute('data-row-key'):null):null;
  function sync(a,b){
   if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){const fresh=b.cloneNode(true);a.replaceWith(fresh);return fresh;}
   if(a.nodeType!==1){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return a;}
   for(const attr of [...a.attributes])if(!b.hasAttribute(attr.name))a.removeAttribute(attr.name);
   for(const attr of [...b.attributes])if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);
   if(a instanceof HTMLInputElement){if(document.activeElement!==a)a.value=b.value;a.checked=b.checked;}
   if(a.id!=='grid-inner')children(a,b);
   if(a instanceof HTMLSelectElement&&document.activeElement!==a)a.value=b.value;return a;
  }
  function children(a,b){
   const keyed=new Map([...a.childNodes].map(n=>[key(n),n]).filter(([k])=>k));let cursor=a.firstChild;
   for(const desired of [...b.childNodes]){
    const k=key(desired);let node=k?keyed.get(k):cursor&&!key(cursor)?cursor:null;
    if(!node){node=desired.cloneNode(true);a.insertBefore(node,cursor);}
    else {if(node!==cursor)a.insertBefore(node,cursor);node=sync(node,desired);}
    cursor=node.nextSibling;
   }
   while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
  }
  children(parent,tpl.content);
 };
})(globalThis.GridTone ||= {});
