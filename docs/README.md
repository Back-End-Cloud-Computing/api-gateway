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
| [Rubrica da N2 (Canvas)](rubrica-n2.md) | Critérios oficiais (R1 3, R2 4, R3 3), requisitos e como o projeto atende cada um |
| [Infra e roteiro do dia da N2](infra-eks.md) | Regras do professor (5 min, sem slides), lab de 4 h, pré-voo, roteiro e comandos `kubectl` |
| [Roteiro da apresentação N2](roteiro-apresentacao-n2.md) | Quem fala, o que fala e o que digita em cada minuto dos 5 min, com plano B e perguntas |
| [Roteiro N2 por serviço](apresentacao-n2.md) | Gateway e Promotion: demonstração, decisões para defender, perguntas prováveis, pendências do grupo |
| [Guia de estudo da N2](guia-estudo-n2.md) | Os 11 serviços, auth, perguntas prováveis do professor, roteiro e pré-voo |
| [Evidências no EKS](evidencias/) | Ensaios de 27/10, 02/11 e 03/11: pods, Ingress pelo ELB, balanceamento, JWT, pedido com cupom e consumo do `OrderConfirmed` |
| [Cluster no EKS](../eks/README.md) | Criar, aplicar os 11 serviços e apagar o cluster `ganjj` |
| ADRs | [0001 Node/Fastify](adr/0001-node-fastify.md) · [0002 JWT na borda](adr/0002-jwt-na-borda.md) · [0003 Ingress coexistindo](adr/0003-ingress-coexistindo.md) · [0004 Rate limit em memória](adr/0004-rate-limit-em-memoria.md) |

## Datas que não se movem

| Data | Evento |
|---|---|
| 20/10 | Aula de Segurança com JWT |
| 27/10 | Aula de Helm |
| 03/11 | Aula de Observabilidade (Prometheus e Grafana) |
| **10/11/2026** | **N2 — apresentação em equipe, 40% da nota** |

Rubrica da N2: a do Canvas, em [rubrica-n2.md](rubrica-n2.md) (R1 3 · R2 4 · R3 3), desde 27/10/2026.

## Pendências fora do código

- [ ] Confirmar com cada dono o nome do Service, a porta e as rotas públicas (ver [integração](integration-issues.md)).
- [ ] Token real do `authorization` para o teste ponta a ponta.
- [ ] Conta `bascratki` no Docker Hub com o repositório `api-gateway` público.
