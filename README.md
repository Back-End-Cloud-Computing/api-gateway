# API Gateway (GANJJ)

Entrada única do sistema. Recebe as chamadas dos clientes, valida o JWT RS256 na borda e roteia para o
microsserviço certo dentro do cluster. Também aplica rate limit, CORS, `X-Correlation-ID` e timeout, e
expõe métricas para o Prometheus.

- **Dono:** Lucas Stopinski (`LucasStop`)
- **Stack:** Node 22 + TypeScript + Fastify (ver [ADR 0001](docs/adr/0001-node-fastify.md))
- **Porta:** 3000 · **Host no cluster:** `api.ganjj.local`
- **Prazo:** apresentação N2 em 10/11/2026

## Documentação

Comece por [`docs/README.md`](docs/README.md). Resumo:

| Documento | O que responde |
|---|---|
| [PRD](docs/prd.md) | O que o gateway resolve, o que fica de fora, critérios de aceite |
| [Arquitetura](docs/arquitetura.md) | Tabela de rotas, fluxo de uma requisição, configuração |
| [Contrato](docs/contrato-api.md) | O que o gateway expõe e promete para quem o consome |
| [Testes](docs/testes.md) | Casos definidos antes do código (TDD) |
| [Fases](docs/fases.md) | Entregas com datas |
| [Integração](docs/integration-issues.md) | O que depende dos outros serviços |
| [Roteiro N2](docs/apresentacao-n2.md) | O que mostrar na apresentação |

## Rodar localmente

```bash
cp .env.example .env
yarn install
yarn dev              # http://localhost:3000
yarn test
```

No cluster (minikube): ver [`k8s/README.md`](k8s/README.md), ou o chart Helm em [`helm/api-gateway/`](helm/api-gateway/README.md).

No Amazon EKS (AWS Academy Learner Lab), com os 11 serviços: ver [`eks/README.md`](eks/README.md).

## Convenções

Commits em Conventional Commits, PR por mudança, autor único. Detalhes em
[`docs/convencoes.md`](docs/convencoes.md). Depois de clonar: `lefthook install`.
