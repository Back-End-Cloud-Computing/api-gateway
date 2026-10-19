# ADR 0001 — Gateway em Node/TypeScript com Fastify

Status: Aceito
Data: 2026-10-19

## Contexto

O professor aceita qualquer stack. A equipe já tem Java, Go, .NET, Node, Python e PHP, então a escolha
não precisa cobrir diversidade. O gateway é um proxy com validação de JWT, limite de uso e métricas:
trabalho de I/O, com pouca regra de negócio. Opções avaliadas: Node/Fastify, Go com `ReverseProxy`,
configuração pura (Kong/Traefik) e Laravel.

## Decisão

Node 22 + TypeScript + Fastify. Bibliotecas: `@fastify/reply-from` (proxy), `jose` (RS256),
`@fastify/rate-limit`, `@fastify/cors`, `prom-client`, pino (log JSON nativo do Fastify), vitest.

Motivos: Lucas já escreve TypeScript e o ciclo de teste com `app.inject()` é rápido; Fastify traz log JSON e
plugins prontos para rate limit e CORS; `jose` verifica RS256 com o algoritmo fixado. Configuração pura
(Kong/Traefik) foi descartada porque deixa pouco a defender na apresentação e a chave pública dinâmica
do `authorization` fica desajeitada. Laravel foi descartado por peso (PHP-FPM ou `artisan serve` por réplica) para
um proxy.

## Consequências

- Tabela de rotas é um arquivo de dados em TypeScript; adicionar serviço é uma linha.
- Uma segunda stack Node na equipe (o `shopping-cart` também é Node), sem problema.
- Se o desempenho do proxy virar gargalo, a troca por Go é local: o contrato HTTP não muda.
