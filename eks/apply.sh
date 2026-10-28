#!/usr/bin/env bash
# Sobe os 11 serviços do GANJJ no cluster EKS do contexto atual do kubectl.
# Os clones dos repos ficam lado a lado com o api-gateway (../<repo>).
#
# O que muda em relação ao k8s/ de cada repo, sem editar os repos:
# - Secrets gerados aqui, uma vez por cluster (rodar de novo não troca senha de banco já inicializado).
# - PVC vira emptyDir: o node role do Learner Lab não tem a policy do EBS CSI, então PVC fica Pending.
#   Dado some quando o pod é recriado; serve para a demonstração, não para produção.
# - Réplicas em 1, exceto api-gateway e promotion (2), que provam o balanceamento.
# - Só o Ingress do gateway entra (entrada única), sem host: o ELB não resolve api.ganjj.local.
set -euo pipefail
ORG="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ORG"

INGRESS_NGINX=https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/aws/deploy.yaml
PEM=authorization/keys/public.pem
[[ -f $PEM && -f authorization/keys/private.pem ]] || { echo "faltam as chaves em authorization/keys (scripts/generate-keys.sh do authorization)" >&2; exit 1; }

rand() { openssl rand -hex 16; }
exists() { kubectl get "$1" "$2" >/dev/null 2>&1; }

# Secrets: só cria o que não existe. Valores nunca saem no terminal.
# promotion-secrets é o último criado: se ele existe, o bloco já rodou inteiro.
if ! exists secret promotion-secrets; then
  INTERNAL=$(rand)
  RMQ_USER=ganjj RMQ_PASS=$(rand)
  SA_PASS="Ganjj-$(rand)"
  kubectl create secret generic product-secrets --from-literal=INTERNAL_SECRET="$INTERNAL"
  kubectl create secret generic shopping-cart-secrets --from-literal=internal-secret="$INTERNAL"
  kubectl create secret generic order-secrets --from-literal=internal-secret="$INTERNAL" \
    --from-literal=sqlserver-sa-password="$SA_PASS" \
    --from-literal=connection-string="Server=order-sqlserver,1433;Database=GanjjOrder;User Id=sa;Password=$SA_PASS;TrustServerCertificate=True"
  kubectl create secret generic rabbitmq-credentials --from-literal=username="$RMQ_USER" --from-literal=password="$RMQ_PASS"
  kubectl create secret generic support-credentials --from-literal=internal-secret="$INTERNAL" \
    --from-literal=amqp-url="amqp://$RMQ_USER:$RMQ_PASS@rabbitmq:5672"
  kubectl create secret generic authorization-credentials --from-literal=db-password="$(rand)" \
    --from-literal=admin-password="$(rand)" --from-literal=oracle-password="$(rand)"
  kubectl create secret generic client-credentials --from-literal=db-password="$(rand)"
  kubectl create secret generic jwt-keys --from-file=private.pem=authorization/keys/private.pem --from-file=public.pem=$PEM
  kubectl create configmap jwt-public-key --from-file=public.pem=$PEM
  kubectl create configmap order-jwt-public-key --from-file=public.pem=$PEM
  kubectl create secret generic promotion-secrets --from-literal=APP_KEY="base64:$(openssl rand -base64 32)" \
    --from-literal=DB_PASSWORD="$(rand)" --from-literal=INTERNAL_SECRET="$INTERNAL"
fi

# Filtro dos manifests (arquivos ou stdin): tira PVC e Ingress, troca claim por emptyDir, reduz réplicas.
# Cada arquivo é processado sozinho e fecha com `---`: concatenar com cat cola o último doc de um
# arquivo no primeiro do seguinte, e o kubectl fica só com o segundo.
eks() {
  perl -0777 -ne '
    @d = grep { !/^kind: (PersistentVolumeClaim|Ingress)\s*$/m } split /^---\s*$/m;
    $_ = join "---\n", @d;
    s/persistentVolumeClaim:\s*\n\s*claimName: \S+/emptyDir: {}/g;
    s/^  volumeClaimTemplates:\n    - metadata:\n        name: (\S+)\n(?:      .*\n?)*/      volumes:\n        - name: $1\n          emptyDir: {}\n/mg;
    s/^  replicas: \d+$/  replicas: 1/mg unless $ENV{KEEP_REPLICAS};
    print "$_\n---\n";' "$@"
}

kubectl apply -f "$INGRESS_NGINX"

eks authorization/k8s/oracle.yaml authorization/k8s/authorization.yaml | kubectl apply -f -
eks client/k8s/postgres.yaml client/k8s/client.yaml | kubectl apply -f -
eks vector-db/k8s/chromadb.yaml vector-db/k8s/vector-db.yaml | kubectl apply -f -
eks embedding-reranking/k8s/embedding-reranking.yaml | kubectl apply -f -
eks llm-provider/k8s/llm-provider.yaml | kubectl apply -f -
eks product/k8s/mongodb.yaml product/k8s/product.yaml | kubectl apply -f -
eks shopping-cart/k8s/redis.yaml shopping-cart/k8s/shopping-cart.yaml | kubectl apply -f -
eks order/k8s/order-sqlserver.yaml order/k8s/order.yaml | kubectl apply -f -
eks support/k8s/rabbitmq.yaml support/k8s/mailpit.yaml support/k8s/support.yaml | kubectl apply -f -
kubectl kustomize promotion/k8s | KEEP_REPLICAS=1 eks | kubectl apply -f -
kubectl kustomize api-gateway/k8s | KEEP_REPLICAS=1 eks | kubectl apply -f -
# O webhook de admissão recusa Ingress até ganhar endpoint, um pouco depois do deploy ficar available.
kubectl -n ingress-nginx wait --for=condition=available deploy/ingress-nginx-controller --timeout=300s
for _ in $(seq 30); do
  sed -e 's/^    - host: .*/    - http:/' -e '/^      http:$/d' api-gateway/k8s/ingress.yaml | kubectl apply -f - && break
  sleep 5
done

kubectl -n ingress-nginx get svc ingress-nginx-controller
echo "ELB: kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
