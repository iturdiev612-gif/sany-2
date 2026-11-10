// Durable R2-compatible JSON storage over the Upstash Redis REST API.
// Credentials are server-only; this module is never imported by the React client.
import {randomUUID} from 'node:crypto';

const compareAndSet=`local current = redis.call('GET', KEYS[1])
if ARGV[1] == 'absent' and current then return 0 end
if ARGV[1] == 'match' then
  if not current then return 0 end
  local ok, record = pcall(cjson.decode, current)
  if not ok or record.version ~= ARGV[2] then return 0 end
end
redis.call('SET', KEYS[1], ARGV[3])
if tonumber(ARGV[4]) > 0 then redis.call('EXPIRE', KEYS[1], ARGV[4]) end
return 1`;

export class RedisBucket {
 constructor({url,token,prefix='sany:',fetchImpl=fetch}){
  if(!/^https:\/\//.test(url)||!token)throw new Error('Redis HTTPS URL and token are required');
  if(!/^[a-zA-Z0-9:_-]{1,80}$/.test(prefix))throw new Error('Invalid storage namespace');
  this.url=url.replace(/\/$/,'');this.token=token;this.prefix=prefix;this.fetch=fetchImpl;
 }
 key(value){if(!/^[a-zA-Z0-9/_-]+$/.test(value))throw new Error('Invalid storage key');return this.prefix+value;}
 async command(args){
  const response=await this.fetch(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Storage request failed');
  const data=await response.json();if(data.error)throw new Error('Storage command failed');return data.result;
 }
 async get(key){
  const raw=await this.command(['GET',this.key(key)]);if(raw===null)return null;
  const record=JSON.parse(raw);return {etag:record.version,json:async()=>JSON.parse(record.value)};
 }
 async put(key,value,{onlyIf}={}){
  const version=randomUUID(),record=JSON.stringify({version,value});
  const condition=onlyIf?.etagDoesNotMatch==='*'?'absent':onlyIf?.etagMatches!==undefined?'match':'any';
  const lifetime=key.startsWith('rates/')?86400:key.startsWith('sessions/')?28800:0;
  const result=await this.command(['EVAL',compareAndSet,'1',this.key(key),condition,onlyIf?.etagMatches||'',record,String(lifetime)]);
  return result===1?{etag:version}:null;
 }
 async delete(key){await this.command(['DEL',this.key(key)]);}
 async list({prefix='',cursor='0',limit=1000}={}){
  if(prefix&&!/^[a-zA-Z0-9/_-]+$/.test(prefix))throw new Error('Invalid storage prefix');
  const [next,keys]=await this.command(['SCAN',String(cursor),'MATCH',this.prefix+prefix+'*','COUNT',String(Math.min(Math.max(limit,1),1000))]);
  return {objects:keys.map(key=>({key:key.slice(this.prefix.length)})),truncated:String(next)!=='0',cursor:String(next)};
 }
}

export function configuredBucket(env=process.env){
 const url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL;
 const token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;
 if(!url&&!token)return null;
 if(!url||!token)throw new Error('Incomplete durable storage configuration');
 return new RedisBucket({url,token,prefix:env.SANY_STORAGE_PREFIX||'sany:'});
}
