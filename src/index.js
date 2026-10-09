import {http} from './http.js';import {createService,FakeProvider} from './service.js';
const provider=new FakeProvider([{posts:[{post_id:'video-1',views:1000,captured_at:'2026-10-01T12:00:00Z'}]}]);
export function createApp(service=createService({provider})){return http(service,[['POST',/^\/sync$/, (s,b)=>s.sync(b)],['GET',/^\/metrics\/([^/]+)$/, (s,b,id)=>s.metrics(id)]]);}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)createApp().listen(3004,()=>console.log('http://localhost:3004'));
