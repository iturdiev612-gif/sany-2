import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.webp':'image/webp'};
const assets={};
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())await walk(name);else if(!name.endsWith('.map')){const key='/'+path.relative('build',name).split(path.sep).join('/');assets[key]={body:(await fs.readFile(name)).toString('base64'),type:types[path.extname(name)]||'application/octet-stream'};}}}
await walk('build');
const api=await fs.readFile('server/api.mjs','utf8');const catalog=JSON.parse(await fs.readFile('src/data/catalog.json','utf8'));
const worker=`${api}\nconst assets=${JSON.stringify(assets)};\nconst api=createApi(${JSON.stringify(catalog)});\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);const key=url.pathname==='/'?'/index.html':url.pathname;const asset=assets[key]||(!/\\.[^/]+$/.test(key)?assets['/index.html']:null);if(!asset)return new Response('Not found',{status:404});const body=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':asset.type,'Cache-Control':asset.type.startsWith('text/html')?'no-cache':'public, max-age=86400','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});}};`;
await fs.writeFile('dist/server/index.js',worker);await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Worker built: ${Object.keys(assets).length} assets, ${(Buffer.byteLength(worker)/1024/1024).toFixed(2)} MB`);
