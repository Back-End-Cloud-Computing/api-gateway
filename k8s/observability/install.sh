#!/usr/bin/env bash
# Instala Prometheus e Grafana (kube-prometheus-stack) no namespace monitoring do cluster atual
# e carrega os dashboards da solução. Rodar depois do eks/apply.sh (ou do deploy no Minikube).
# Os dashboards dos outros serviços entram se o repo estiver clonado ao lado (../<repo>).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ORG="$(cd "$HERE/../../.." && pwd)"
CHART_VERSION=92.3.0

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo update prometheus-community >/dev/null
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

if ! kubectl -n monitoring get secret grafana-admin >/dev/null 2>&1; then
  kubectl -n monitoring create secret generic grafana-admin \
    --from-literal=admin-user=admin --from-literal=admin-password="$(openssl rand -hex 16)"
fi

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --version "$CHART_VERSION" -n monitoring -f "$HERE/values.yaml" --wait --timeout 10m

for f in "$ORG"/*/k8s/observability/dashboard.json; do
  repo=${f#"$ORG"/}
  name="dashboard-${repo%%/*}"
  kubectl -n monitoring create configmap "$name" --from-file="$name.json=$f" --dry-run=client -o yaml |
    kubectl label --local -f - grafana_dashboard=1 -o yaml | kubectl apply -f -
done

echo "Grafana: kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 8080:80  (http://localhost:8080)"
echo "Senha:   kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d"
