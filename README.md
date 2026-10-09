# Desafio 4 — Métricas das redes do criador

Serviço Node 22 com interface de provedor (`fetchPosts`) e `FakeProvider`; token de acesso e OAuth reais fora de escopo. Endpoints `POST /sync`, `GET /metrics/:connectionId`. O adapter simulado pode ser trocado sem modificar o domínio.

```bash
npm test && npm run typecheck
npm start
curl -X POST http://localhost:3004/sync -H 'Content-Type: application/json' -d '{"connection_id":"acc-1","from":"2026-09-01T00:00:00Z","to":"2026-10-02T00:00:00Z"}'
# response: {"connection_id":"acc-1","attempts":1,"added":1,"updated":0,"unchanged":0,"fetched_at":"...","total_posts":1,"from":"...","to":"..."}
curl http://localhost:3004/metrics/acc-1
```

Idempotência: chave única lógica `(connection_id, post_id, captured_at)` para snapshot. O mesmo snapshot repetido não incrementa views. `total_views` agrega a **última amostra de cada post**, não soma cumulativamente históricos. Em empate de captura, prevalece a amostra já registrada; divergência para a mesma chave é erro. `fetched_at` registra coleta, separadamente de `captured_at`.

Retry: timeout, 408, 429 e 5xx transitórios; máximo 3 tentativas; 429 lê `Retry-After` em segundos ou data HTTP e limita a espera a `maxWaitMs` (3 s por padrão). Testes usam relógio e espera injetados. Para produção: persistência/concorrência transacional, fila durável e limites por provedor.

O lote é validado integralmente antes de atualizar o estado em memória: snapshot conflitante no fim da resposta não grava linhas anteriores. O fake permite simular `ETIMEDOUT` pelo campo `code`.

## Planejamento, execução e revisão

Planejamento e execução utilizando Codex GPT Sol 6.1. As implementações iniciais tiveram assistência de ChatGPT. O Codex realizou a revisão técnica e a análise dos requisitos, inspecionou o código e executou a validação automatizada registrada nesta entrega.

O autor realizou a revisão pessoal dos nove desafios, conforme declarado nesta execução. Os pontos abaixo documentam os critérios de análise da estrutura, da geração de testes e da qualidade do código.

| Área | Pontos de análise e revisão |
|---|---|
| Geração da estrutura | Isolar fetchPosts atrás do provedor fake; manter snapshots separados por conexão, post e data de captura. |
| Geração e revisão dos testes | Cobrir replay, janelas sobrepostas, última amostra, ETIMEDOUT, teto de tentativas, Retry-After em segundos/data HTTP, isolamento e conflito no fim do lote. |
| Qualidade estrutural | Conferir que fetched_at difere de captured_at e que a validação integral evita gravação parcial. |

