/** Optional local development server. Browsing the standalone HTML needs no server. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||8000);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.wav':'audio/wav','.mid':'audio/midi','.gridtone':'application/json','.gridtonepack':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  const info=await stat(file),target=info.isDirectory()?resolve(file,'index.html'):file;
  const bytes=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`乐构已启动：http://localhost:${port}\n按 Ctrl+C 停止。`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
