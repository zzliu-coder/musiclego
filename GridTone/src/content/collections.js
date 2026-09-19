/** One durable browsing collection store. Never writes the musical document.
 * First run merges both historical stores; later removals are never resurrected.
 */
(function(G){'use strict';
 const KEY='legou.library.collections.v1';
 const ids=list=>[...new Set((Array.isArray(list)?list:[]).filter(x=>typeof x==='string'&&x.length>0&&x.length<200))];
 const read=(storage,key)=>{try{const v=JSON.parse(storage?.getItem(key)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}};
 class LibraryCollections{
  constructor(storage,legacy={}){this.storage=storage;this.error='';const current=read(storage,KEY),shelf=read(storage,'legou.catalog.preferences')||legacy.shelf||{},library=read(storage,'legou.library.preferences')||legacy.library||{};
   this.value=current?.version===1?{version:1,favorites:ids(current.favorites),recent:ids(current.recent),tray:ids(current.tray)}:{version:1,favorites:ids([...ids(library.favorites),...ids(shelf.favorites)]),recent:ids([...ids(library.recent),...ids(shelf.recent)]),tray:ids(shelf.tray??library.tray??G.studioDefaults?.()??[])};
   this.persist();
  }
  get favorites(){return this.value.favorites;}get recent(){return this.value.recent;}get tray(){return this.value.tray;}
  persist(){try{if(!this.storage?.setItem)throw Error('unavailable');this.storage.setItem(KEY,JSON.stringify(this.value));this.error='';}catch{this.error='本次整理仅保留在当前窗口，本机偏好保存未成功。';}return !this.error;}
  favorite(id){if(this.favorites.includes(id))this.value.favorites=this.favorites.filter(x=>x!==id);else this.value.favorites=ids([id,...this.favorites]);this.persist();}
  pin(id,on=true){this.value.tray=on?ids([...this.tray,id]):this.tray.filter(x=>x!==id);this.persist();}
  touch(id){this.value.recent=ids([id,...this.recent]).slice(0,100);this.persist();}
  clearTray(){this.value.tray=[];this.persist();}
 }
 function usedMaterialIds(project){
  const out=new Set(),index=new Map();
  // Legacy pieces may have no source tag. Exact musical matches recover discoverability,
  // while edited/unknown pieces never acquire a guessed attribution.
  for(const x of G.catalogTemplates?.()||[]){if(x.type!=='pattern'||!x.notes?.length)continue;const k=x.kind+':'+G.musicHash(x);if(!index.has(k))index.set(k,[]);index.get(k).push(x.id);}
  for(const t of project.tracks){out.add(t.preset);if(t.drumkitId)out.add(t.drumkitId);const placed=new Set(t.clips.map(c=>c.patternId));for(const p of t.patterns){if(!placed.has(p.id))continue;
   for(const id of [p.material?.id,...(p.materialIds||[]),...(p.attributions||[]).map(x=>x.id),p.harmony?.source?.recipeId])if(id)out.add(id);
   for(const id of index.get(t.kind+':'+G.musicHash(p))||[])out.add(id);
  }}return out;
 }
 Object.assign(G,{LibraryCollections,usedMaterialIds});
})(globalThis.GridTone||={});
