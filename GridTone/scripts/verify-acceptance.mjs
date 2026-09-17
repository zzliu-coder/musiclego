/** A release cannot be green while required listening or other checks are pending. */
import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let pending=[];
try{
 const report=JSON.parse(await readFile(root+'docs/implementation/acceptance.json','utf8')),manifest=JSON.parse(await readFile(root+'dist/manifest.json','utf8'));
 if(report.tests.length!==87||report.sha256!==manifest.sha256)throw Error('验收表数量或构建身份不匹配。');
 pending=report.tests.filter(t=>t.priority==='required'&&!['PASS','NOT_APPLICABLE'].includes(t.status));
 for(const item of pending)console.error(item.id,item.status,item.title,item.notes||'');
 if(pending.length){console.error(`严格发行门槛尚未通过：${pending.length} 个必需项待完成。工程候选版可运行。`);process.exitCode=2;}else console.log('Full acceptance passed.');
}catch(e){console.error(e.message);process.exitCode=1;}
