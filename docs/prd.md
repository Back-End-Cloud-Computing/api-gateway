# PRD — API Gateway

## Problema

O enunciado do professor exige um API Gateway na frente dos microsserviços. Hoje cada serviço tem seu
próprio Ingress e host (`promotion.ganjj.local`, `product.ganjj.local`...), então o cliente precisa
conhecer todos eles e nenhum ponto central aplica segurança, limite de uso ou rastreio.

## Objetivo

Um ponto de entrada (`api.ganjj.local`) que:

1. roteia por prefixo de caminho para o serviço dono da rota;
2. valida o JWT RS256 antes de encaminhar (defesa em profundidade: os serviços continuam validando);
3. aplica rate limit, CORS e timeout;
4. gera e propaga `X-Correlation-ID`, e encaminha `Idempotency-Key`;
5. expõe `/health` e `/metrics` para o Kubernetes e o Prometheus.

## Escopo

- Proxy HTTP com lista de rotas permitidas (nega por padrão).
- Rotas públicas explícitas, sem token; todas as outras exigem token de acesso válido.
- Configuração por variável de ambiente (URLs dos serviços, limites, CORS).
- Imagem Docker (`bascratki/api-gateway`), manifests K8s, chart Helm, painel Grafana.

## Fora de escopo

- Autorização por papel (admin): fica em cada serviço, que conhece suas regras.
- Rotas `/internal/*` (serviço para serviço, protegidas por `x-internal-secret`): nunca passam pelo gateway.
- Serviços de IA (`llm-provider`, `embedding-reranking`, `vector-db`): só o `product` os chama.
- Rate limit distribuído, cache de resposta, transformação de payload, WebSocket.
- Remover os Ingress dos outros serviços (ver [ADR 0003](adr/0003-ingress-coexistindo.md)).

## Critérios de aceite

| # | Critério | Como provar |
|---|---|---|
| 1 | Rota pública responde sem token | `curl api.ganjj.local/api/sale` retorna 200 |
| 2 | Rota protegida sem token retorna 401 | `curl api.ganjj.local/products` retorna 401 |
| 3 | Token inválido, expirado ou do tipo errado retorna 401 | testes de `tests/auth.test.ts` |
| 4 | `/internal/*`, `/metrics` e `/health` dos serviços não saem pelo gateway | 404 em `api.ganjj.local/internal/...` |
| 5 | Toda resposta carrega `X-Correlation-ID` | teste e `curl -i` |
| 6 | Excesso de requisições retorna 429 | teste de rate limit |
| 7 | Serviço lento retorna 504; serviço fora retorna 502 | testes com upstream falso |
| 8 | `/metrics` expõe contadores e histograma | `curl` por port-forward e painel no Grafana |
| 9 | Sobe no minikube com 2 réplicas e probes | `kubectl get pods` |
| 10 | Instala por Helm | `helm install` (após 27/10) |

## Riscos

- Os outros serviços ainda podem ser acessados direto pelos seus Ingress (ADR 0003).
- Chave pública vem do `authorization` no boot; se ele estiver fora, o gateway fica não pronto até conseguir (ADR 0002).
- Rate limit em memória: o limite é por réplica (ADR 0004).
