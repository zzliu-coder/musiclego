/** One resource manifest for development and fully offline single-file release. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const resources=JSON.parse(await readFile(resolve(root,'assets.json'),'utf8'));
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const header='<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#fafaf8"><meta name="description" content="乐构：轻触音符，拼接乐句，把音乐搭起来。离线音乐创作工作台。"><title>乐构 · 把音乐搭起来</title>';
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
const manifest={app:'乐构',version:pkg.version,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),runtimeDependencies:[],entry:'index.html'};
await writeFile(resolve(root,'dist/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built standalone HTML: ${manifest.bytes} bytes\nSHA-256 ${manifest.sha256}`);
const componentBody=`<main class="components-page"><h1>乐构 · 生产组件</h1><p>与工作台共用控件代码、语义参数和动效规则。</p><div id="samples"></div></main><script>
const G=GridTone,B=G.ui.Button;
document.querySelector('#samples').innerHTML=['primary','secondary','quiet','danger'].map(variant=>'<section><h2>'+variant+'</h2><div class="sample-row">'+[{}, {pressed:true},{disabled:true},{busy:true}].map(state=>B({action:'sample',label:state.busy?'处理中':state.disabled?'不可用':state.pressed?'已选中':'常规操作',variant,...state})).join('')+B({action:'sample',label:'长中文：将当前片段保存为独立变化',variant})+'</div></section>').join('')+'<section><h2>图标与数值</h2><div class="sample-row">'+B({action:'sample',label:'播放',icon:'play',size:'icon'})+G.ui.slider('音量','track','volume',.65)+'</div></section>'+ '<section><h2>开关、输入和分组</h2>'+G.ui.Toggle({field:'example',label:'减少动态效果',checked:true})+G.ui.Field({field:'example-value',label:'变化种子',type:'number',value:42,min:0})+G.ui.SegmentedControl({label:'候选',action:'sample',value:'a',items:[['a','方案一'],['b','方案二']]})+G.ui.MenuItem({action:'sample',label:'菜单操作'})+'</section>'+G.ui.TemplateCard({id:'example',kind:'templates',title:'轻快流行',summary:'4 小节 · 和弦与旋律',description:'先试听，再继续编辑。'})+G.ui.CandidateBar({count:3,chosen:0,actions:B({action:'sample',label:'应用',variant:'primary'})});
</script>`;
const componentPage=header+resources.styles.map(f=>`<link rel="stylesheet" href="${f}">`).join('\n')+'</head><body><script src="src/model.js"></script><script src="src/ui/components.js"></script>'+componentBody+'</body></html>';
await writeFile(resolve(root,'components.html'),componentPage);
