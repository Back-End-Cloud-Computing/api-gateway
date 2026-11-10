# Roteiro da apresentação N2: quem fala, o que fala e o que digita

Para ensaiar em grupo e mostrar ao professor. Base: aviso do professor de 04/11 ([`infra-eks.md`](infra-eks.md)):
demonstração de **5 minutos** por equipe, sem PowerPoint, dentro de uma janela de 9 minutos. Os 4 minutos que
sobram são folga para troca de equipe e perguntas; **não** use essa folga na demonstração. Se o professor
liberar mais tempo, o bloco 5 (seção 4) é o que se estende.

Tudo abaixo foi rodado no EKS em 05/11 e de novo em 09/11/2026 (cluster novo, 23 pods de aplicação `Running`). O que ainda não foi cronometrado com o grupo está dito no texto.

## 1. Papéis

| Quem | Serviços | Fala em |
|---|---|---|
| Lucas | promotion (PHP/Laravel, MySQL), api-gateway (TypeScript/Fastify) | abertura, escala, fila e cupom, fechamento |
| Eduardo | authorization (Java, Oracle), client (Go, PostgreSQL), support (Java, SQLite) | diversidade, login e JWT |
| Rodrigo | order (C#/ASP.NET Core, SQL Server) | diversidade, pedido |
| João Liz | shopping-cart (Node.js/Express, Redis) | diversidade, carrinho e cupom |
| João Correa | product, llm-provider, embedding-reranking, vector-db (Python/FastAPI; MongoDB e ChromaDB) | diversidade, produto |

**Equipe 10, slot 20h54 a 21h03. Operador do teclado e anfitrião do cluster: Lucas.** Quem fala não digita; avisa "próximo" e o operador aperta
Enter. O terminal projetado tem fonte grande, `ELB` exportado e o kubeconfig do cluster ativo.

## 2. Linha do tempo (5:00)

| Tempo | Quem | Bloco | Rubrica |
|---|---|---|---|
| 0:00 a 0:30 | Lucas | 1. Abertura e cluster no EKS | R2 |
| 0:30 a 1:15 | todos | 2. Diversidade tecnológica | R1 |
| 1:15 a 2:15 | Lucas | 3. Réplicas, balanceamento e escalonamento | R2 |
| 2:15 a 2:40 | Eduardo | 4a. Login e JWT | R3 (REST) |
| 2:40 a 2:55 | João Correa | 4b. Produto | R3 (REST) |
| 2:55 a 3:20 | João Liz | 4c. Carrinho e cupom (REST entre serviços) | R3 (REST) |
| 3:20 a 3:50 | Rodrigo | 4d. Pedido e publicação | R3 (RabbitMQ) |
| 3:50 a 4:45 | Lucas | 4e. Fila, consumo e cupom | R3 (RabbitMQ) |
| 4:45 a 5:00 | Lucas | 5. Fechamento | todas |

O bloco 4 roda com `DEMO_STEP=1 bash scripts/demo-eks.sh`: o script para antes de cada integrante e espera Enter. O [`scripts/demo-eks.sh`](https://github.com/Back-End-Cloud-Computing/promotion/blob/main/scripts/demo-eks.sh) fica no `promotion` e roda na raiz do clone dele.

## 3. Preparo antes de entrar (fora dos 5 minutos)

```bash
export ELB=$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
kubectl get pods -A | grep -v Running     # só o cabeçalho pode aparecer
curl -s -o /dev/null -w '%{http_code}\n' "http://$ELB/api/sale"   # 200
```

Pré-voo completo e janela do lab: [`infra-eks.md`](infra-eks.md), seções 2 e 3.

## 4. O roteiro, bloco a bloco

### Bloco 1 (0:00 a 0:30) Abertura e cluster, Lucas

Digita:

```bash
kubectl get nodes
kubectl get deploy,pods,svc
kubectl get ingress
```

Fala: "Somos a equipe 10. A solução é uma loja em microsserviços: 11 serviços, 5 integrantes, todos em
container e rodando num cluster Amazon EKS com 4 nodes. A entrada é este Ingress NGINX, que aponta para o
api-gateway, e o gateway roteia por path para os serviços. Aqui estão os Deployments, os Pods e os Services:
cada banco tem o próprio Service (por exemplo `promotion-db`), então a persistência é isolada por serviço. Os
serviços se falam pelo nome do Service, como `http://promotion:8000`, nunca por IP de Pod."

### Bloco 2 (0:30 a 1:15) Diversidade tecnológica, todos

Digita (uma vez):

```bash
kubectl get pods -o 'custom-columns=POD:.metadata.name,IMAGE:.spec.containers[*].image'
```

Cada um fala uma frase, nesta ordem, enquanto a imagem do seu serviço está na tela:

- Eduardo: "authorization e support em Java com Spring Boot, client em Go. Bancos: Oracle, PostgreSQL e SQLite."
- Rodrigo: "order em C# com ASP.NET Core, com SQL Server."
- João Liz: "shopping-cart em Node.js com Express, com Redis."
- João Correa: "product, llm-provider, embedding-reranking e vector-db em Python com FastAPI. MongoDB e ChromaDB."
- Lucas: "promotion em PHP com Laravel e MySQL, api-gateway em TypeScript com Fastify. São sete linguagens e cada
  serviço tem o próprio banco."

### Bloco 3 (1:15 a 2:15) Réplicas e escalonamento, Lucas

Digita (na pasta do `promotion`):

```bash
bash scripts/demo-replicas.sh
kubectl scale deploy/promotion --replicas=5
kubectl get pods -l app=promotion -w   # Ctrl+C quando os 5 ficarem 1/1
kubectl scale deploy/promotion --replicas=3
```

Fala: "Os 11 serviços sem estado rodam com 3 réplicas cada. O script faz 3 chamadas pelo Ingress a cada serviço e
lista os Pods atrás do Service: no promotion o cabeçalho `X-Served-By` troca de Pod, e no gateway o
`X-Gateway-Served-By` mostra o balanceamento. Banco, RabbitMQ e consumer ficam com 1 réplica de propósito: com
volume local, uma réplica de banco seria um banco vazio separado. Agora escalo o promotion para 5: o Kubernetes
sobe dois Pods novos. Volto para 3."

Para um serviço só (se o tempo apertar): `bash scripts/demo-replicas.sh promotion api-gateway`.

O mesmo `kubectl scale deploy/<nome> --replicas=N` vale para qualquer deploy sem estado (3 réplicas hoje):
`api-gateway`, `promotion`, `authorization`, `client`, `order`, `shopping-cart`, `product-api`, `support`,
`vector-db`, `llm-provider`, `embedding-reranking`. Só `api-gateway` e `promotion` devolvem o Pod no header
(`X-Gateway-Served-By`, `X-Served-By`), então são os que provam o balanceamento depois do scale; nos outros, só a
lista de Pods muda. **Não escalar** `promotion-db`, `mongodb`, `redis`, `rabbitmq`, `oracle-auth`, `postgres-client`,
`chromadb`, `mailpit`, `promotion-consumer` nem `order-sqlserver` (StatefulSet): com `emptyDir`, cada réplica é uma
instância vazia e separada (em 09/11 isso quebrou o cupom: 503, `no_coupon`). Acima de ~5 réplicas o cluster de
4 nodes deixa Pods em `Pending`.

**Roteiro automático** (na raiz do clone do `promotion`): `bash scripts/roteiro-n2.sh` mostra o PRÓXIMO comando e
o seguinte, e só executa no Enter (`p` pula, `q` sai, Ctrl+C encerra só o `-w`). Cobre os blocos 1 a 4; o bloco 4
mantém as pausas por integrante do `demo-eks.sh`.

Testado em 09/11 no EKS (4 nodes): o script completo leva ~24 s; o `scale` do promotion para 5 mostra os 2 Pods
novos em `Init`/`ContainerCreating` logo depois (dizer "está subindo" e seguir) e o `scale` de volta para 3
encerra os extras na hora.

### Bloco 4 (2:15 a 4:45) Fluxo REST e RabbitMQ, cada um na sua vez

Digita (uma vez, e o script pausa sozinho):

```bash
DEMO_STEP=1 bash scripts/demo-eks.sh   # na raiz do clone do promotion
```

**4a. Eduardo (2:15 a 2:40), Enter em "login e cadastro" e depois em "JWT, papéis".**
Fala: "O authorization emite o token JWT com RS256 e só ele tem a chave privada; os outros serviços só têm a chave
pública, então ninguém consegue forjar token. Fiz login como admin, cadastrei e entrei como cliente. Cliente em
rota de admin dá 403, admin dá 200 e sem token dá 401."

**4b. João Correa (2:40 a 2:55), Enter em "produto".**
Fala: "Criei um produto pelo gateway. O product grava no MongoDB e responde 201; a descrição e o embedding são
gerados em segundo plano pelos serviços de IA."

**4c. João Liz (2:55 a 3:20), Enter em "carrinho e cupom".**
Fala: "O carrinho fica no Redis. Ao aplicar o cupom BEMVINDO10, o shopping-cart chama o promotion pelo nome do
Service, `http://promotion:8000`, sem IP de Pod, e o total vem com desconto." (É o Service Discovery e o REST entre
serviços.)

**4d. Rodrigo (3:20 a 3:50), Enter em "pedido".**
Fala: "O pedido sai com uma `Idempotency-Key`. O order lê o carrinho, baixa o estoque no product, grava o pedido e
publica `OrderConfirmed` no RabbitMQ pelo padrão outbox. Repetindo a mesma chave, volta o mesmo pedido."

**4e. Lucas (3:50 a 4:45), Enter em "fila e consumo do cupom"** (o script espera 8 s; usar esse tempo para falar).
Fala: "A fila tem um consumidor: é o promotion-consumer. Ele consumiu a mensagem com `outcome=consumed` e o
`usage_count` do cupom subiu 1 (o script mostrou o valor antes e depois). Se a mesma mensagem chegar de novo, ela é ignorada pelo `order_id`."
Se sobrar tempo e o professor quiser ver o consumidor do outro lado:

```bash
kubectl logs deploy/support --tail=5      # linhas "Entrega event_id=... channel=email status=sent"
```

### Bloco 5 (4:45 a 5:00) Fechamento, Lucas

Fala: "Resumindo: 11 serviços em 7 linguagens, cada um com o seu banco, rodando no EKS, entrada pelo Ingress, escala
horizontal com balanceamento, REST entre serviços e RabbitMQ com publicação e consumo. Obrigado."

## 5. Se algo der errado

| Sintoma | Fala | Ação |
|---|---|---|
| ELB não responde | "O DNS do load balancer ainda está propagando." | `kubectl port-forward svc/api-gateway 8080:3000` e trocar `ELB` por `localhost:8080` (testado em 05/11: responde 200) |
| Um passo do script falha | "Esse passo falhou; sigo para o próximo." | Enter e continuar; mostrar a evidência gravada em [`evidencias/e2e-eks-2026-11-03.md`](evidencias/e2e-eks-2026-11-03.md) |
| Terceiro Pod não sobe | "Está subindo." | Seguir; não esperar |
| Lab caiu | "A sessão do lab expirou." | Plano B: [`infra-eks.md`](infra-eks.md), seção 5 |

## 6. Perguntas prováveis (quem responde)

| Pergunta | Quem | Resposta curta |
|---|---|---|
| Como prova que dois Pods atenderam? | Lucas | Header `X-Served-By` com nomes diferentes nas 10 requisições. |
| Por que um Ingress só para o gateway? | Lucas | Entrada única; o gateway roteia por path e esconde `/internal` e `/metrics`. Decisão de 27/10. |
| Por que um banco por serviço? | Eduardo | Database per Service: ninguém acessa tabela de outro; só o dono tem a credencial. |
| Como o token é validado? | Eduardo | RS256: assinatura, `iss` e `typ=access`, localmente, sem chamar o authorization a cada requisição. |
| O que acontece se o broker cair? | Rodrigo | O outbox guarda a mensagem e publica quando o broker volta; o pedido já está gravado. |
| E se o promotion cair? | João Liz | O carrinho volta sem desconto (`discounts_applied:false`, timeout de 2 s). |
| Por que Redis no carrinho? | João Liz | Dado temporário com TTL de 7 dias. |
| Por que MongoDB no product? | João Correa | Documento flexível (`attributes`) e índice de texto em português. |
| O dado persiste se o Pod reiniciar? | quem for perguntado | No EKS do lab não: `emptyDir` no lugar de PVC. Nos manifests dos repos há PVC. |
| Quantos serviços usam RabbitMQ? | Lucas | Três de onze: Order publica, Support e Promotion consomem. |

Mais respostas por serviço: [`guia-estudo-n2.md`](guia-estudo-n2.md), seção 7.

## 7. Ensaio

1. Ensaio em seco, sem cluster: cada um lê a própria fala em voz alta com cronômetro (meta: bloco dentro do tempo).
2. Ensaio com cluster, completo e cronometrado, com o Lucas no teclado. O `demo-eks.sh` sozinho levou 33 s em 05/11
   e 31 s em 09/11 (sem as falas); o tempo com as falas só o grupo mede. Em 09/11 os comandos dos blocos 1 a 3 levaram
   poucos segundos; o terceiro Pod do `scale` ficou `1/1` em ~22 s. O ELB respondeu 200 depois de ~1 min do `apply.sh`.
3. Ensaio final sem olhar o roteiro, na ordem da seção 2, e depois apagar o cluster
   ([`infra-eks.md`](infra-eks.md), seção 3).
