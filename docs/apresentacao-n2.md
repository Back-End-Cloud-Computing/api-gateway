# Roteiro N2 — API Gateway (10/11/2026)

Rubrica: R1 arquitetura distribuída em Kubernetes (4,0) · R2 segurança, distribuição e observabilidade (3,0) ·
R3 apresentação técnica (3,0). Este roteiro cobre a parte do gateway; a ordem final depende do grupo.

## Demonstração

| # | O quê | Como mostrar | Rubrica |
|---|---|---|---|
| 1 | Gateway no cluster | `kubectl get pods` (2 réplicas `1/1`) | R1 |
| 2 | Entrada única | `curl -H "Host: api.ganjj.local" .../api/sale` retorna 200 sem token | R1 |
| 3 | JWT na borda | `/products` sem token retorna 401; com token real do `authorization`, 200 | R2 |
| 4 | Deny por padrão | `/internal/...` e `/metrics` pelo gateway retornam 404 | R2 |
| 5 | Rastreio | `curl -i` mostra `X-Correlation-ID`; o mesmo id aparece no log do gateway e do serviço | R2 |
| 6 | Rate limit | laço de `curl` até 429 com `Retry-After` | R2 |
| 7 | Autorrecuperação | `kubectl delete pod <gateway>` e `get pods -w` | R1 |
| 8 | Distribuição | `helm install` do chart (após 27/10) | R2 |
| 9 | Observabilidade | painel Grafana: requisições por upstream, p95, 401/429/5xx, enquanto o item 6 roda | R2 |

## Decisões para defender (R3)

- Gateway próprio em Node/Fastify em vez de Kong/Traefik: ver [ADR 0001](adr/0001-node-fastify.md).
- JWT validado na borda e nos serviços (defesa em profundidade): [ADR 0002](adr/0002-jwt-na-borda.md).
- Lista de rotas permitidas, nega por padrão; `/internal` nunca atravessa.
- Convive com os Ingress existentes, risco residual declarado: [ADR 0003](adr/0003-ingress-coexistindo.md).
- Rate limit em memória, com o limite por réplica declarado: [ADR 0004](adr/0004-rate-limit-em-memoria.md).
- `/metrics` em porta separada, fora do Ingress.

## Perguntas prováveis

- Por que não remover os Ingress dos serviços? Cinco repos de donos diferentes e risco de quebrar antes da N2; fica no backlog com NetworkPolicy como caminho.
- E se o `authorization` cair? O gateway fica não pronto no boot; com a chave já carregada, segue validando.
- E rotação de chave? Não existe hoje; busca periódica é a evolução.
- Por que o gateway não checa admin? Cada serviço conhece suas regras; o gateway só autentica.
- O rate limit é global? Não, por réplica; Redis é o upgrade.

## Antes do dia

- [ ] Imagem `bascratki/api-gateway` pública e multi-arch (amd64 e arm64).
- [ ] `/etc/hosts` com `api.ganjj.local` apontando para o `minikube tunnel`.
- [ ] Token real e usuário de teste do `authorization`.
- [ ] Painel Grafana exportado em JSON e importado no cluster da demo.
- [ ] Todos os serviços no ar no mesmo cluster.
- [ ] Ensaio cronometrado.

- Rodado em 25/10: token real pelo gateway, produto com preço e estoque, cart com desconto do promotion, 401 sem token e 404 em `/internal` e `/metrics`. Não demonstrar: pedido (502 até o order alinhar as rotas) e queda do promotion (504 até o cart ganhar timeout).
