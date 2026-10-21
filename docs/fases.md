# Fases — API Gateway

Cada fase é entregável sozinha e ancorada numa data da disciplina. Data de hoje deste plano: 19/10/2026.

| Fase | Quando | Entrega |
|---|---|---|
| 0 Fundação | 19/10 | Repo, docs, issues, scaffold com CI, lefthook e Dockerfile |
| 1 Proxy e JWT | até 24/10 | Tabela de rotas, JWT RS256 na borda, correlation id, timeout, testes verdes (casos R, A, E) |
| 2 Docker e Kubernetes | até 26/10 | Imagem `bascratki/api-gateway` multi-arch, manifests, Ingress `api.ganjj.local`, 2 réplicas com probes |
| 3 Distribuição | 28/10 a 31/10 | Chart Helm (após a aula de 27/10); `k8s/` fica como alternativa |
| 4 Observabilidade | 04/11 a 07/11 | `/metrics`, scrape pelo Prometheus, painel Grafana exportado em JSON (após a aula de 03/11) |
| 5 Ensaio | 08/11 a 09/11 | Demonstração completa ensaiada ([roteiro](apresentacao-n2.md)) |
| N2 | **10/11/2026** | Apresentação |

## Por fase: pronto quando

- **1:** `yarn test` verde; `curl` local nas rotas pública, protegida e `/internal`.
- **2:** `kubectl get pods` com 2 réplicas `1/1`; `curl -H "Host: api.ganjj.local" .../api/sale` retorna 200.
- **3:** `helm install` sobe o mesmo estado que `kubectl apply -k k8s/`.
- **4:** painel mostra requisições por upstream, latência p95 e 401/429/5xx em tempo real durante a demo.
- **5:** roteiro cronometrado sem depender de ninguém além dos serviços no ar.

## Dependências de outras pessoas

Ver [integration-issues.md](integration-issues.md). A fase 1 não depende de ninguém (upstream falso); o teste
com token real depende do `authorization`.
