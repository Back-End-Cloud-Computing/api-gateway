# ADR 0004 — Rate limit em memória, por IP

Status: Aceito
Data: 2026-10-19

## Contexto

O gateway roda com 2 réplicas no cluster. Rate limit exato entre réplicas exige armazenamento compartilhado
(Redis). Nenhum serviço novo de infraestrutura cabe no prazo da N2.

## Decisão

`@fastify/rate-limit` com armazenamento em memória do processo: 100 requisições por minuto por IP no geral e 10
por minuto em `POST /auth/login` e `POST /auth/register` (proteção contra força bruta). Valores por variável de
ambiente. IP real vem de `X-Forwarded-For` do Ingress (`trustProxy` ligado só para o salto do Ingress).

## Consequências

- O limite efetivo é por réplica: com 2 réplicas, até 200 por minuto por IP. Documentado, não escondido.
- Reinício zera os contadores.
- Upgrade quando precisar de limite global: store Redis do `@fastify/rate-limit` (o `shopping-cart` já usa Redis).
