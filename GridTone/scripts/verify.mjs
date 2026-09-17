/** Current-build checks only. Release acceptance has a separate strict gate. */
import {spawn} from 'node:child_process';import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'docs/implementation/evidence';await mkdir(out,{recursive:true});
const tests=(await readdir(root+'tests')).filter(f=>/\.test\.(mjs|cjs)$/.test(f)).sort().map(f=>'tests/'+f);
const jobs=[['catalog',['scripts/catalog-build.mjs']],['build',['scripts/build.mjs']],['core',['--test',...tests]],...['storage','workflow','release-flow','interactions','visual','audio'].map(name=>[name,['tests/verify-'+name+'.mjs']])];
const results=[];
for(const [name,args] of jobs){
 const start=Date.now();let output='';console.log('Checking',name);
 const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output+=data;});child.on('error',e=>{output+=e.stack;resolve(1);});child.on('close',code=>resolve(code??1));});
 await writeFile(out+'/'+name+'.txt',output);results.push({name,status:exitCode===0?'PASS':'FAIL',exitCode,ms:Date.now()-start,log:name+'.txt'});console.log(name,exitCode===0?'PASS':'FAIL');
 if(exitCode!==0){console.error(output.slice(-6000));break;}
}
const sha256=createHash('sha256').update(await readFile(root+'dist/index.html')).digest('hex'),status=results.length===jobs.length&&results.every(r=>r.status==='PASS')?'PASS':'FAIL';
await writeFile(out+'/verification.json',JSON.stringify({date:new Date().toISOString(),status,sha256,node:process.version,browserChannel:process.env.BROWSER_CHANNEL||'bundled Chromium',results,scope:'Current automated engineering suites. Full release gate additionally requires soak and acceptance.json; small-screen work deferred by user.'},null,2));
process.exitCode=status==='PASS'?0:1;
