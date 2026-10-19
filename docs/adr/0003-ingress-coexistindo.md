# ADR 0003 — Gateway coexiste com os Ingress dos serviços

Status: Aceito (com risco residual)
Data: 2026-10-19

## Contexto

Cada serviço (exceto `order`) tem Ingress com host próprio (`auth.ganjj.local`, `client.ganjj.local`,
`product.ganjj.local`, `promotion.ganjj.local`...). Cada dono mantém o seu repositório; Lucas só pode
abrir issue neles. Remover todos os Ingress exigiria cinco pessoas mexendo antes da N2 e poderia quebrar
o que já funciona.

## Decisão

O gateway entra num host novo, `api.ganjj.local`, e os Ingress existentes ficam como estão. Os
Services internos (`promotion:8000`, `product-api:8000`...) já existem; o gateway só os usa.

## Consequências

- Risco residual: dá para contornar o gateway chamando o host do serviço (`product.ganjj.local`). O JWT
  continua validado no serviço, mas rate limit, `X-Correlation-ID` e as métricas do gateway são pulados.
- Para a demo, a narrativa é "toda chamada do cliente passa pelo gateway"; mostrar só `api.ganjj.local`.
- Endurecimento (backlog, depois da N2): cada dono remove o Ingress público do serviço, ou NetworkPolicy
  permitindo entrada só do gateway (exige CNI com suporte, o minikube padrão não tem).
- O `order` não tem Ingress; passa a ser alcançável publicamente só pelo gateway.
