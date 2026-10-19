# ADR 0002 — Validar o JWT RS256 na borda e nos serviços

Status: Aceito
Data: 2026-10-19

## Contexto

Hoje cada serviço valida RS256 sozinho (`promotion` com chave estática, `product` buscando a chave no boot,
`client`, `order` e `shopping-cart` com arquivo). O contrato do `order` (INTEGRATION-CONTRACTS §7) pede que o
gateway apenas encaminhe `Authorization` e `Cookie`. O `authorization` publica a chave em
`GET /auth/public-key` (PEM em texto puro, sem JWKS nem `kid`, sem rotação confirmada).

## Decisão

O gateway valida assinatura RS256, `iss = ganjj-authorization` e `typ = access` **e** repassa o token
original. Os serviços continuam validando: defesa em profundidade.

- Algoritmo fixado em RS256 no código, nunca lido do header do token (evita `alg: none` e confusão HS256).
- Chave: `GET {AUTH_BASE_URL}/auth/public-key` no boot, com nova tentativa e espera crescente. Sem a chave,
  `/health/ready` retorna 503 e rotas protegidas retornam 503.
- Alternativa: `JWT_PUBLIC_KEY` (PEM) em ConfigMap, quando o `authorization` não está no ar.
- Sem JWKS e sem cache periódico: não há rotação para justificar (mesma lógica do ADR 0002 do `promotion`).
- O gateway só autentica. Verificar papel `ADMIN` continua em cada serviço.
- Rotas públicas são uma lista explícita; qualquer rota nova nasce protegida.

## Consequências

- Se o `authorization` rotacionar a chave, o gateway precisa de reinício ou de busca periódica (revisitar).
- Sem dupla verificação o argumento de segurança da R2 seria só roteamento; com ela, token inválido nem chega à rede interna.
- Custo: uma verificação RS256 extra por requisição (microssegundos).
