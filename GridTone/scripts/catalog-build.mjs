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
