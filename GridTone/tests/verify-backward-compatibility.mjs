/** Compare delivered .gridtone outputs with an untouched 1.7.2 validator.
 * Usage: node tests/verify-backward-compatibility.mjs /path/to/1.7.2/GridTone
 * Restore the baseline from the shipped Git bundle (commit 302e454).
 */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const baseline=process.argv[2];if(!baseline)throw Error('Provide the unmodified 1.7.2 GridTone directory.');
const R=fileURLToPath(new URL('..',import.meta.url)),E=path.join(R,'docs/workspace-1.8/evidence');
const {runtime}=await import(pathToFileURL(path.resolve(baseline,'tests/runtime.mjs')));const G=runtime();
const files=[...fs.readdirSync(path.join(E,'audio')).filter(x=>x.endsWith('.gridtone')).map(x=>'audio/'+x),'browser/downloads/workspace.gridtone','soak-final.gridtone'];
const checks=files.map(file=>{const raw=fs.readFileSync(path.join(E,file)),p=JSON.parse(raw),checked=G.validateProject(p);if(checked.version!==3||JSON.stringify(G.compileSong(p))!==JSON.stringify(G.compileSong(checked)))throw Error('Legacy validation changed musical content: '+file);return {file,sha256:createHash('sha256').update(raw).digest('hex'),version:3,events:G.compileSong(checked).events.length,status:'PASS'};});
const report={status:'PASS',validator:'unmodified 1.7.2, local source commit 302e454',sha256:JSON.parse(fs.readFileSync(path.join(R,'dist/manifest.json'))).sha256,checks,scope:'Old production validator and event compiler in Node; no native-browser or persistent-storage claim.'};
fs.writeFileSync(path.join(E,'backward-compatibility.json'),JSON.stringify(report,null,2));console.log('PASS',checks.length,'old-validator document roundtrips');
