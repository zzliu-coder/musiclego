/* Runs in a real browser against production modules. No user DB is opened. */
document.querySelector('#run').onclick=async()=>{
 const G=GridTone,results=[],repos=[],names=[],assert=(v,message)=>{if(!v)throw Error(message);};
 const check=async(name,fn)=>{await fn();results.push({name,status:'PASS'});document.querySelector('#result').textContent=JSON.stringify(results,null,2);};
 const request=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 const done=tx=>new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(tx.error);});
 const name=()=>{const n='review-test-'+crypto.randomUUID();names.push(n);return n;};
 const repo=n=>{const r=new G.ProjectRepository(n||name());repos.push(r);return r;};
 const clock=Date.now,originals={};let now=1800000000000;
 try{
  await check('SVG: initial / transformed / undo / redo order and stable keyed nodes',()=>{
   const el=document.querySelector('#notes'),html=order=>order.map((id,i)=>`<g data-note="${id}"><rect x="${id==='A'?10:30}" y="10" width="120" height="60" fill="${id==='A'?'coral':'skyblue'}" opacity="${i?.9:1}"/></g>`).join('');
   G.views.patchPianoLayer(el,html(['A','B']));const a=el.children[0],b=el.children[1];
   for(const order of [['B','A'],['A','B'],['B','A']]){
    G.views.patchPianoLayer(el,html(order));assert([...el.children].map(n=>n.dataset.note).join()===order.join(),'SVG order mismatch');
    assert(el.querySelector('[data-note=A]')===a&&el.querySelector('[data-note=B]')===b,'keyed root replaced');
    const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.left+60,r.top+20)?.closest('[data-note]')?.dataset.note;
    assert(top===order.at(-1),'visible top differs from reverse-array hit');
   }
   G.views.patchPianoLayer(el,html(['B']));assert(el.children.length===1&&el.firstElementChild===b,'delete failed');
  });
  const r=repo(),p=G.blankProject();Date.now=()=>now;
  await check('IndexedDB: saved snapshots are captured at enqueue time',async()=>{
   const saving=r.save(p);p.title='after enqueue';await saving;assert((await r.load(p.id)).title!=='after enqueue','snapshot changed after enqueue');
  });
  await check('IndexedDB: ordinary saves/list do not read historical bodies',async()=>{
   // Seed another project with a 4 MiB sample history, then forbid body reads.
   const other=G.blankProject();other.assets.sample={data:'data:audio/wav;base64,'+'A'.repeat(4*1024*1024),root:60,mode:'pitched',name:'large'};await r.save(other);
   for(const method of ['getAll','get','openCursor']){
    originals[method]=IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method]=function(...args){if(this.name==='recoveries')throw Error('Unexpected historical body read: '+method);return originals[method].apply(this,args);};
   }
   await r.save(p);await r.save(p);assert((await r.recoveries(p.id)).length===1,'30 second interval ignored');
  });
  await check('IndexedDB: per-project count, metadata/body keys, and capacity stay bounded',async()=>{
   for(let i=0;i<12;i++){now+=30001;await r.save(p);}
   assert((await r.recoveries(p.id)).length===10,'recovery count exceeds 10');
   const db=await r.open(),tx=db.transaction(['recoveries','recovery-index']);
   const keys=await request(tx.objectStore('recoveries').getAllKeys());const index=await r.all('recovery-index');
   assert(keys.sort().join()===index.map(x=>x.id).sort().join(),'metadata/body keys diverged');
   assert(index.reduce((n,x)=>n+x.bytes,0)<=120*1024*1024,'budget exceeded');
   // Synthetic metadata budget, no need to allocate hundreds of MiB in CI.
   const write=db.transaction(['recoveries','recovery-index'],'readwrite');
   for(let i=0;i<4;i++){const id='budget:'+i;write.objectStore('recoveries').put({id,projectId:'budget',time:now-i,title:'budget',document:p},id);write.objectStore('recovery-index').put({id,projectId:'budget',time:now-i,title:'budget',bytes:40*1024*1024},id);}
   await done(write);now+=30001;await r.save(p);
   const bounded=await r.all('recovery-index');assert(bounded.reduce((n,x)=>n+x.bytes,0)<=120*1024*1024,'budget pruning failed');
  });
  await check('IndexedDB: conflicting save aborts document and recovery changes together',async()=>{
   const peer=repo(r.name);await peer.load(p.id);await r.save(p);
   const before=(await r.all('recovery-index')).length;let failed=false;
   try{await peer.save(p);}catch(e){failed=e.code==='SAVE_CONFLICT';}
   assert(failed,'stale save accepted');assert((await r.all('recovery-index')).length===before,'conflict wrote recovery');
   assert((await r.load(p.id)).title===p.title,'conflict overwrote document');
  });
  await check('IndexedDB: metadata write failure rolls back and save queue recovers',async()=>{
   const db=await r.open(),before=await r.read('documents',p.id),put=IDBObjectStore.prototype.put;
   now+=30001;
   IDBObjectStore.prototype.put=function(...args){const req=put.apply(this,args);if(this.name==='recovery-index')req.onsuccess=()=>this.transaction.abort();return req;};
   let failed=false;try{await r.save(p);}catch{failed=true;}finally{IDBObjectStore.prototype.put=put;}
   assert(failed,'injected abort accepted');assert((await r.read('documents',p.id)).revision===before.revision,'aborted revision persisted');
   await r.save(p);assert((await r.read('documents',p.id)).revision===before.revision+1,'queue did not recover');
  });
  await check('IndexedDB: delete uses metadata and removes matching history only',async()=>{
   const before=(await r.all('recovery-index')).filter(x=>x.projectId!==p.id).length;
   await r.delete(p.id);assert((await r.recoveries(p.id)).length===0,'history survived delete');assert((await r.all('recovery-index')).length===before,'other history deleted');
  });
  for(const [method,fn] of Object.entries(originals))IDBObjectStore.prototype[method]=fn;
  await check('IndexedDB: v2 upgrade backfills legacy bodies once and retains recovery data',async()=>{
   const n=name(),opening=indexedDB.open(n,2);
   opening.onupgradeneeded=()=>{for(const s of ['projects','documents','project-index','recoveries','metadata'])opening.result.createObjectStore(s);};
   const old=await request(opening),tx=old.transaction(['recoveries','projects'],'readwrite'),doc=G.blankProject();
   tx.objectStore('recoveries').put({id:'old',projectId:doc.id,title:doc.title,time:100,document:doc},'old');
   tx.objectStore('projects').put({time:200,project:doc},'recovery:legacy');await done(tx);old.close();
   const upgraded=repo(n);await upgraded.migrate();const list=await upgraded.recoveries(doc.id);
   assert(list.length===2,'legacy migration lost history');assert((await upgraded.recovery('old',doc.id)).id===doc.id,'old recovery unreadable');
   assert((await upgraded.all('recovery-index')).every(x=>x.bytes>0&&!('document' in x)),'invalid lightweight metadata');
  });
 }catch(error){results.push({status:'FAIL',error:error.stack});}
 finally{
  Date.now=clock;for(const [method,fn] of Object.entries(originals))IDBObjectStore.prototype[method]=fn;
  for(const r of repos)r.db?.close();
  for(const n of names)await request(indexedDB.deleteDatabase(n));
  globalThis.reviewResults=results;document.querySelector('#result').textContent=JSON.stringify(results,null,2);
 }
};
