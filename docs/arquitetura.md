# Arquitetura — API Gateway

## Posição no sistema

```
cliente ──► Ingress NGINX (api.ganjj.local) ──► api-gateway:3000 ──► Service do dono da rota
                                                    │
                                                    ├─ valida JWT RS256
                                                    ├─ rate limit, CORS, timeout
                                                    └─ X-Correlation-ID
```

Serviço para serviço (`/internal/*`, com `x-internal-secret`) não passa pelo gateway. O serviço de
suporte também não tem rota pública.

## Tabela de rotas

O gateway **nega por padrão**: só o que está nesta tabela é encaminhado. Caminho fora dela retorna 404,
o que já esconde `/internal/*`, `/metrics` e `/health` dos serviços.

Valores confirmados nos repositórios em 2026-10-19; os nomes de Service e as portas são variáveis de
ambiente (ver [Configuração](#configuração)).

| Prefixo | Upstream (Service:porta) | Acesso | Dono |
|---|---|---|---|
| `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/public-key` | `authorization:8081` | público | Eduardo |
| `/auth/*` (restante: `/auth/me`, `/auth/accounts`) | `authorization:8081` | token | Eduardo |
| `/clients`, `/clients/*` | `client:8082` | token | Eduardo |
| `/api/pedidos`, `/api/pedidos/*` | `order:8080` | token | Rodrigo |
| `/api/cart`, `/api/cart/*` | `shopping-cart:3003` | token | João Liz |
| `/products`, `/products/*`, `/search/*` | `product-api:8000` | token | João Correa |
| `/api/sale`, `/api/coupons/{code}/validate` | `promotion:8000` | público | Lucas |
| `/api/promotions/*`, `/api/coupons/*`, `/api/campaigns/*` | `promotion:8000` | token | Lucas |
| `/health`, `/health/ready` | o próprio gateway (porta 3000) | aberto | Lucas |
| `/metrics` | o próprio gateway (porta 9100, fora do Ingress) | só dentro do cluster | Lucas |

Regras de casamento:

1. Rotas públicas primeiro (mais específicas), depois as protegidas.
2. `/api/pedidos`, `/api/cart` e as rotas do `promotion` compartilham o prefixo `/api`; casa-se pelo segundo
   segmento, nunca por `/api/*` genérico.
3. O gateway só autentica. Papel de admin é verificado pelo serviço de destino.
4. `/health` fica na porta 3000 (sem token). `/metrics` fica numa **porta separada, 9100**, que o Ingress
   não publica: só o Prometheus, de dentro do cluster, chega nela.

## Fluxo de uma requisição

1. Gera `X-Correlation-ID` (ou aceita o que veio, validado como UUID) e abre o log JSON.
2. Rate limit por IP. Excedeu: 429.
3. CORS (preflight `OPTIONS` responde direto).
4. Procura a rota na tabela. Sem rota: 404.
5. Se a rota exige token: lê `Authorization: Bearer` ou o cookie `accessToken` (o `shopping-cart` aceita os
   dois), valida assinatura RS256, `iss === ganjj-authorization` e `typ === access`. Falhou: 401.
6. Encaminha com `Authorization`, `Cookie`, `Idempotency-Key`, `X-Correlation-ID` e os demais cabeçalhos
   normais; preserva status e `Location` da resposta, como pede o `order` (INTEGRATION-CONTRACTS §7).
7. Timeout do upstream: 504. Upstream recusou conexão: 502.
8. Registra métricas e log.

## Chave pública

No boot, busca `GET {AUTH_BASE_URL}/auth/public-key` (PEM em texto puro) com nova tentativa e espera
crescente. Enquanto não tiver a chave, `/health/ready` retorna 503 e o Pod não recebe tráfego.
Alternativa para ambiente sem o `authorization`: `JWT_PUBLIC_KEY` (PEM) na ConfigMap. Ver [ADR 0002](adr/0002-jwt-na-borda.md).

## Configuração

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta HTTP pública (rotas e `/health`) |
| `METRICS_PORT` | `9100` | Porta de `/metrics`, não publicada no Ingress |
| `AUTH_BASE_URL` | `http://authorization:8081` | Busca da chave pública e rota `/auth/*` |
| `JWT_PUBLIC_KEY` | vazio | PEM estático; se definido, não busca no boot |
| `JWT_ISSUER` | `ganjj-authorization` | Issuer esperado |
| `CLIENT_URL`, `ORDER_URL`, `CART_URL`, `PRODUCT_URL`, `PROMOTION_URL` | `http://<service>:<porta>` | Upstreams |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Timeout por requisição ao upstream |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `100` / `1 minute` | Limite por IP |
| `RATE_LIMIT_AUTH_MAX` | `10` | Limite por minuto em `/auth/login` e `/auth/register` |
| `CORS_ORIGINS` | vazio (desligado) | Origens permitidas, separadas por vírgula |
| `LOG_LEVEL` | `info` | Nível do pino |

Nada sensível fica em variável do gateway: a chave pública não é segredo e o gateway não conhece o
`x-internal-secret`.

## Métricas (Prometheus)

| Métrica | Tipo | Rótulos |
|---|---|---|
| `gateway_requests_total` | counter | `upstream`, `method`, `status` |
| `gateway_request_duration_seconds` | histogram | `upstream` |
| `gateway_auth_rejected_total` | counter | `reason` (`missing`, `invalid`, `expired`, `wrong_type`) |
| `gateway_rate_limited_total` | counter | `scope` (`global`, `auth`) |
| `gateway_upstream_errors_total` | counter | `upstream`, `kind` (`timeout`, `unreachable`) |

Rótulo `upstream` tem no máximo 7 valores; nunca se usa o caminho cru, para não explodir a cardinalidade.
Painel do Grafana: taxa de requisições por upstream, latência p95, 401/429/5xx. Exportado em JSON em `k8s/observability/`.

## Estrutura de código

```
src/
  server.ts            # monta o Fastify e registra os plugins
  config.ts            # lê e valida o ambiente
  routes.ts            # tabela de rotas (dados, não lógica)
  auth/jwt.ts          # busca da chave e verificação RS256
  plugins/             # correlation, ratelimit, cors, metrics, timeout
tests/                 # vitest, upstream falso
```

A tabela de rotas é um arquivo de dados: adicionar um serviço é uma linha, sem tocar na lógica.
