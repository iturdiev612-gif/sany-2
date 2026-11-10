// Shared by the local server, Vercel Functions and Cloudflare Worker.
export function createApi(catalog) {
 const categories = ['tractors','cranes','dump','concrete','trailers'];
 const imageIds = new Set(catalog.map(product=>product.image));
 const rateQueues = new Map();
 const encoder = new TextEncoder();
 const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
 const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const get = async (bucket,key) => { const object = await bucket.get(key); return object ? object.json() : null; };
 const put = (bucket,key,value) => bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
 async function list(bucket,prefix){let cursor;const values=[];do {const page=await bucket.list({prefix,cursor,limit:1000}); const objects=await Promise.all(page.objects.map(o=>get(bucket,o.key)));values.push(...objects.filter(Boolean));cursor=page.truncated?page.cursor:undefined;}while(cursor);return values;}
 async function products(bucket,admin=false){const overrides=await list(bucket,'products/');const map=new Map(catalog.map(p=>[p.id,{...p,visible:true,availability:'onRequest',price:'',power:'',capacity:'',year:''}]));for(const p of overrides)map.set(p.id,{...(map.get(p.id)||{}),...p});return [...map.values()].filter(p=>!p.deleted&&(admin||p.visible));}
 const safeString=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
 const localized=(obj,max)=>Object.fromEntries(['ru','ky','en'].map(l=>[l,safeString(obj?.[l],max)]));
 async function body(request){if(Number(request.headers.get('Content-Length'))>32768)throw new Error('BODY_TOO_LARGE');const raw=await request.text();if(encoder.encode(raw).byteLength>32768)throw new Error('BODY_TOO_LARGE');try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_JSON');return value;}catch{throw new Error('INVALID_JSON');}}
 function limited(bucket,key,max,windowMs){
  // Serialize each counter locally; conditional R2 writes also protect across isolates.
  const task=(rateQueues.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
   for(let attempt=0;attempt<12;attempt++){
    const object=await bucket.get(key),current=object?await object.json():null,now=Date.now();
    const record=current&&current.start+windowMs>now?current:{start:now,count:0};
    if(record.count>=max)return true;
    record.count++;
    const onlyIf=!object?{etagDoesNotMatch:'*'}:typeof object.etag==='string'?{etagMatches:object.etag}:undefined;
    const result=await bucket.put(key,JSON.stringify(record),{httpMetadata:{contentType:'application/json'},...(onlyIf?{onlyIf}:{})});
    if(result!==null)return false; // Local filesystem adapters may return undefined.
   }
   return true; // Fail closed if another isolate keeps winning the compare-and-set.
  });
  rateQueues.set(key,task);
  return task.finally(()=>{if(rateQueues.get(key)===task)rateQueues.delete(key);});
 }
 return async function api(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method,bucket=env.BUCKET;
  const capabilities={admin:!!(bucket&&env.ADMIN_PASSWORD_SHA256),leads:!!bucket};
  const defaultSettings={phone:'+996 707 108 410'};
  if(!['GET','HEAD'].includes(method)){
   const origin=request.headers.get('Origin');
   if(origin&&origin!==url.origin)return json({error:'Forbidden origin'},403);
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
  }
  try {
   // The public catalog and WhatsApp booking work without a database on Vercel.
   // Never acknowledge saved leads when durable storage has not been configured.
   if(!bucket){
    if(path==='/api/products'&&method==='GET')return json({products:catalog.filter(p=>p.visible!==false&&!p.deleted).map(p=>({visible:true,availability:'onRequest',price:'',power:'',capacity:'',year:'',...p})),settings:defaultSettings,capabilities});
    if(path==='/api/admin/session'&&method==='GET')return json({authenticated:false,configured:false});
    if(path==='/api/visit'&&method==='POST')return json({ok:true,tracked:false});
    if(path.startsWith('/api/admin/')||path==='/api/leads')return json({error:'Durable storage is not configured. Please use WhatsApp to contact the dealership.',code:'STORAGE_NOT_CONFIGURED'},503);
    return json({error:'Not found'},404);
   }
   const ip=request.headers.get('CF-Connecting-IP')||env.LOCAL_IP||'local';
   const ipKey=await hash(`${env.ADMIN_PASSWORD_SHA256||'sany'}:${ip}`);
   let auth=null;
   const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)sany_session=([a-zA-Z0-9-]+)/)?.[1];
   if(token){const sessionKey=await hash(token);const session=await get(bucket,`sessions/${sessionKey}`);if(session?.expires>Date.now())auth={...session,key:sessionKey};}
   if(path==='/api/products'&&method==='GET')return json({products:await products(bucket),settings:{...defaultSettings,...await get(bucket,'settings/contact')},capabilities});
   if(path==='/api/visit'&&method==='POST'){
    const data=await body(request);const id=safeString(data.id,60);if(!/^[a-zA-Z0-9-]{16,60}$/.test(id))return json({error:'Invalid visit'},400);
    const day=new Date().toISOString().slice(0,10);const idHash=await hash(`${day}:${id}`);await put(bucket,`visits/${day}/${idHash}`,{day});return json({ok:true});
   }
   if(path==='/api/leads'&&method==='POST'){
    const data=await body(request);const name=safeString(data.name,100),phone=safeString(data.phone,40),message=safeString(data.message,2000);
    if(data.website)return json({ok:true,id:crypto.randomUUID()});
    const digits=phone.replace(/\D/g,'');
    if(name.length<2||digits.length<7||digits.length>15||!/^[+\d\s().-]+$/.test(phone)||data.consent!==true)return json({error:'Invalid contact details or consent'},400);
    if(await limited(bucket,`rates/leads/${ipKey}`,5,10*60*1000))return json({error:'Too many requests'},429);
    const all=await products(bucket);const selected=all.find(p=>p.id===data.productId);
    if(data.productId&&!selected)return json({error:'Product unavailable'},400);
    const lead={id:crypto.randomUUID(),name,phone,message,productId:selected?.id||null,productName:selected?.name||null,language:['ru','ky','en'].includes(data.language)?data.language:'ru',status:'new',consentAt:new Date().toISOString(),createdAt:new Date().toISOString()};
    await put(bucket,`leads/${lead.id}`,lead);return json({ok:true,id:lead.id},201);
   }
   if(path==='/api/admin/login'&&method==='POST'){
    if(!env.ADMIN_PASSWORD_SHA256)return json({error:'Admin not configured'},503);
    if(await limited(bucket,`rates/login/${ipKey}`,8,15*60*1000))return json({error:'Try again later'},429);
    const data=await body(request);const digest=await hash(safeString(data.password,200));let difference=digest.length^env.ADMIN_PASSWORD_SHA256.length;for(let i=0;i<digest.length;i++)difference|=digest.charCodeAt(i)^env.ADMIN_PASSWORD_SHA256.charCodeAt(i);if(difference)return json({error:'Invalid credentials'},401);
    const sessionToken=crypto.randomUUID()+'-'+crypto.randomUUID();const sessionKey=await hash(sessionToken);const expires=Date.now()+8*60*60*1000;await put(bucket,`sessions/${sessionKey}`,{expires});const secure=url.protocol==='https:'?'; Secure':'';
    return json({ok:true},200,{'Set-Cookie':`sany_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`});
   }
   if(path==='/api/admin/session'&&method==='GET')return json({authenticated:!!auth});
   if(path.startsWith('/api/admin/')){
    if(!auth)return json({error:'Unauthorized'},401);
    if(path==='/api/admin/logout'&&method==='POST'){await bucket.delete(`sessions/${auth.key}`);return json({ok:true},200,{'Set-Cookie':`sany_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${url.protocol==='https:'?'; Secure':''}`});}
    if(path==='/api/admin/data'&&method==='GET'){
     const [leads,visits,items,settings]=await Promise.all([list(bucket,'leads/'),list(bucket,'visits/'),products(bucket,true),get(bucket,'settings/contact')]);
     return json({leads:leads.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),products:items,settings:settings||{},stats:{visitors:visits.length,totalLeads:leads.length,newLeads:leads.filter(l=>l.status==='new').length,activeProducts:items.filter(p=>p.visible).length}});
    }
    if(path.startsWith('/api/admin/leads/')&&method==='PATCH'){
     const id=path.split('/').pop();if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Not found'},404);const lead=await get(bucket,`leads/${id}`);if(!lead)return json({error:'Not found'},404);const data=await body(request);if(!['new','work','done'].includes(data.status))return json({error:'Invalid status'},400);lead.status=data.status;await put(bucket,`leads/${id}`,lead);return json({ok:true});
    }
    if(path.startsWith('/api/admin/products/')&&['PUT','DELETE'].includes(method)){
     const id=path.split('/').pop();if(!/^[a-z0-9-]{3,80}$/.test(id))return json({error:'Invalid id'},400);
     if(method==='DELETE'){await put(bucket,`products/${id}`,{id,deleted:true});return json({ok:true});}
     const data=await body(request);const p={id,name:safeString(data.name,120),brand:safeString(data.brand,40),category:data.category,image:safeString(data.image,80),axles:safeString(data.axles,30),color:localized(data.color,60),description:localized(data.description,1800),visible:data.visible!==false,price:safeString(data.price,80),availability:data.availability,power:safeString(data.power,80),capacity:safeString(data.capacity,80),year:safeString(data.year,30),deleted:false};
     if(!p.name||!p.brand||!categories.includes(p.category)||!imageIds.has(p.image)||!['onRequest','inStock','toOrder'].includes(p.availability)||['ru','ky','en'].some(l=>!p.description[l]))return json({error:'Invalid product'},400);
     await put(bucket,`products/${id}`,p);return json({ok:true});
    }
    if(path==='/api/admin/settings'&&method==='PUT'){
     const data=await body(request);const settings={phone:safeString(data.phone,40),email:safeString(data.email,150),address:safeString(data.address,250)};
     if(settings.phone&&!/^[+\d\s().-]{7,40}$/.test(settings.phone))return json({error:'Invalid phone'},400);
     if(settings.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))return json({error:'Invalid email'},400);
     await put(bucket,'settings/contact',settings);return json({ok:true});
    }
   }
   return json({error:'Not found'},404);
  }catch(error){return json({error:['INVALID_JSON','BODY_TOO_LARGE'].includes(error.message)?error.message:'Request failed'},['INVALID_JSON','BODY_TOO_LARGE'].includes(error.message)?400:500);}
 };
}
