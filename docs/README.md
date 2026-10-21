# Documentação — API Gateway (GANJJ)

Escrita para ser lida na ordem abaixo. Fluxo de trabalho: pergunta, decisão, documento, só então código.

## Índice

| Documento | O que responde |
|---|---|
| [PRD](prd.md) | Problema, escopo, fora de escopo, critérios de aceite |
| [Arquitetura](arquitetura.md) | Tabela de rotas, fluxo de uma requisição, configuração, métricas |
| [Contrato](contrato-api.md) | Endpoints próprios, cabeçalhos, formato de erro |
| [Rotas x serviços](rotas-upstream.md) | Cada rota do gateway contra o caminho real do serviço, com status observado |
| [Testes](testes.md) | Casos de teste definidos antes da implementação |
| [Fases](fases.md) | Entregas e datas |
| [Integração](integration-issues.md) | Dependências dos outros serviços e riscos |
| [Convenções](convencoes.md) | Commits, branches, PRs, autoria, idioma |
| [Roteiro N2](apresentacao-n2.md) | Demonstração, decisões para defender, perguntas prováveis |
| ADRs | [0001 Node/Fastify](adr/0001-node-fastify.md) · [0002 JWT na borda](adr/0002-jwt-na-borda.md) · [0003 Ingress coexistindo](adr/0003-ingress-coexistindo.md) · [0004 Rate limit em memória](adr/0004-rate-limit-em-memoria.md) |

## Datas que não se movem

| Data | Evento |
|---|---|
| 20/10 | Aula de Segurança com JWT |
| 27/10 | Aula de Helm |
| 03/11 | Aula de Observabilidade (Prometheus e Grafana) |
| **10/11/2026** | **N2 — apresentação em equipe, 40% da nota** |

Rubrica da N2: R1 arquitetura distribuída em Kubernetes (4,0) · R2 segurança, distribuição e
observabilidade (3,0) · R3 apresentação técnica (3,0).

## Pendências fora do código

- [ ] Confirmar com cada dono o nome do Service, a porta e as rotas públicas (ver [integração](integration-issues.md)).
- [ ] Token real do `authorization` para o teste ponta a ponta.
- [ ] Conta `bascratki` no Docker Hub com o repositório `api-gateway` público.
