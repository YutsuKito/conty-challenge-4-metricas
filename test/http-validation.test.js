import test from 'node:test';import assert from 'node:assert/strict';import {http} from '../src/http.js';
async function withServer(run){
  let calls=0;
  const server=http({},[
    ['POST',/^\/body$/,(_service,body)=>{calls++;return body;}],
    ['GET',/^\/codes\/([^/]+)$/,(_service,_body,code)=>{calls++;return {code};}],
  ]);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await run(`http://127.0.0.1:${server.address().port}`,()=>calls);}
  finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('JSON inválido ou não objeto retorna 400 antes de chamar o serviço',async()=>{
  await withServer(async(url,calls)=>{
    for(const body of ['null','[]','"text"','5','true','invalid']){
      const response=await fetch(url+'/body',{method:'POST',headers:{'content-type':'application/json'},body});
      assert.equal(response.status,400);await response.text();
    }
    assert.equal(calls(),0);
  });
});
test('parâmetros de rota são decodificados; escape inválido retorna 400',async()=>{
  await withServer(async(url,calls)=>{
    const code='A/B ? ç';const response=await fetch(url+'/codes/'+encodeURIComponent(code));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{code});
    const bad=await fetch(url+'/codes/%ZZ');assert.equal(bad.status,400);await bad.text();
    assert.equal(calls(),1);
  });
});
