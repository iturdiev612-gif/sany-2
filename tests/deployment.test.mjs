import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createApi} from '../server/api.mjs';
import {RedisBucket,configuredBucket} from '../server/redis-bucket.mjs';
import vercelHandler from '../api/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../src/data/catalog.json',import.meta.url),'utf8'));

test('Vercel public catalog needs no storage, never claims a lead was saved',async()=>{
 const api=createApi(catalog);
 const response=await api(new Request('https://sany.test/api/products'),{});
 const data=await response.json();
 assert.equal(response.status,200);
 assert.equal(data.settings.phone,'+996 707 108 410');
 assert.deepEqual(data.capabilities,{admin:false,leads:false});
 assert.ok(data.products.length>0);
 assert.deepEqual(await (await api(new Request('https://sany.test/api/admin/session'),{})).json(),{authenticated:false,configured:false});
 const lead=await api(new Request('https://sany.test/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{});
 assert.equal(lead.status,503);
 assert.equal((await lead.json()).code,'STORAGE_NOT_CONFIGURED');
 assert.equal((await api(new Request('https://sany.test/api/unknown'),{})).status,404);
});

function redisMock(){
 const values=new Map(),calls=[];
 const fetchImpl=async(url,options)=>{
  const args=JSON.parse(options.body);calls.push(args);
  let result;
  if(args[0]==='GET')result=values.get(args[1])??null;
  else if(args[0]==='DEL'){values.delete(args[1]);result=1;}
  else if(args[0]==='SCAN'){
   const keys=[...values.keys()].filter(key=>key.startsWith(args[3].slice(0,-1)));
   result=['0',keys];
  }else if(args[0]==='EVAL'){
   // Emulate the one atomic server operation, including a version change per write.
   const [,script,count,key,condition,expected,next]=args;
   assert.equal(count,'1');
   assert.match(script,/redis\.call\('GET', KEYS\[1\]\)/);
   assert.match(script,/record\.version ~= ARGV\[2\]/);
   assert.match(script,/redis\.call\('SET', KEYS\[1\], ARGV\[3\]\)/);
   const old=values.get(key);
   if((condition==='absent'&&old!==undefined)||(condition==='match'&&(!old||JSON.parse(old).version!==expected)))result=0;
   else{values.set(key,next);result=1;}
  }else throw new Error('Unexpected Redis command');
  return Response.json({result});
 };
 return {values,calls,fetchImpl};
}

test('durable Redis bucket preserves JSON and rejects stale or competing writes',async()=>{
 const mock=redisMock(),options={url:'https://redis.test',token:'test-only',fetchImpl:mock.fetchImpl};
 const first=new RedisBucket(options),second=new RedisBucket(options);
 assert.equal(await first.get('settings/contact'),null);
 const created=await first.put('settings/contact',JSON.stringify({phone:'+996707108410'}),{onlyIf:{etagDoesNotMatch:'*'}});
 assert.ok(created.etag);
 assert.equal(await second.put('settings/contact','{}',{onlyIf:{etagDoesNotMatch:'*'}}),null);
 const a=await first.get('settings/contact'),b=await second.get('settings/contact');
 assert.deepEqual(await a.json(),{phone:'+996707108410'});
 assert.ok(await first.put('settings/contact','{"phone":"changed"}',{onlyIf:{etagMatches:a.etag}}));
 assert.equal(await second.put('settings/contact','{}',{onlyIf:{etagMatches:b.etag}}),null);
 assert.equal((await first.get('settings/contact')).etag===a.etag,false);
 assert.deepEqual((await first.list({prefix:'settings/'})).objects,[{key:'settings/contact'}]);
 await first.delete('settings/contact');assert.equal(await first.get('settings/contact'),null);
});

test('Redis bucket keeps pagination and expiry, fails closed on storage errors',async()=>{
 let pages=0;
 const bucket=new RedisBucket({url:'https://redis.test',token:'test-only',fetchImpl:async(url,options)=>{
  const args=JSON.parse(options.body);
  if(args[0]==='SCAN'){
   assert.equal(args[1],pages===0?'0':'19');
   return Response.json({result:pages++===0?['19',[]]:['0',['sany:products/item']]});
  }
  return Response.json({error:'server error'});
 }});
 const page=await bucket.list({prefix:'products/'});
 assert.equal(page.truncated,true);
 assert.deepEqual(await bucket.list({prefix:'products/',cursor:page.cursor}),{objects:[{key:'products/item'}],truncated:false,cursor:'0'});
 await assert.rejects(bucket.get('settings/contact'),/Storage command failed/);
 const mock=redisMock(),expiring=new RedisBucket({url:'https://redis.test',token:'test-only',fetchImpl:mock.fetchImpl});
 await expiring.put('sessions/test','{}');await expiring.put('rates/login/test','{}');
 assert.deepEqual(mock.calls.map(args=>args.at(-1)),['28800','86400']);
 assert.equal(configuredBucket({}),null);
 assert.throws(()=>configuredBucket({UPSTASH_REDIS_REST_URL:'https://redis.test'}),/Incomplete/);
 assert.throws(()=>new RedisBucket({url:'http://redis.test',token:'x'}),/HTTPS/);
});

test('Redis atomic conditional writes enforce login limit across API instances',async()=>{
 const mock=redisMock();
 const bucket=new RedisBucket({url:'https://redis.test',token:'test-only',fetchImpl:mock.fetchImpl});
 const env={BUCKET:bucket,ADMIN_PASSWORD_SHA256:createHash('sha256').update('test-only-secret').digest('hex'),LOCAL_IP:'same-test-client'};
 const responses=await Promise.all(Array.from({length:20},()=>createApi(catalog)(new Request('https://sany.test/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"wrong"}'}),env)));
 assert.equal(responses.filter(r=>r.status===401).length,8);
 assert.equal(responses.filter(r=>r.status===429).length,12);
});

test('Vercel adapter uses public fallback and configuration routes booking refreshes',async()=>{
 const names=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'];
 const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try{
  names.forEach(name=>delete process.env[name]);
  const response=await vercelHandler.fetch(new Request('https://deployment.test/api/products'));
  assert.equal(response.status,200);assert.ok((await response.json()).products.length);
  const rewritten=await vercelHandler.fetch(new Request('https://deployment.test/api/index?__path=products'));
  assert.equal(rewritten.status,200);assert.ok((await rewritten.json()).products.length);
  assert.equal((await vercelHandler.fetch(new Request('https://deployment.test/api/index?__path=admin/session'))).status,200);
  const post=await vercelHandler.fetch(new Request('https://deployment.test/api/index?__path=leads',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
  assert.equal(post.status,503);
 }finally{for(const name of names){if(prior[name]===undefined)delete process.env[name];else process.env[name]=prior[name];}}
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.outputDirectory,'build');
 assert.deepEqual(config.rewrites[0],{source:'/api/:path*',destination:'/api/index?__path=:path*'});
 const routes=config.rewrites.slice(1).map(route=>({pattern:new RegExp('^'+route.source+'$'),destination:route.destination}));
 for(const route of ['/','/booking','/booking/'])assert.equal(routes.find(r=>r.pattern.test(route))?.destination,'/index.html');
 for(const route of ['/api/products','/api/admin/data','/assets/truck-01.webp','/static/js/main.js','/favicon.svg'])assert.equal(routes.some(r=>r.pattern.test(route)),false,route);
});
