/** JSON is the source of truth for built-in content. Generated JS stays offline/file:// compatible. */
import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),data=JSON.parse(await readFile(new URL('catalog/builtin.json',root),'utf8'));
if(data.format!=='gridtone.catalog'||data.version!==1)throw Error('Unsupported built-in catalog');
const header='/** Generated from catalog/builtin.json by scripts/catalog-build.mjs. Edit the JSON source. */\n';
await writeFile(new URL('src/presets.js',root),header+`(function(G){'use strict';const PRESETS=${JSON.stringify(data.presets)};\nconst presetById=(id,project)=>G.resolvePreset?G.resolvePreset(id,project):PRESETS.find(p=>p.id===id)||{id,missing:true,name:'缺失音色 · '+id,category:'缺失',description:'请选择替代音色或补齐素材包。',engine:'missing'};Object.assign(G,{PRESETS,presetById});})(globalThis.GridTone ||= {});\n`);
await writeFile(new URL('src/catalog-data.js',root),header+`(function(G){G.BUILTIN_CATALOG=${JSON.stringify({...data,presets:undefined})};})(globalThis.GridTone ||= {});\n`);
const example=JSON.parse(await readFile(new URL('catalog/example.json',root),'utf8'));
const generated=new URL('src/catalog-data.js',root);
await writeFile(generated,(await readFile(generated,'utf8'))+`globalThis.GridTone.EXAMPLE_CATALOG=${JSON.stringify(example)};\n`);
const recipes=JSON.parse(await readFile(new URL('catalog/recipes.json',root),'utf8'));
const ids=new Set();for(const r of recipes){if(!Number.isInteger(r.version)||r.version<1||!r.id||ids.has(r.id)||!r.name||!r.license||!r.origin)throw Error('Invalid or duplicate recipe');ids.add(r.id);if(r.melodyRhythm){const h=r.melodyRhythm;if(h.version!==1||![1,2,4,8].includes(h.bars)||!Array.isArray(h.slots)||h.slots.some((n,i)=>!Number.isFinite(n.start)||!Number.isFinite(n.duration)||n.start<0||n.duration<1||n.start+n.duration>h.bars*3840||i&&n.start<h.slots[i-1].start+h.slots[i-1].duration))throw Error('Invalid recipe rhythm skeleton: '+r.id);}}
await writeFile(generated,(await readFile(generated,'utf8'))+`globalThis.GridTone.RECIPES=${JSON.stringify(recipes)};\n`);
