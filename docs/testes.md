# Testes — API Gateway

Teste primeiro: estes casos existem antes do código. Ferramenta: vitest, com `app.inject()` do Fastify e
upstream falso (servidor HTTP local) para não depender dos outros serviços. Chave RS256 de teste gerada
na hora (`jose`), nunca uma chave real.

## Casos

### Rotas e acesso (`tests/routing.test.ts`)

| # | Dado | Então |
|---|---|---|
| R1 | `GET /api/sale` sem token | encaminha para `promotion`, 200 |
| R2 | `GET /products` sem token | 401 |
| R3 | `GET /products` com token válido | encaminha para `product-api` |
| R4 | `GET /internal/discounts/calculate` | 404, nada chega ao upstream |
| R5 | `GET /metrics` na porta 3000 | 404 |
| R6 | `/api/pedidos` com token vai para `order`; `/api/cart` vai para `shopping-cart`; `/api/promotions` vai para `promotion` | upstream certo em cada caso |
| R7 | Requisição com `x-internal-secret` do cliente | cabeçalho não chega ao upstream |
| R8 | `POST /auth/login` sem token | encaminha para `authorization` |

### JWT (`tests/auth.test.ts`)

| # | Dado | Então |
|---|---|---|
| A1 | Token assinado com outra chave | 401 `invalid` |
| A2 | Token expirado | 401 `expired` |
| A3 | `typ = refresh` | 401 `wrong_type` |
| A4 | `iss` diferente | 401 `invalid` |
| A5 | Token com `alg: none` ou HS256 | 401 (algoritmo fixado em RS256) |
| A6 | Token válido no cookie `accessToken` | aceito |
| A7 | Chave ainda não carregada | `/health/ready` 503; rota protegida 503 |

### Cabeçalhos e limites (`tests/edge.test.ts`)

| # | Dado | Então |
|---|---|---|
| E1 | Requisição sem `X-Correlation-ID` | resposta traz UUID gerado; upstream recebe o mesmo |
| E2 | `X-Correlation-ID` inválido (não UUID) | substituído por UUID novo |
| E3 | `Idempotency-Key` na requisição | chega igual ao upstream |
| E4 | 101ª requisição do mesmo IP no minuto (limite 100) | 429 com `Retry-After` |
| E5 | 11º `POST /auth/login` no minuto | 429, mesmo com o limite global livre |
| E6 | Upstream demora mais que o timeout | 504 |
| E7 | Upstream desligado | 502 |
| E8 | Origem fora de `CORS_ORIGINS` | sem cabeçalhos CORS; origem permitida recebe |
| E9 | Status e `Location` do upstream (201 + Location) | preservados |

### Métricas (`tests/metrics.test.ts`)

| # | Dado | Então |
|---|---|---|
| M1 | Uma requisição proxied | `gateway_requests_total{upstream,method,status}` incrementa |
| M2 | Um 401 | `gateway_auth_rejected_total{reason}` incrementa |
| M3 | Um 429 | `gateway_rate_limited_total{scope}` incrementa |
| M4 | Caminho aleatório 404 | rótulo `upstream` não contém o caminho |

## Ponta a ponta (manual, depende de token real)

Checklist em [integration-issues.md](integration-issues.md) (GW-002): login real no `authorization`, `GET /products`
e `GET /clients/me` pelo gateway.

## Como rodar

`yarn test` localmente e no CI (`ci.yml`). Cobertura não é meta; os casos acima são.
