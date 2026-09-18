import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {harness} from './browser-harness.mjs';
const h=await harness({launchOptions:process.env.BANK_PROXY?{proxy:{server:process.env.BANK_PROXY,bypass:'127.0.0.1,localhost'}}:{}}),results=[];let passed=false;
const out='docs/closure-v2/evidence/real-banks';await mkdir(out,{recursive:true});
try{
 const ids=await h.page.evaluate(()=>GridTone.SAMPLE_BANKS.map(b=>b.id));
 for(const id of ids){
  console.log('Downloading actual upstream',id);
  const data=await h.page.evaluate(async id=>{const G=GridTone,bank=G.SAMPLE_BANKS.find(b=>b.id===id),pack=await G.downloadSampleBank(id);G.installCatalog(pack);await G.saveCatalogPacks(G.catalogContents().packs);const p=G.blankProject(),t=p.tracks[0];t.preset=id;t.patterns[0].notes=[G.newNote(60,0,960),G.newNote(67,1920,960)];G.pinDocument(p);await GridToneApp.loadProject(p);await GridToneApp.flushSave();return {pack,document:GridToneApp.getProject(),sources:bank.zones,license:bank.license};},id);
  const blockExternal=route=>new URL(route.request().url()).origin===new URL(h.url).origin?route.continue():route.abort('internetdisconnected');await h.context.route('**/*',blockExternal);await h.page.reload();await h.page.waitForFunction(()=>GridToneApp&&!/正在/.test(GridToneApp.getState().saveStatus));
  const metrics=await h.page.evaluate(async id=>{const G=GridTone,p=GridToneApp.getProject();if(p.tracks[0].preset!==id)throw Error('Wrong saved instrument');if(G.missingResources(p).length)throw Error('Embedded assets missing');const r=await GridToneApp.engine.exportWav(p);return {peak:r.peak,seconds:r.buffer.duration,assets:Object.keys(p.assets).length};},id);
  assert.ok(metrics.peak>.001);await h.context.unroute('**/*',blockExternal);
  const bytes=Buffer.from(JSON.stringify(data.pack));await writeFile(out+'/'+id+'.catalog.json',bytes);results.push({id,status:'PASS',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...metrics,license:data.license,sources:data.sources});console.log('PASS real download, embedded save, offline reload/render',id);
 }
 passed=true;
}finally{await writeFile(out+'/report.json',JSON.stringify({status:passed?'PASS':'FAIL',sha256:h.sha256,date:new Date().toISOString(),results,scope:'Actual upstream downloads via production downloader; original local origin reload with all external network blocked and render; listening separate.'},null,2));await h.close();}
