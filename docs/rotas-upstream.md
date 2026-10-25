# Rotas do gateway contra os serviços reais

Conferido em 21/10/2026 com os 11 repos clonados da `main` e o gateway no Minikube (Ingress `api.ganjj.local`). Fonte dos caminhos: código de cada serviço. Fonte dos status: smoke pelo Ingress (23 PASS, 0 FAIL), com token de cliente e de ADMIN. Relatório completo: [teste-integracao-2026-10.md](https://github.com/Back-End-Cloud-Computing/promotion/blob/main/docs/teste-integracao-2026-10.md).

## Upstreams (`k8s/configmap.yaml`)

| Variável | Valor | Service no cluster | Confere |
|---|---|---|---|
| `AUTH_BASE_URL` | `http://authorization:8081` | `authorization:8081` | sim |
| `CLIENT_URL` | `http://client:8082` | `client:8082` | sim |
| `ORDER_URL` | `http://order:8080` | `order:8080` | sim |
| `CART_URL` | `http://shopping-cart:3003` | `shopping-cart:3003` | sim |
| `PRODUCT_URL` | `http://product-api:8000` | `product-api:8000` | sim |
| `PROMOTION_URL` | `http://promotion:8000` | `promotion:8000` | sim |

O gateway usa os nomes reais. A divergência `product` x `product-api` (INT-009) está nos consumidores `shopping-cart` e `order`, não aqui.

## Rotas

| Rota do gateway | Acesso | Caminho no serviço | Status observado |
|---|---|---|---|
| `POST /auth/(register\|login\|refresh\|logout)` | público | mesmo caminho | 200 |
| `GET /auth/public-key` | público | mesmo caminho | 200 |
| `GET /auth/me`, `/auth/accounts` | token | mesmo caminho | roteadas; não exercitadas no smoke |
| `/clients`, `/clients/me`, `/clients/{id}` | token | mesmo caminho (`GET /clients` e `/clients/{id}` só ADMIN) | cliente 403 em `GET /clients`, ADMIN 200 |
| `/api/pedidos`, `/api/pedidos/meus`, `/{id}`, `/{id}/passo`, `/admin/todos` | token | mesmo caminho | `GET /api/pedidos` 405 (não há GET na raiz); `GET /meus` 200; `POST` 502 em 25/10 (order chama `/api/cesta`, o cart expõe `/api/cart`); antes 500 (ver issue order #13) |
| `/api/cart`, `/api/cart/items`, `/api/cart/items/{product_id}` | token | mesmo caminho | `GET /api/cart` 200 com desconto (25/10); `POST /items` 201 (25/10); com o promotion fora: 504 (cart sem timeout) |
| `/products`, `/products/{id}`, `/products/batch` | token | mesmo caminho | `GET /products` 200; `POST /products` leva ~15 s, ver [#23](https://github.com/Back-End-Cloud-Computing/api-gateway/issues/23) |
| `/search/lexical`, `/search/semantic`, `/search/agentic_search` | token | mesmo caminho | roteadas; não exercitadas no smoke |
| `GET /api/sale`, `GET /api/coupons/{code}/validate` | público | mesmo caminho | 200 |
| `/api/(promotions\|coupons\|campaigns)` | token | mesmo caminho | `GET /api/promotions` e `/api/campaigns` 200 (ADMIN) |

## Fora do gateway de propósito (404)

`/metrics` (porta 9100, fora do Ingress), `/internal/*`, `/health` dos serviços, `/docs` e `/openapi.json` do cart, `/swagger` do client. Verificado: `/metrics` e `/internal/discounts/calculate` dão 404 pelo gateway.

## Pendências

- `/search/agentic_search/ws` (WebSocket do product) não passa pelo gateway: o padrão `^/(products|search)(/|$)` casa o caminho, mas o `@fastify/reply-from` não foi testado com upgrade. Não é requisito da N2; fica registrado.
- Rotas "não exercitadas" dependem de dados reais nos serviços; entram no e2e da [#13](https://github.com/Back-End-Cloud-Computing/api-gateway/issues/13).
