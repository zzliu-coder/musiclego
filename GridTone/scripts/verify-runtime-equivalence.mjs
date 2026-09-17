/** Prove the ongoing soak's executable code equals the final build after CSS-only polish. */
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=s=>createHash('sha256').update(s).digest('hex');
const original=await readFile(root+'docs/implementation/evidence/soak-build.html','utf8'),final=await readFile(root+'dist/index.html','utf8');
const js=html=>[...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map(m=>m[1]);
assert.ok(js(original).length>30);assert.deepEqual(js(original),js(final));
assert.equal(original.replace(/<style>[\s\S]*?<\/style>/,''),final.replace(/<style>[\s\S]*?<\/style>/,''));
await writeFile(root+'docs/implementation/evidence/runtime-equivalence.json',JSON.stringify({status:'PASS',sha256:sha(final),soak_build_sha256:sha(original),javascript_sha256:sha(js(final).join('\n')),script_count:js(final).length,note:'Only CSS differs. All executable scripts and HTML structure are byte-identical. The long test covers this music/storage/playback implementation; final CSS is checked by the final desktop visual/interaction suites.'},null,2));
console.log('PASS: identical runtime, CSS-only difference');
