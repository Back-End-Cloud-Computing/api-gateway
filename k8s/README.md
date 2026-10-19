# Manifests Kubernetes — API Gateway

Namespace `default`, Ingress `nginx`, host `api.ganjj.local`. O gateway não tem Secret: não conhece `x-internal-secret`
e a chave pública do `authorization` não é segredo.

## Subir

```bash
docker build -t bascratki/api-gateway:1.0.0 .
minikube image load bascratki/api-gateway:1.0.0   # ou docker push bascratki/api-gateway:1.0.0
kubectl apply -k k8s/
kubectl rollout status deploy/api-gateway
```

## Verificar

```bash
curl -H 'Host: api.ganjj.local' http://$(minikube ip)/api/sale     # 200, sem token
curl -H 'Host: api.ganjj.local' http://$(minikube ip)/products      # 401, sem token
curl -H 'Host: api.ganjj.local' http://$(minikube ip)/internal/x    # 404, fora da tabela de rotas
kubectl port-forward deploy/api-gateway 9100 && curl localhost:9100/metrics
```

`/health/ready` devolve 503 até a chave pública ser carregada; o `authorization` precisa estar de pé.

## Observabilidade

O Prometheus lê `prometheus.io/*` do pod (porta 9100). Painel do Grafana entra em `k8s/observability/` depois da aula de 03/11.
