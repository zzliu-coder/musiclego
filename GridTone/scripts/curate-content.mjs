/** Deterministic comparison and family coverage. Similarity is a screening aid, not a listening score. */
import fs from'node:fs';import crypto from'node:crypto';import{studioRuntime}from'../tests/studio-runtime.mjs';
const G=studioRuntime(),p=G.blankProject(),families=G.studioFamilies(p,{legacy:true}),templates=G.catalogTemplates(),presets=G.projectPresets(p);
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const signatures=new Map(),exact=[];
for(const t of templates){if(t.type!=='pattern')continue;const s=hash({kind:t.kind,bars:t.bars,key:t.key,scale:t.scale,harmony:t.harmony?.events,notes:t.notes.map(n=>[n.pitch,n.start,n.duration,n.velocity,!!n.performed]).sort((a,b)=>a[1]-b[1]||a[0]-b[0])});if(signatures.has(s)){exact.push({canonical:signatures.get(s),alias:t.id,reason:'Exact note time/pitch/velocity/performance/length/harmony identity; tempo and suggested instrument are browsing metadata. Definition remains addressable.'});}else signatures.set(s,t.id);}
const near=[];const drums=templates.filter(t=>t.kind==='drum');
const sets=drums.map(t=>new Set(t.notes.map(n=>n.pitch+':'+Math.round(n.start/240))));
for(let i=0;i<drums.length;i++)for(let j=i+1;j<drums.length;j++){if(drums[i].bars!==drums[j].bars)continue;let a=sets[i],b=sets[j],intersection=[...a].filter(x=>b.has(x)).length;const sim=intersection/(a.size+b.size-intersection);if(sim>=.7)near.push({a:drums[i].id,b:drums[j].id,gridSimilarity:+sim.toFixed(4),decision:'Keep dynamic/microtiming difference; grouped as family where authored. No automatic deletion.'});}
const coverage=presets.map(t=>({id:t.id,families:families.filter(f=>f.kind==='sound'&&f.members.includes(t.id)).map(f=>f.id)}));
if(coverage.some(x=>!x.families.length))throw Error('Unassigned sound');
const combos=G.STUDIO_COMBOS.map(c=>{const d=G.recipeProject(c.id);return {id:c.id,name:c.name,eventHash:hash(d.tracks.map(t=>[t.role,t.preset,t.patterns[0].notes.map(n=>[n.pitch,n.start,n.duration,n.velocity])])),events:d.tracks.reduce((s,t)=>s+t.patterns[0].notes.length,0)};});
if(new Set(combos.map(c=>c.eventHash)).size!==combos.length)throw Error('Duplicate combination event content');
const report={version:1,scope:'New + old library, exact-content signatures and structural family grouping. No human listening approval claimed.',counts:{sounds:presets.length,templates:templates.length,newSounds:G.STUDIO_PACK.presets.length,newTemplates:G.STUDIO_PACK.templates.length,curatedFamilies:G.studioFamilies(p).length,combinations:combos.length,exactRhythmDuplicates:exact.length,nearRhythmPairs:near.length},exactAliases:exact,nearRhythms:near,soundCoverage:coverage,families,combinations:combos,compatibility:'IDs and payloads retained. Default discovery is family-based; old variants available by expanding original content. All applied data remains in documents.',listening:'NOT_RUN'};
fs.writeFileSync('catalog/curation-report.json',JSON.stringify(report,null,2));console.log(report.counts);
