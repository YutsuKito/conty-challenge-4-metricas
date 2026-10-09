import {fail,required} from './http.js';
// A fronteira com o provedor exige apenas fetchPosts; HTTP/OAuth reais ficam fora.
export class FakeProvider {
 constructor(responses=[]) {this.responses=[...responses];this.calls=0;}
 async fetchPosts(){this.calls++;const item=this.responses.shift()??{posts:[]};if(item.error) throw Object.assign(new Error(item.error),{status:item.status||503,code:item.code,retryAfter:item.retryAfter});return item;}
}
export function createService({provider=new FakeProvider(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>new Date(),maxAttempts=3,maxWaitMs=3000}={}) {
 required(Number.isSafeInteger(maxAttempts)&&maxAttempts>0,'Limite de tentativas inválido');
 required(Number.isFinite(maxWaitMs)&&maxWaitMs>=0,'Teto de espera inválido');
 const posts=new Map(), snapshots=new Map(),syncs=[];
 function waitFor(error, attempt){
   if(error.status===429){const header=error.retryAfter;let ms;
     if(typeof header==='string'&&header.trim()!==''&&Number.isFinite(Number(header))) ms=Math.max(0,Number(header)*1000);
     else if(typeof header==='number'&&Number.isFinite(header)) ms=Math.max(0,header*1000);
     else if(typeof header==='string'&&Number.isFinite(Date.parse(header))) ms=Math.max(0,Date.parse(header)-now().getTime());
     else ms=1000;return Math.min(maxWaitMs,ms);}
   return Math.min(maxWaitMs,Math.pow(2,attempt-1)*100);
 }
 return {
 async sync({connection_id,from,to}){
   required(typeof connection_id==='string'&&!!connection_id,'Conexão obrigatória');required(typeof from==='string'&&typeof to==='string'&&Number.isFinite(Date.parse(from))&&Number.isFinite(Date.parse(to))&&Date.parse(from)<=Date.parse(to),'Janela inválida');
   let data;let attempts=0;
   while(attempts<maxAttempts) {
     attempts++;
     try {data=await provider.fetchPosts({connection_id,from,to});break;}
     catch(e){if(!([408,429,500,502,503,504].includes(e.status)||e.code==='ETIMEDOUT')||attempts===maxAttempts) fail(`Sincronização falhou após ${attempts} tentativa(s): ${e.message}`,503);
       await sleep(waitFor(e,attempts));}
   }
   if(!data||!Array.isArray(data.posts)) fail('Resposta do provedor inválida',502);
   // Validate the whole batch before changing either map. A late conflict must not
   // leave earlier snapshots partially committed.
   const staged=new Map(),batch=[];
   for(const x of data.posts){
     required(x&&typeof x.post_id==='string'&&x.post_id.length>0&&Number.isSafeInteger(x.views)&&x.views>=0&&typeof x.captured_at==='string'&&Number.isFinite(Date.parse(x.captured_at)),'Snapshot inválido');
     const normalized={post_id:x.post_id,views:x.views,captured_at:new Date(x.captured_at).toISOString()};
     const signature=JSON.stringify([connection_id,normalized.post_id,normalized.captured_at]);
     const previous=staged.get(signature)??snapshots.get(signature);
     if(previous&&previous.views!==normalized.views) fail('Snapshot contraditório',409);
     staged.set(signature,normalized);batch.push(normalized);
   }
   const fetchedAt=now().toISOString();
   let added=0,updated=0,unchanged=0;
   for(const x of batch){
     const key=JSON.stringify([connection_id,x.post_id]);
     const signature=JSON.stringify([connection_id,x.post_id,x.captured_at]);
     const old=snapshots.get(signature);
     if(old){if(old.views!==x.views) fail('Snapshot contraditório',409);unchanged++;continue;}
     const snap={connection_id,post_id:x.post_id,views:x.views,captured_at:x.captured_at,fetched_at:fetchedAt};snapshots.set(signature,snap);
     const prev=posts.get(key);
     if(!prev||Date.parse(x.captured_at)>Date.parse(prev.captured_at)){posts.set(key,snap);prev?updated++:added++;}
   }
   const result={connection_id,from,to,attempts,added,updated,unchanged,fetched_at:fetchedAt,total_posts:[...posts.values()].filter(p=>p.connection_id===connection_id).length};syncs.push(result);return structuredClone(result);
 },
 metrics(connection_id){const records=[...posts.values()].filter(x=>x.connection_id===connection_id);return structuredClone({connection_id,total_views:records.reduce((n,x)=>n+x.views,0),posts:records,history:[...snapshots.values()].filter(x=>x.connection_id===connection_id),syncs:syncs.filter(x=>x.connection_id===connection_id)});}
 };
}
