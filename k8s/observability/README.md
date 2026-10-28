# Observabilidade

Prometheus e Grafana para a solução toda, instalados uma vez por cluster:

```bash
bash k8s/observability/install.sh
```

- `kube-prometheus-stack` 92.3.0 no namespace `monitoring` ([`values.yaml`](values.yaml)), sem Alertmanager e sem
  os alvos do control plane, que o EKS não expõe.
- O Prometheus raspa todo pod com `prometheus.io/scrape: "true"`, na porta e no path das anotações. Cada série
  ganha os labels `namespace`, `pod` e `app`. O gateway publica as métricas na 9100, porta que o Ingress não expõe.
- O Grafana carrega como ConfigMap (sidecar, label `grafana_dashboard=1`) todo `k8s/observability/dashboard.json`
  dos repos clonados ao lado do `api-gateway`. Hoje: este, `promotion`, `authorization`, `client` e `support`.
- A senha do `admin` fica no Secret `grafana-admin`, gerado pelo script e nunca versionado.

```bash
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 8080:80          # http://localhost:8080
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n monitoring port-forward svc/kube-prometheus-stack-prometheus 9090:9090     # Status > Targets
```

## Dashboard da solução

[`dashboard.json`](dashboard.json) (`GANJJ / solução (api-gateway)`) lê as métricas `gateway_*`. Como o gateway é
a porta de entrada, o painel cobre todos os serviços:

| Painel | Métrica |
|---|---|
| Requisições/s por serviço | `gateway_requests_total` por `upstream` |
| Latência p95 por serviço | `gateway_request_duration_seconds` |
| Requisições/s por pod do gateway | `gateway_requests_total` por `pod`: mostra o balanceamento entre as réplicas |
| Respostas 5xx/s | `gateway_requests_total{status=~"5.."}` |
| Recusas 401 e 429/s | `gateway_auth_rejected_total`, `gateway_rate_limited_total` |
| Falhas ao falar com o serviço/s | `gateway_upstream_errors_total` por `upstream` e `kind` |

A fonte de dados é a variável `datasource` do dashboard, e não `__inputs`. Assim o mesmo JSON funciona no import
manual (Dashboards > Import) e no sidecar, sem edição. Os painéis só mostram dados depois de tráfego pelo Ingress.
Conferido no EKS em 28/10/2026: os 13 pods anotados ficaram `up` e todas as queries do painel retornaram série.
