import { createServer } from 'node:http';
export function http(service, routes) {
  return createServer(async (req,res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      for (const [method, pattern, handler] of routes) {
        const m = req.method === method && path.match(pattern);
        if (!m) continue;
        let body = {};
        if (method !== 'GET') {
          const chunks = []; for await (const c of req) chunks.push(c);
          const raw=Buffer.concat(chunks).toString('utf8');
          if (raw.length > 1_000_000) throw Object.assign(new Error('Payload muito grande'),{status:413});
          try { body=raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('JSON inválido'),{status:400}); }
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Corpo JSON deve ser objeto'),{status:400});
        let params;
        try { params=m.slice(1).map(value=>decodeURIComponent(value)); }
        catch { throw Object.assign(new Error('Parâmetro de rota inválido'),{status:400}); }
        const result = await handler(service, body, ...params);
        res.writeHead(200,{'content-type':'application/json; charset=utf-8'});
        res.end(JSON.stringify(result)); return;
      }
      res.writeHead(404,{'content-type':'application/json'}); res.end(JSON.stringify({error:'Rota não encontrada'}));
    } catch(e) {const status = e.status||500;res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}
  });
}
export function fail(message,status=400) {throw Object.assign(new Error(message),{status});}
export function required(condition,message) {if(!condition) fail(message);}
