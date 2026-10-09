import test from 'node:test';import assert from 'node:assert/strict';
import {createService,FakeProvider} from '../src/service.js';
const window={connection_id:'a',from:'2026-10-01T12:00:00Z',to:'2026-10-01T10:00:00-03:00'};
const post={post_id:'p',views:10,captured_at:'2026-10-01T12:00:00Z'};
test('janela usa ordem cronológica e não comparação textual de fusos',async()=>{
  const service=createService({provider:new FakeProvider([{posts:[post]}])});
  await service.sync(window);assert.equal(service.metrics('a').total_views,10);
});
test('instantes equivalentes deduplicam; métrica recente com outro fuso substitui',async()=>{
  const provider=new FakeProvider([{posts:[post]},{posts:[{...post,captured_at:'2026-10-01T09:00:00-03:00'}]},{posts:[{...post,views:20,captured_at:'2026-10-01T10:00:00-03:00'}]}]);
  const service=createService({provider});const input={...window,to:'2026-10-02T00:00:00Z'};
  await service.sync(input);await service.sync(input);
  assert.equal(service.metrics('a').history.length,1);
  await service.sync(input);assert.equal(service.metrics('a').total_views,20);
});
test('identificadores com dois pontos não misturam conexões e posts',async()=>{
  const provider=new FakeProvider([{posts:[{...post,post_id:'c'}]},{posts:[{...post,post_id:'b:c',views:30}]}]);
  const service=createService({provider});const input={...window,to:'2026-10-02T00:00:00Z'};
  await service.sync({...input,connection_id:'a:b'});await service.sync(input);
  assert.equal(service.metrics('a:b').total_views,10);assert.equal(service.metrics('a').total_views,30);
});
test('respostas são cópias e não permitem alterar snapshots ou histórico',async()=>{
  const service=createService({provider:new FakeProvider([{posts:[post]}])});
  await service.sync({...window,to:'2026-10-02T00:00:00Z'});
  const output=service.metrics('a');output.posts[0].views=999;output.history[0].views=999;output.syncs[0].attempts=999;
  assert.equal(service.metrics('a').total_views,10);assert.equal(service.metrics('a').syncs[0].attempts,1);
});
test('snapshot nulo no fim do lote retorna 400 sem gravar e retry inválido é rejeitado',async()=>{
  const service=createService({provider:new FakeProvider([{posts:[post,null]}])});
  await assert.rejects(()=>service.sync({...window,to:'2026-10-02T00:00:00Z'}),{status:400});
  assert.equal(service.metrics('a').history.length,0);
  assert.throws(()=>createService({maxAttempts:0}),{status:400});
});
