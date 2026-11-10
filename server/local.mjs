import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApi} from './api.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'src/data/catalog.json'),'utf8'));
const storage=process.env.SANY_DATA_DIR?path.resolve(process.env.SANY_DATA_DIR):path.join(root,'.data');
class FileBucket {
 filename(key){if(!/^[a-zA-Z0-9/_-]+$/.test(key))throw new Error('Invalid storage key');return path.join(storage,key+'.json');}
 async get(key){try{const value=await fs.readFile(this.filename(key),'utf8');return {json:()=>JSON.parse(value)};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async put(key,value){const name=this.filename(key);await fs.mkdir(path.dirname(name),{recursive:true});const temp=name+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,value,{mode:0o600});await fs.rename(temp,name);}
 async delete(key){await fs.rm(this.filename(key),{force:true});}
 async list({prefix='',cursor,limit=1000}){const all=[];async function walk(dir){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}for(const e of entries){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.name.endsWith('.json')){const key=path.relative(storage,f).replaceAll(path.sep,'/').slice(0,-5);if(key.startsWith(prefix))all.push({key});}}}await walk(storage);all.sort((a,b)=>a.key.localeCompare(b.key));const start=Number(cursor)||0;return {objects:all.slice(start,start+limit),truncated:all.length>start+limit,cursor:String(start+limit)};}
}
const api=createApi(catalog);const bucket=new FileBucket();
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${req.headers.host}`);
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
  if(url.pathname.startsWith('/api/')){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768){res.writeHead(413,headers);res.end();return;}chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const result=await api(request,{BUCKET:bucket,ADMIN_PASSWORD_SHA256:process.env.ADMIN_PASSWORD_SHA256,LOCAL_IP:req.socket.remoteAddress});
   res.writeHead(result.status,{...headers,...Object.fromEntries(result.headers)});res.end(Buffer.from(await result.arrayBuffer()));return;
  }
  const publicRoot=path.join(root,'build');let name=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
  if(!name.startsWith(publicRoot+path.sep)&&name!==publicRoot){res.writeHead(403);res.end();return;}
  let data;try{data=await fs.readFile(name);}catch(e){if(path.extname(url.pathname)){res.writeHead(404,headers);res.end();return;}name=path.join(publicRoot,'index.html');data=await fs.readFile(name);}
  res.writeHead(200,{...headers,'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':name.endsWith('index.html')?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(500);res.end('Server error');}
});
const port=Number(process.env.PORT)||4173;
server.listen(port,'127.0.0.1',()=>console.log(`SANY is ready at http://127.0.0.1:${port}`));
