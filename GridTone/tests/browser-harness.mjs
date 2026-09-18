import {chromium,firefox,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function harness({html,browserType='chromium',launchOptions={}}={}){
 const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root))throw Error();res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(html&&file===root+'dist/index.html'?html:await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await ({chromium,firefox,webkit}[browserType]).launch({headless:true,...(browserType==='chromium'&&process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{}),...launchOptions});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/dist/index.html`;
 await page.goto(url);await page.waitForFunction(()=>window.GridToneApp && !/正在/.test(GridToneApp.getState().saveStatus));
 const output=resolve(root,process.env.EVIDENCE_DIR||'docs/implementation/evidence');await mkdir(output,{recursive:true});
 const sha256=createHash('sha256').update(html||await readFile(root+'dist/index.html')).digest('hex');
 return {browser,context,page,url,output,errors,sha256,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}
