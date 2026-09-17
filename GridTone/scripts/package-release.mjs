/** Archive committed files only, then rebuild and test the extracted source. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {dirname,resolve,join,basename} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=dirname(root.replace(/\/$/,'')),manifest=JSON.parse(await readFile(root+'dist/manifest.json','utf8'));
const archive=resolve(repo,`乐构_v${manifest.version}_candidate.zip`),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),temp=await mkdtemp(join(tmpdir(),'musiclego-package-'));
const sha=b=>createHash('sha256').update(b).digest('hex');let log='';
try{
 execFileSync('git',['archive','--format=zip','--prefix=乐构/','--output='+archive,'HEAD:GridTone'],{cwd:root});
 execFileSync('python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; z.extractall(sys.argv[2])',archive,temp]);
 const checkout=join(temp,'乐构');
 for(const args of [['ci'],['run','build'],['test']])log+=execFileSync('npm',args,{cwd:checkout,maxBuffer:8*1024*1024,encoding:'utf8'});
 for(const file of ['dist/index.html','乐构.html','声格.html'])assert.equal(sha(await readFile(join(checkout,file))),manifest.sha256);
 const bytes=await readFile(archive),receipt={status:'PASS',sha256:manifest.sha256,source_commit:commit,archive:basename(archive),archive_sha256:sha(bytes),bytes:bytes.length,zip_integrity:'PASS',extracted_source_install_build_and_core_tests:'PASS',html_aliases_match:true,note:'The archive contains committed source and the validation snapshot at source_commit. The final archive receipt and acceptance updates are stored alongside it in the repository.'};
 await writeFile(root+'docs/implementation/evidence/package.json',JSON.stringify(receipt,null,2));await writeFile(root+'docs/implementation/evidence/package-build.txt',log);await writeFile(archive+'.sha256',receipt.archive_sha256+'  '+basename(archive)+'\n');console.log(receipt);
 await rm(temp,{recursive:true,force:true});
}catch(e){await writeFile(root+'docs/implementation/evidence/package-build.txt',log+'\n'+e.stack);throw e;}
