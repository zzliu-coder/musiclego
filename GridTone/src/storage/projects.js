/** Local documents. A transaction owns both revision comparison and index update. */
(function (G) {
 'use strict';
 const DB_NAME='gridtone-local-v1', DB_VERSION=2;
 const failure=(code,message)=>Object.assign(new Error(message),{code});
 class ProjectRepository {
  constructor(name=DB_NAME){this.name=name;this.db=null;this.opening=null;this.revisions=new Map();this.queue=Promise.resolve();}
  async open(){
   if(this.db)return this.db;
   if(!globalThis.indexedDB)throw failure('STORAGE_UNAVAILABLE','浏览器未启用本机存储，请下载工程备份。');
   if(!this.opening)this.opening=new Promise((resolve,reject)=>{
    const r=indexedDB.open(this.name,DB_VERSION);let blocked=false;
    r.onupgradeneeded=()=>{for(const name of ['projects','documents','project-index','recoveries','metadata'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};
    r.onblocked=()=>{blocked=true;this.opening=null;reject(failure('STORAGE_BLOCKED','存储升级被旧页面阻止，请关闭其他乐构页面后重试。'));};
    r.onerror=()=>{this.opening=null;reject(r.error);};
    r.onsuccess=()=>{if(blocked){r.result.close();return;}this.db=r.result;this.db.onversionchange=()=>{this.db.close();this.db=null;this.opening=null;};resolve(this.db);};
   });
   return this.opening;
  }
  async read(store,key){const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async all(store){const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async migrate(){
   const db=await this.open();
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(['projects','documents','project-index','recoveries','metadata'],'readwrite'),meta=tx.objectStore('metadata'),check=meta.get('migration-v2');
    const warnings=[];
    check.onsuccess=()=>{
     if(check.result)return;
     const request=tx.objectStore('projects').openCursor();
     request.onsuccess=()=>{const cursor=request.result;if(!cursor){
      const records=tx.objectStore('recoveries'),all=records.getAll();
      all.onsuccess=()=>{const counts=new Map();let bytes=0;for(const row of all.result.sort((a,b)=>b.time-a.time)){const n=(counts.get(row.projectId)||0)+1;counts.set(row.projectId,n);bytes+=JSON.stringify(row.document).length*2;if(n>10||bytes>120*1024*1024)records.delete(row.id);}meta.put({date:Date.now(),warnings},'migration-v2');};return;}
      const key=String(cursor.key),value=cursor.value;
      if(key==='autosave'||key.startsWith('recovery:')){
       try{
        const document=G.validateProject(key==='autosave'?value:value.project),time=value.time||Date.now();
        if(key==='autosave'){
         const docs=tx.objectStore('documents'),existing=docs.get(document.id);
         existing.onsuccess=()=>{if(!existing.result){docs.put({document,revision:1,updatedAt:time},document.id);tx.objectStore('project-index').put(this.summary(document,1,time),document.id);meta.put(document.id,'last-opened');}};
        }else tx.objectStore('recoveries').put({id:document.id+':legacy:'+key,projectId:document.id,time,title:document.title,document},document.id+':legacy:'+key);
       }catch(e){warnings.push({key,error:e.message});}
      }
      cursor.continue();
     };
    };
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||failure('STORAGE_ABORT','迁移失败，旧存档保留。'));
   });
  }
  summary(p,revision,time){return {id:p.id,title:p.title,tracks:p.tracks.length,bars:p.bars,updatedAt:time,revision,bytes:JSON.stringify(p).length*2};}
  save(project){
   // Capture at enqueue time, before openDB or any delayed execution.
   let copy;try{copy=G.validateProject(G.clone(project));}catch(e){return Promise.reject(e);}
   const run=this.queue.catch(()=>{}).then(()=>this.write(copy,this.revisions.get(copy.id)||0));
   this.queue=run;return run;
  }
  async write(document,expected){
   const db=await this.open(),time=Date.now(),id=document.id;
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(['documents','project-index','recoveries'],'readwrite'),docs=tx.objectStore('documents'),index=tx.objectStore('project-index'),recoveries=tx.objectStore('recoveries');
    let error=null,revision=expected+1;
    const abort=(code,message)=>{error=failure(code,message);tx.abort();};
    const request=docs.get(id);
    request.onsuccess=()=>{
     if((request.result?.revision||0)!==expected){abort('SAVE_CONFLICT','这份作品已在另一页面更新。请重新打开最新版本，或保存当前内容为副本。');return;}
     const item=this.summary(document,revision,time),usage=index.getAll();
     usage.onsuccess=()=>{
      const total=usage.result.filter(x=>x.id!==id).reduce((sum,x)=>sum+x.bytes,0)+item.bytes;
      if(total>120*1024*1024){abort('STORAGE_QUOTA','本机作品达到 120 MB 预算，请下载备份并删除不用的作品。');return;}
      docs.put({document,revision,updatedAt:time},id);index.put(item,id);
      const prior=recoveries.getAll();prior.onsuccess=()=>{
       const own=prior.result.filter(x=>x.projectId===id).sort((a,b)=>b.time-a.time);
       const added=!own.length||time-own[0].time>=30000;
       if(added){const key=id+':'+time+':'+revision;recoveries.put({id:key,projectId:id,title:document.title,time,document},key);}
       const obsolete=new Set(own.slice(added?9:10).map(r=>r.id));for(const key of obsolete)recoveries.delete(key);
       // Recovery history has its own bounded budget. Never prune live documents.
       let bytes=added?JSON.stringify(document).length*2:0;
       for(const old of prior.result.filter(r=>!obsolete.has(r.id)).sort((a,b)=>b.time-a.time)){bytes+=JSON.stringify(old.document).length*2;if(bytes>120*1024*1024)recoveries.delete(old.id);}
      };
     };
    };
    tx.oncomplete=()=>{this.revisions.set(id,revision);resolve({id,revision,updatedAt:time});};
    tx.onabort=tx.onerror=()=>reject(error||Object.assign(tx.error||new Error('保存事务未完成。'),{code:tx.error?.name==='QuotaExceededError'?'STORAGE_QUOTA':'STORAGE_ABORT'}));
   });
  }
  async load(id){const row=await this.read('documents',id);if(!row)return null;const p=G.validateProject(row.document);this.revisions.set(id,row.revision);return p;}
  async list(){return (await this.all('project-index')).sort((a,b)=>b.updatedAt-a.updatedAt);}
  async activate(id){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('metadata','readwrite');tx.objectStore('metadata').put(id,'last-opened');tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);});}
  async last(){await this.migrate();const id=await this.read('metadata','last-opened');return id?this.load(id):null;}
  async recoveries(id){return (await this.all('recoveries')).filter(x=>x.projectId===id).sort((a,b)=>b.time-a.time).map(({id,time,title,projectId})=>({id,time,title,projectId}));}
  async recovery(key,id){const row=await this.read('recoveries',key);if(row?.projectId!==id)throw failure('WRONG_PROJECT','恢复点属于另一作品。');return G.validateProject(row.document);}
  async delete(id){await this.queue.catch(()=>{});const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(['documents','project-index','recoveries','metadata'],'readwrite');tx.objectStore('documents').delete(id);tx.objectStore('project-index').delete(id);const r=tx.objectStore('recoveries').openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(c.value.projectId===id)c.delete();c.continue();}};const last=tx.objectStore('metadata').get('last-opened');last.onsuccess=()=>{if(last.result===id)tx.objectStore('metadata').delete('last-opened');};tx.oncomplete=()=>{this.revisions.delete(id);resolve();};tx.onabort=tx.onerror=()=>reject(tx.error);});}
 }
 G.ProjectRepository=ProjectRepository;
 G.projects=new ProjectRepository();
})(globalThis.GridTone ||= {});
