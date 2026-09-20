/** Same synthetic fixture and production functions on both sides; excludes rendering/DB/audio. */
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {runtime} from '../tests/runtime.mjs';
const baseline=process.argv[2]||'6f4bbb4';
function measure(old,MiB){
 const G=runtime();
 if(old)for(const name of ['model','commands'])vm.runInNewContext(execFileSync('git',['show',`${baseline}:GridTone/src/${name}.js`],{encoding:'utf8'}),{GridTone:G,crypto:globalThis.crypto});
 let p=G.blankProject();p.tracks[0].patterns[0].bars=16;p.bars=16;
 p.tracks[0].patterns[0].notes=Array.from({length:1024},(_,i)=>G.newNote(60+i%12,Math.floor(i/4)*240,120));
 if(MiB)p.assets.test={data:'data:audio/wav;base64,'+'A'.repeat(MiB*1024*1024),root:60,mode:'pitched',name:'sample'};
 p=G.validateProject(p);
 const snapshot=old?p=>({...G.clone({...p,assets:{}}),assets:Object.fromEntries(Object.entries(p.assets).map(([id,a])=>[id,{...a}]))}):G.cloneProject;
 const times=[];
 for(let i=0;i<8;i++){
  const start=performance.now(),before=snapshot(p),result=G.executeCommand(before,d=>{d.tracks[0].patterns[0].notes[0].velocity=.5+i*.01;});
  if(!result.ok)throw Error(result.error.message);
  p=result.document;
  if(old){G.validateProject(p);if(JSON.stringify(before)===JSON.stringify(p))throw Error('unchanged fixture');}
  snapshot(p);
  if(i>=3)times.push(performance.now()-start);
 }
 return +times.sort((a,b)=>a-b)[2].toFixed(3);
}
console.log(JSON.stringify({baseline,node:process.version,scope:'1024 notes; snapshot -> production command -> app commit checks -> persist snapshot; 3 warmups, 5 samples, median; excludes DOM/audio/IndexedDB',rows:[0,4,8].map(MiB=>({MiB,beforeMs:measure(true,MiB),afterMs:measure(false,MiB)}))},null,2));
