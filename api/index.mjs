import {readFile} from 'node:fs/promises';
import {createApi} from '../server/api.mjs';
import {configuredBucket} from '../server/redis-bucket.mjs';

const catalog=JSON.parse(await readFile(new URL('../src/data/catalog.json',import.meta.url),'utf8'));
const api=createApi(catalog);

export default {
 async fetch(request){
  try{
   // Vercel sets this header at its proxy; do not trust CF-Connecting-IP here.
   const headers=new Headers(request.headers);headers.delete('CF-Connecting-IP');
   const trustedIp=headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown';
   const url=new URL(request.url);
   // Explicit rewrite supports nested admin routes without Next.js catch-all routing.
   // Some Vercel handlers retain the original pathname; others see the destination.
   if(url.pathname==='/api/index'&&url.searchParams.has('__path')){
    const route=url.searchParams.get('__path');
    if(!/^[a-zA-Z0-9/_-]*$/.test(route))return Response.json({error:'Not found'},{status:404});
    url.pathname='/api/'+route;url.searchParams.delete('__path');
   }
   return await api(new Request(url,new Request(request,{headers})),{BUCKET:configuredBucket(),ADMIN_PASSWORD_SHA256:process.env.ADMIN_PASSWORD_SHA256,LOCAL_IP:trustedIp});
  }catch{
   return Response.json({error:'Service temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
 }
};
