/** One resource manifest for development and fully offline single-file release. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const resources=JSON.parse(await readFile(resolve(root,'assets.json'),'utf8'));
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const header='<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#F7F7F4"><meta name="description" content="乐构：轻触音符，拼接乐句，把音乐搭起来。离线音乐创作工作台。"><title>乐构 · 把音乐搭起来</title>';
const body='</head><body><div id="app"><p class="boot">正在打开乐构…</p></div><div id="overlay"></div><div id="toast" role="status" aria-live="polite"></div>';
let dev=header+resources.styles.map(f=>`<link rel="stylesheet" href="${f}">`).join('\n')+body;
let html=header+'<style>\n'+(await Promise.all(resources.styles.map(f=>readFile(resolve(root,f),'utf8')))).join('\n\n')+'\n</style>'+body;
for(const file of resources.scripts){
 dev+=`\n<script src="${file}"></script>`;
 const js=await readFile(resolve(root,file),'utf8');
 html+=`\n<script>\n${js.replace(/<\/script/gi,'<\\/script')}\n</script>`;
}
dev+='</body></html>';html+='</body></html>';
await writeFile(resolve(root,'index.html'),dev);
await mkdir(resolve(root,'dist'),{recursive:true});
await writeFile(resolve(root,'dist/index.html'),html);
await writeFile(resolve(root,'声格.html'),html);
await writeFile(resolve(root,'乐构.html'),html);
const sourceHasher=createHash('sha256');
for(const file of ['assets.json','package.json',...resources.styles,...resources.scripts]){sourceHasher.update(file+'\0');sourceHasher.update(await readFile(resolve(root,file)));sourceHasher.update('\0');}
const manifest={runtimeDigest:sourceHasher.digest('hex'),app:'乐构',version:pkg.version,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),runtimeDependencies:[],entry:'index.html'};
await writeFile(resolve(root,'dist/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built standalone HTML: ${manifest.bytes} bytes\nSHA-256 ${manifest.sha256}`);
const componentJS=await readFile(resolve(root,'src/ui/component-demo.js'),'utf8');
const componentBody='<main class="components-page"><div class="gallery-heading"><span class="shelf-eyebrow">LEGOU · WARM MAGNETIC / DS 2.0</span><h1>暖白磁贴 · 生产设计系统</h1><p>真实生产组件、音乐素材和生成面板。同一材料、同一几何；操作即时，表面反馈克制。</p><nav class="component-skin"><button class="btn" data-variant="secondary" data-size="normal" data-gallery-skin="crystal" aria-pressed="true">A 暖白磁贴</button><button class="btn" data-variant="secondary" data-size="normal" data-gallery-skin="pearl" aria-pressed="false">C 奶油浅瓷</button><button class="btn" data-variant="secondary" data-size="normal" data-gallery-direction="clear" aria-pressed="false">B 清白微光 · 对照</button></nav></div><div id="samples"></div></main>';
const componentModules=resources.scripts.filter(f=>f!=='src/app.js');
const css=(await Promise.all(resources.styles.map(f=>readFile(resolve(root,f),'utf8')))).join('\n');
let componentPage=header+'<style>'+css+'</style></head><body>'+componentBody;
for(const f of componentModules)componentPage+='<script>'+ (await readFile(resolve(root,f),'utf8')).replace(/<\/script/gi,'<\\/script')+'</script>';
componentPage+='<script>'+componentJS+'</script></body></html>';
await writeFile(resolve(root,'components.html'),componentPage);
