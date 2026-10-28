# Contrato — API Gateway

Para quem consome o sistema pelo gateway (`http://api.ganjj.local`). Rotas de negócio pertencem a cada
serviço; aqui só o que o gateway acrescenta ou decide. Tabela de rotas em [arquitetura](arquitetura.md#tabela-de-rotas).

## Endpoints do gateway

| Método e caminho | Porta | Resposta |
|---|---|---|
| `GET /health` | 3000 | `200 {"status":"ok"}`; não depende de ninguém (liveness) |
| `GET /health/ready` | 3000 | `200` com a chave pública carregada; `503 {"error":"chave pública indisponível"}` antes disso (readiness) |
| `GET /metrics` | 9100 | Texto Prometheus (`text/plain; version=0.0.4`); não publicado no Ingress |

## Autenticação

- Token de acesso RS256 emitido pelo `authorization`, em `Authorization: Bearer <token>` ou no cookie `accessToken`.
- Claims exigidas: `iss = ganjj-authorization`, `typ = access`, `exp` no futuro.
- Rotas públicas (sem token): `POST /auth/register|login|refresh|logout`, `GET /auth/public-key`,
  `GET /api/sale`, `GET /api/coupons/{code}/validate`.

## Cabeçalhos

| Cabeçalho | Comportamento |
|---|---|
| `X-Correlation-ID` | Aceita UUID da requisição ou gera um. Sempre devolvido na resposta e repassado ao serviço. |
| `X-Gateway-Served-By` | Nome do pod do gateway que atendeu (hostname). O `X-Served-By` do serviço, quando existe, passa junto e mostra o pod do upstream. Evidência de balanceamento. |
| `Idempotency-Key` | Repassado sem alteração (o `order` usa em `POST /api/pedidos`). |
| `Authorization`, `Cookie` | Repassados sem alteração. |
| `X-Forwarded-For`, `X-Forwarded-Host` | Acrescentados. |
| `x-internal-secret` | Removido se vier do cliente: nunca atravessa o gateway. |

O gateway não injeta ID de cliente nem preço no corpo e preserva status e `Location` do serviço.

## Erros do gateway

Formato achatado, igual ao dos outros serviços: `{"error": "mensagem", "correlation_id": "..."}`.

| Status | Quando |
|---|---|
| 401 | Sem token, token inválido, expirado ou que não é de acesso |
| 404 | Caminho fora da tabela de rotas (inclui `/internal/*`) |
| 429 | Rate limit; traz `Retry-After` |
| 502 | Serviço recusou a conexão |
| 504 | Serviço não respondeu dentro de `UPSTREAM_TIMEOUT_MS` (`UPSTREAM_TIMEOUT_PRODUCTS_MS` no `POST /products`) |

Erros do serviço de destino (400, 403, 404, 422, 5xx do próprio serviço) passam sem alteração.
