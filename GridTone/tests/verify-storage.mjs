import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {harness} from './browser-harness.mjs';
const h=await harness(),checks=[];
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
let completed=false;
try{
 await check('R2-T01 real-origin A/B save and refresh',async()=>{
  await h.page.evaluate(async()=>{const G=GridTone,A=G.blankProject(),B=G.blankProject();A.title='作品 A';B.title='作品 B';A.tracks[0].patterns[0].notes=[G.newNote(60,0,80)];B.tracks[0].patterns[0].notes=[G.newNote(72,160,120)];await G.projects.save(A);await G.projects.save(B);await G.projects.activate(A.id);sessionStorage.setItem('test-ids',JSON.stringify([A.id,B.id]));});
  await h.page.reload();await h.page.waitForFunction(()=>GridToneApp?.getProject().title==='作品 A');
  const results=await h.page.evaluate(async()=>{const [a,b]=JSON.parse(sessionStorage.getItem('test-ids'));return [(await GridTone.projects.load(a)).tracks[0].patterns[0].notes[0].pitch,(await GridTone.projects.load(b)).tracks[0].patterns[0].notes[0].pitch];});assert.deepEqual(results,[60,72]);
 });
 await check('R2-T02/T03 queued snapshot cannot follow later edits',async()=>{
  const result=await h.page.evaluate(async()=>{const G=GridTone,p=G.blankProject();p.title='first';const first=G.projects.save(p);p.title='second';const second=G.projects.save(p);p.title='unsaved';await Promise.all([first,second]);return (await G.projects.load(p.id)).title;});assert.equal(result,'second');
 });
 await check('R2-T07 independent database connections reject stale revision',async()=>{
  const result=await h.page.evaluate(async()=>{const G=GridTone,id=JSON.parse(sessionStorage.getItem('test-ids'))[0],other=new G.ProjectRepository(),a=await G.projects.load(id),b=await other.load(id);a.title='newer';await G.projects.save(a);b.title='stale';try{await other.save(b);return 'unexpected';}catch(e){other.db.close();return [e.code,(await G.projects.load(id)).title];}});assert.deepEqual(result,['SAVE_CONFLICT','newer']);
 });
 await check('R2-T05 legacy migration is idempotent and retains raw backup',async()=>{
  const result=await h.page.evaluate(async()=>{const G=GridTone,p=G.demoProject();p.version=2;const name='migration-'+Date.now();await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>{const tx=r.result.transaction('projects','readwrite');tx.objectStore('projects').put(p,'autosave');tx.objectStore('projects').put({project:{bad:true}},'recovery:bad');tx.oncomplete=()=>{r.result.close();resolve();};tx.onerror=()=>reject(tx.error);};});const repo=new G.ProjectRepository(name);await repo.migrate();await repo.migrate();const result=[(await repo.list()).length,(await repo.read('projects','autosave')).version,(await repo.load(p.id)).version,(await repo.read('metadata','migration-v2')).warnings.length];repo.db.close();return result;});assert.deepEqual(result,[1,2,3,1]);
 });
 await check('R2-T06 recovery isolation and deletion preserve other project',async()=>{
  const result=await h.page.evaluate(async()=>{const G=GridTone,[a,b]=JSON.parse(sessionStorage.getItem('test-ids'));const recovery=(await G.projects.recoveries(b))[0];let code;try{await G.projects.recovery(recovery.id,a);}catch(e){code=e.code;}await G.projects.delete(a);return [code,!!(await G.projects.load(b)),(await G.projects.recoveries(a)).length];});assert.deepEqual(result,['WRONG_PROJECT',true,0]);
 });
 await check('R2-T04 aborted transaction cannot publish a saved revision',async()=>{
  const result=await h.page.evaluate(async()=>{
   const G=GridTone,repo=new G.ProjectRepository('abort-'+Date.now()),p=G.blankProject();p.title='durable';await repo.save(p);const db=repo.db,original=db.transaction.bind(db);db.transaction=(...args)=>{const tx=original(...args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
   p.title='must not persist';let code;try{await repo.save(p);}catch(e){code=e.code;}
   db.transaction=original;const loaded=await repo.load(p.id);const rev=repo.revisions.get(p.id);repo.db.close();return [code,loaded.title,rev];
  });assert.deepEqual(result,['STORAGE_ABORT','durable',1]);
 });
 await check('R2-T04 budget rejection is atomic and leaves the active song available',async()=>{
  const result=await h.page.evaluate(async()=>{
   const G=GridTone,repo=new G.ProjectRepository('quota-'+Date.now()),p=G.blankProject();await repo.save(p);const summarize=repo.summary.bind(repo);repo.summary=(...args)=>({...summarize(...args),bytes:121*1024*1024});let code;try{p.title='too big';await repo.save(p);}catch(e){code=e.code;}const result=[code,(await repo.load(p.id)).title];repo.db.close();return result;
  });assert.equal(result[0],'STORAGE_QUOTA');assert.notEqual(result[1],'too big');
  const kept=await h.page.evaluate(async()=>{
   const A=GridToneApp,G=GridTone,id=A.getProject().id,save=G.projects.save.bind(G.projects);G.projects.save=()=>Promise.reject(Object.assign(Error('injected quota'),{code:'STORAGE_QUOTA'}));let rejected=false;try{await A.loadProject(G.blankProject());}catch{rejected=true;}G.projects.save=save;return [rejected,A.getProject().id===id];
  });assert.deepEqual(kept,[true,true]);
 });
 await check('R2-T06 each project keeps at most ten recovery records at thirty-second intervals',async()=>{
  const result=await h.page.evaluate(async()=>{
   const G=GridTone,repo=new G.ProjectRepository('retention-'+Date.now()),p=G.blankProject(),other=G.blankProject(),clock=Date.now;let at=clock();Date.now=()=>at;
   try{await repo.save(other);for(let i=0;i<13;i++){at+=31000;p.title='revision '+i;await repo.save(p);}const a=await repo.recoveries(p.id),b=await repo.recoveries(other.id);return [a.length,b.length,a[0].title,a.at(-1).title];}finally{Date.now=clock;repo.db.close();}
  });assert.deepEqual(result,[10,1,'revision 12','revision 3']);
 });
 await check('R2-T07 real second tab rejects stale save and can create an independent copy',async()=>{
  const id=await h.page.evaluate(async()=>{const p=GridTone.blankProject();p.title='shared';await GridTone.projects.save(p);await GridTone.projects.activate(p.id);return p.id;});
  const tab=await h.context.newPage();tab.on('pageerror',e=>h.errors.push(e.message));await tab.goto(h.url);await tab.waitForFunction(id=>window.GridToneApp?.getProject().id===id,id);
  await h.page.evaluate(async id=>{const p=await GridTone.projects.load(id);p.title='other tab newer';await GridTone.projects.save(p);},id);
  const result=await tab.evaluate(async()=>{const G=GridTone,p=GridToneApp.getProject();p.title='local unfinished';let code;try{await G.projects.save(p);}catch(e){code=e.code;}const copy=G.copyProject(p);await G.projects.save(copy);return [code,(await G.projects.load(p.id)).title,(await G.projects.load(copy.id)).title,copy.id!==p.id];});
  assert.deepEqual(result,['SAVE_CONFLICT','other tab newer','local unfinished · 副本',true]);await tab.close();
 });
 await check('R2-T08 same-ID import copies identities and rapid switches serialize',async()=>{
  const result=await h.page.evaluate(async()=>{const G=GridTone,A=GridToneApp,first=G.blankProject();await A.loadProject(first);await A.loadProject(first);const imported=A.getProject();const a=G.blankProject(),b=G.blankProject();a.title='queue A';b.title='queue B';await Promise.all([A.loadProject(a),A.loadProject(b)]);return [imported.id!==first.id,imported.tracks[0].id!==first.tracks[0].id,A.getProject().title,(await G.projects.load(a.id)).title,(await G.projects.load(b.id)).title];});assert.deepEqual(result,[true,true,'queue B','queue A','queue B']);
 });
 assert.deepEqual(h.errors,[]);completed=true;
}finally{await writeFile(h.output+'/storage.json',JSON.stringify({status:completed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),origin:h.url,checks,errors:h.errors},null,2));await h.close();}
