# Chart do api-gateway

Mesmo resultado do `kubectl apply -k k8s/`: ConfigMap, Deployment com 2 réplicas e as anotações do Prometheus,
Service (3000 e 9100) e Ingress só para a porta http. Conferido com `helm template` contra `kubectl kustomize k8s/`:
os quatro objetos saem iguais, fora a anotação `checksum/config`, que reinicia os pods quando a config muda.

```bash
helm lint helm/api-gateway
helm upgrade --install api-gateway helm/api-gateway                          # Minikube (api.ganjj.local)
helm upgrade --install api-gateway helm/api-gateway --set ingress.host=      # EKS: regra sem host, atende pelo ELB
helm uninstall api-gateway
```

| Valor | Padrão | Para quê |
|---|---|---|
| `image.tag` | vazio (`appVersion`) | versão da imagem `bascratki/api-gateway` |
| `replicaCount` | `2` | réplicas; duas mostram o balanceamento pelo `X-Gateway-Served-By` |
| `ingress.host` | `api.ganjj.local` | vazio no EKS, onde o hostname do ELB não é `api.ganjj.local` |
| `config.*_URL` | Services dos outros repos | upstreams; mudam só se um Service mudar de nome ou porta |
| `config.RATE_LIMIT_*`, `config.UPSTREAM_TIMEOUT_*` | iguais ao `k8s/configmap.yaml` | limites e timeouts |

O gateway não tem secret: a chave pública do JWT vem do authorization (`AUTH_BASE_URL`) e o pod só fica Ready
depois de baixá-la.
