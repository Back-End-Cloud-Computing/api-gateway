# Integração — API Gateway

Atualizado em 2026-10-19. IDs `GW-*` são locais deste repo; `INT-*` e `PROMO-*` vêm dos outros repos.
Nos repos dos colegas só se abre issue; nada é editado neles.

## Resumo

| ID | Tema | Serviços | Situação | Bloqueia agora? |
|---|---|---|---|---|
| GW-001 | Confirmar nome de Service, porta e rotas públicas de cada serviço | todos | Valores lidos dos repos em 19/10; falta cada dono confirmar | Não |
| GW-002 | Teste ponta a ponta com token real | `authorization` | Pendente: Lucas pede token e usuário ao dono do `authorization` | Não (fase 1 usa chave de teste) |
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

- [ ] `POST /auth/login` pelo gateway devolve token (rota pública, 10 por minuto).
- [ ] `GET /clients/me` com o token retorna 200; sem token, 401.
- [ ] `GET /products` com o token retorna 200.
- [ ] `GET /api/pedidos/meus` com o token retorna 200; `Idempotency-Key` chega ao `order`.
- [ ] Token de refresh em rota protegida retorna 401.

### GW-008 — Suporte

O gateway não tem rota para o serviço de suporte. O `order` chama `POST http://support:8090/internal/notifications`.

## Pedidos por repo (issues abertas por Lucas)

| Repo | Pedido |
|---|---|
| `order` | Chamar o suporte na criação do pedido ([SUP-001](https://github.com/Back-End-Cloud-Computing/support/blob/main/docs/integration-issues.md)); confirmar encaminhamento de cabeçalhos pelo gateway |

Os demais (token de teste no `authorization`; Service, porta e rotas públicas de `product`, `client`, `shopping-cart` e `promotion`) o Lucas combina direto com os donos, sem issue nos repos deles.
