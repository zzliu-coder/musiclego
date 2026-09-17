/** Map each original acceptance item to concrete current evidence. */
import {readFile,writeFile,access} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=root+'docs/implementation/';
const spec=JSON.parse(await readFile(dir+'spec/验收清单.json','utf8'));
const rows={
 R0:[
  ['BASELINE.md','evidence/baseline-snapshot.json'],['BASELINE.md','evidence/verification.json'],['BASELINE.md','evidence/baseline.json'],['BASELINE.md','evidence/baseline.json'],['CONTRACTS.md','spec/musiclego_详细施工计划.md']],
 R1:[
  ['../../tests/contracts.test.mjs','evidence/workflow.json'],['../../tests/contracts.test.mjs','evidence/verification.json'],['../../tests/contracts.test.mjs','evidence/verification.json'],['../../tests/gestures.test.cjs','evidence/interactions.json'],['../../tests/contracts.test.mjs','evidence/verification.json'],['../../tests/editing.test.mjs','evidence/interactions.json'],['../../tests/playback.test.mjs','evidence/interactions.json'],['../../tests/core.test.mjs','evidence/release-flow.json'],['evidence/fixtures/legacy-v1.gridtone','evidence/baseline.json'],['CONTRACTS.md','evidence/storage.json']],
 R2:[
  ['../../src/storage/projects.js','evidence/storage.json'],['../../src/app.js','evidence/storage.json'],['../../src/storage/projects.js','evidence/storage.json'],['../../src/app.js','evidence/storage.json'],['../../src/storage/projects.js','evidence/storage.json'],['../../src/storage/projects.js','evidence/storage.json'],['../../src/storage/projects.js','evidence/storage.json'],['../../src/editing.js','evidence/storage.json'],['../../tests/catalog.test.mjs','evidence/release-flow.json']],
 R3:[
  ['../../src/views/editor.js','evidence/workflow.json'],['../../src/ui/components.js','evidence/interactions.json'],['../../src/styles/tokens.css','evidence/interactions.json'],['CONTRACTS.md'],['../../src/views/arrange.js','evidence/workflow.json'],['../../src/ui/editor-gestures.js','evidence/interactions.json'],['../../src/ui/focus.js','evidence/interactions.json'],['evidence/visual-review.json','evidence/visual.json'],['../../src/styles/components.css','evidence/interactions.json']],
 R4:[
  ['../../tests/harmony.test.mjs','evidence/verification.json'],['../../tests/harmony.test.mjs','evidence/verification.json'],['../../tests/harmony.test.mjs','evidence/verification.json'],['../../tests/harmony.test.mjs','../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/harmony.test.mjs','evidence/verification.json'],['../../tests/harmony.test.mjs','evidence/release-flow.json'],['../../tests/harmony.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json']],
 R5:[
  ['../../tests/catalog.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../catalog/recipes.json','evidence/workflow.json'],['../../tests/catalog.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/catalog.test.mjs','../../tests/generation.test.mjs','evidence/verification.json'],['../../src/views/creation.js','evidence/workflow.json'],['../../tests/catalog.test.mjs','evidence/release-flow.json'],['evidence/audio.json']],
 R6:[
  ['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/workflow.json'],['../../tests/generation.test.mjs','evidence/release-flow.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/workflow.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../src/music/generation.js','../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/playback.test.mjs','evidence/workflow.json'],['../../src/views/creation.js','evidence/workflow.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['evidence/audio.json']],
 R7:[
  ['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../src/music/ensemble.js','../../tests/core.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/verification.json'],['../../src/views/creation.js','evidence/interactions.json'],['../../tests/generation.test.mjs','evidence/release-flow.json']],
 R8:[
  ['../../tests/generation.test.mjs','evidence/verification.json'],['../../src/music/generation.js','../../tests/generation.test.mjs','evidence/verification.json'],['../../tests/generation.test.mjs','evidence/release-flow.json'],['../../src/music/recipes.js','../../tests/studio.test.mjs','evidence/verification.json'],['../../src/music/recipes.js','evidence/release-flow.json'],['../../tests/core.test.mjs','evidence/verification.json'],['evidence/soak.json']],
 R9:[
  ['evidence/clean-build.json'],['../../scripts/verify.mjs','../../scripts/verify-acceptance.mjs','evidence/verification.json'],['evidence/release-flow.json'],['evidence/storage.json','evidence/release-flow.json'],['evidence/visual-review.json','evidence/visual.json'],['evidence/audio.json'],['BASELINE.md','evidence/audio.json','evidence/soak.json'],['evidence/package.json'],['CONTRACTS.md','RELEASE_NOTES.md']]
};
const source={R0:['docs/implementation/'],R1:['src/model.js','src/editing.js','src/commands.js','src/app.js'],R2:['src/storage/projects.js','src/io.js','src/app.js'],R3:['src/ui/components.js','src/ui/focus.js','src/styles/tokens.css','src/styles/components.css','src/views/'],R4:['src/music/harmony.js','src/music/progressions.js','src/views/creation.js'],R5:['catalog/recipes.json','src/music/recipes.js','src/catalog.js'],R6:['src/music/generation.js','src/views/creation.js'],R7:['src/music/ensemble.js','src/views/creation.js'],R8:['src/music/recipes.js','src/views/creation.js'],R9:['scripts/verify.mjs','tests/verify-*.mjs']};
const verification=JSON.parse(await readFile(dir+'evidence/verification.json','utf8'));
let equivalent;try{equivalent=JSON.parse(await readFile(dir+'evidence/runtime-equivalence.json','utf8'));}catch{}
for(const t of spec.tests){
 const index=Number(t.id.split('-T')[1])-1,refs=rows[t.phase]?.[index];if(!refs)throw Error('Missing explicit mapping '+t.id);
 t.status='PASS';t.evidence=refs;t.implementation=source[t.phase];t.notes='';
 for(const ref of refs){try{await access(dir+ref);if(ref.startsWith('evidence/')&&ref.endsWith('.json')&&!ref.endsWith('/baseline.json')){const e=JSON.parse(await readFile(dir+ref,'utf8'));if(e.status&&e.status!=='PASS'){t.status=e.status==='FAIL'?'FAIL':'NOT_RUN';t.notes='Referenced check has not passed: '+ref;}if(e.sha256&&e.sha256!==verification.sha256){const sameRuntime=ref==='evidence/soak.json'&&equivalent?.status==='PASS'&&equivalent.sha256===verification.sha256&&equivalent.soak_build_sha256===e.sha256;if(sameRuntime){t.evidence=[...t.evidence,'evidence/runtime-equivalence.json'];}else{t.status='FAIL';t.notes='Evidence build hash differs: '+ref;}}}}catch{t.status='NOT_RUN';t.notes='Missing evidence: '+ref;}}
 if(['R5-T09','R6-T13','R9-T06'].includes(t.id)){t.status='NOT_RUN';t.notes='工程渲染 / 性能部分已有实际结果；人工音乐听感未评审，完整条目尚未通过。';}
 if(t.id==='R3-T04'){t.status='NOT_APPLICABLE';t.notes='2026-09-18 用户明确要求“小屏体验先不用考虑，以后做专题”。本轮不验收触屏专项。';}
 if(['R3-T08','R9-T05'].includes(t.id))t.notes='按最新用户范围，仅验收桌面 1280 / 1440、两种皮肤；移动端截图为早期诊断，不计本轮通过。';
 if(t.id==='R2-T04')t.notes='已注入事务 abort 与应用预算失败并检查留稿；浏览器宿主实际磁盘耗尽不在模拟结论中。';
 if(t.id==='R8-T07')t.notes='30 分钟自动创作流程、堆 / DOM 采样和最终真实刷新；不代表物理声卡听感。';
}
const counts=Object.fromEntries(['PASS','FAIL','NOT_RUN','BLOCKED','NOT_APPLICABLE'].map(s=>[s,spec.tests.filter(t=>t.status===s).length]));
for(const p of spec.phases){const tests=spec.tests.filter(t=>t.phase===p.id);p.status=tests.some(t=>t.status==='FAIL')?'FAIL':tests.every(t=>['PASS','NOT_APPLICABLE'].includes(t.status))?'PASS':'PARTIAL';}
Object.assign(spec,{document_status:'ENGINEERING_CANDIDATE',date:new Date().toISOString(),version:'1.6.0',sha256:verification.sha256,counts,scope_changes:[{date:'2026-09-18',source:'Direct user instruction',change:'Small-screen experience deferred; desktop scope retained.'}]});
if(spec.tests.length!==87||new Set(spec.tests.map(t=>t.id)).size!==87)throw Error('Acceptance inventory mismatch');
await writeFile(dir+'acceptance.json',JSON.stringify(spec,null,2)+'\n');console.log(counts);
