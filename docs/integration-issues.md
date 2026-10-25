# Integração — API Gateway

Atualizado em 2026-10-19. IDs `GW-*` são locais deste repo; `INT-*` e `PROMO-*` vêm dos outros repos.
Nos repos dos colegas só se abre issue; nada é editado neles.

## Resumo

| ID | Tema | Serviços | Situação | Bloqueia agora? |
|---|---|---|---|---|
| GW-001 | Confirmar nome de Service, porta e rotas públicas de cada serviço | todos | Valores lidos dos repos em 19/10 e exercitados em 25/10 no Minikube (smoke 23 PASS); falta cada dono confirmar | Não |
| GW-002 | Teste ponta a ponta com token real | `authorization` | Executado em 21/10 e repetido em 25/10 com a chave de lab (token RS256 real, rotas de product, cart, promotions e coupons pelo gateway); falta repetir com a chave e o usuário oficiais do Eduardo | Não (fase 1 usa chave de teste) |
| GW-003 | Chave pública sem JWKS nem rotação | `authorization` | Aceito no [ADR 0002](adr/0002-jwt-na-borda.md) | Não |
| GW-004 | Encaminhar `Authorization`, `Cookie`, `Idempotency-Key`, `X-Correlation-ID`; preservar `Location` | `order` | Checklist aberto no `order` (INTEGRATION-CONTRACTS §7); coberto por E1, E3 e E9 | Não |
| GW-005 | Gateway contornável pelos Ingress dos serviços | todos | Aceito no [ADR 0003](adr/0003-ingress-coexistindo.md) | Não |
| GW-006 | Papel `ADMIN` verificado só nos serviços | todos | Decisão: gateway só autentica | Não |
| GW-007 | `/api/*` compartilhado por `order`, `shopping-cart` e `promotion` | os três | Casamento pelo segundo segmento; rever se alguém criar rota nova sob `/api` | Não |
| GW-008 | Serviço de suporte fora do gateway | `support` | `order` chama `support:8090` direto com `x-internal-secret` | Não |
| GW-009 | Serviços sem `/metrics` | todos exceto `promotion` | Fora do gateway; o painel do gateway cobre a borda | Não |

## Detalhes

### GW-001 — Valores a confirmar

| Serviço | Service:porta | Fonte |
|---|---|---|
| `authorization` | `authorization:8081` | Ingress `auth.ganjj.local` |
| `client` | `client:8082` | Ingress `client.ganjj.local` |
| `order` | `order:8080` | sem Ingress |
| `shopping-cart` | `shopping-cart:3003` | Ingress `shopping-cart.ganjj.local` |
| `product` | `product-api:8000` | O nome do Service difere do repo; INT-009 (porta) |
| `promotion` | `promotion:8000` | Ingress `promotion.ganjj.local` |

Todos em `default` (nenhum manifest define namespace); se algum dono mudar, ajustar a variável de ambiente.

### GW-002 — Checklist com token real

- [x] `POST /auth/login` pelo gateway devolve token (rota pública, 10 por minuto).
- [x] `GET /clients/me` com o token retorna 200; sem token, 401. (Conta nova sem perfil recebe 404 do `client` até o `POST /clients`.)
- [x] `GET /products` com o token retorna 200.
- [x] `GET /api/pedidos/meus` com o token retorna 200.
- [ ] `Idempotency-Key` chega ao `order`: coberto pelo teste E3 do gateway; no lab só `GET` foi exercitado, e o `order` não usa a chave em `GET`.
- [x] Token de refresh em rota protegida retorna 401.

**Execução de 21/10/2026:** imagem `bascratki/api-gateway:1.0.0` contra `authorization`, `client`, `product` e `order` locais (Compose), com a chave pública de um par gerado por `scripts/generate-keys.sh` do `authorization`. Repetir só com a chave e o usuário oficiais do Eduardo.

### GW-008 — Suporte

O gateway não tem rota para o serviço de suporte. O `order` chama `POST http://support:8090/internal/notifications`.

## Pedidos por repo (issues abertas por Lucas)

| Repo | Pedido |
|---|---|
| `order` | Chamar o suporte na criação do pedido ([SUP-001](https://github.com/Back-End-Cloud-Computing/support/blob/main/docs/integration-issues.md)); confirmar encaminhamento de cabeçalhos pelo gateway |

Os demais (token de teste no `authorization`; Service, porta e rotas públicas de `product`, `client`, `shopping-cart` e `promotion`) o Lucas combina direto com os donos, sem issue nos repos deles.

## Rodada de 25/10/2026 (Minikube, cadeia pelo gateway)

Rodado: login/registro, `POST /products` com `price` e `stock` (201 em menos de 10 s, SKU repetido 409), `GET /products/{id}`, promoção e cupom, `POST /api/cart/items` (201), `GET /api/cart` com desconto (total 160, e 144 com cupom), 401 sem token em `/clients /products /api/cart /api/pedidos /api/promotions`, 404 em `/internal/*` e `/metrics`. Evidência no laboratório local: `chain-k8s-4.txt`, `smoke-k8s-4.txt`.

Falhou por causa de outros repos (o gateway roteou corretamente):

| Achado | Evidência | Dono |
| --- | --- | --- |
| `GET /api/cart` com o promotion fora devolve 504 do gateway: o Cart não tem timeout no `fetch` ao promotion e a chamada pendura | `deg-k8s-1.txt` | shopping-cart |
| `POST /api/pedidos` devolve 502: o Order chama `/api/cesta` e o Cart expõe `/api/cart` | `chain-k8s-4.txt` 7a | order |

O gateway não precisa de mudança para nenhum dos dois. Detalhes e tabela completa em `promotion/docs/teste-integracao-2026-10.md`.
