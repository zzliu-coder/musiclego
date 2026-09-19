/** Explicit maintenance command. Normal builds are entirely offline. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../vendor/expansion/',import.meta.url);
const repos=[
 {name:'tr808',repo:'tidalcycles/sounds-tr808-fischer',commit:'85fbecf1bec32553395625ea659e2a56dfd7c0e1',files:['LICENSE','README.md','bd8/BD5050.WAV','sd8/SD5050.WAV','ch8/CH.WAV','oh8/OH50.WAV','cp8/CP.WAV','lt8/LT50.WAV','cy8/CY5050.WAV','rs8/RS.WAV','cb8/CB.WAV','cl8/CL.WAV','hc8/HC50.WAV','ht8/HT50.WAV','lc8/LC50.WAV','ma8/MA.WAV','mc8/MC50.WAV','mt8/MT50.WAV']},
 {name:'akwf',repo:'KristofferKarlAxelEkstrand/AKWF-FREE',commit:'8de90bf94376670947369e69de0af6b9fbd19286',files:['LICENSE.md',...['bw_blended','distorted','eguitar','eorgan','hvoice','oboe','sinharm','vgame'].map(n=>'AKWF/AKWF_'+n+'/AKWF_'+(n==='bw_blended'?'blended':n)+'_0001.wav')]}
];
const receipts=[];
for(const source of repos)for(const path of source.files){
 const url=`https://raw.githubusercontent.com/${source.repo}/${source.commit}/${path}`;
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(response.status+' '+url);
 const data=Buffer.from(await response.arrayBuffer()),file=new URL(source.name+'/'+path,root);
 await mkdir(new URL('.',file),{recursive:true});await writeFile(file,data);
 receipts.push({source:source.name,path,url,commit:source.commit,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),license:'CC0-1.0'});
 console.log(source.name,path,data.length);
}
await writeFile(new URL('sources.json',root),JSON.stringify(receipts,null,2)+'\n');
