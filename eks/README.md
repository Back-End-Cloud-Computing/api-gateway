# GANJJ no Amazon EKS (AWS Academy Learner Lab)

Kit da N2 seguindo o lab Back L06 (MyTracker no EKS): cluster com `eksctl` e as roles prontas do Learner Lab,
NGINX Ingress Controller com o manifest AWS e os `k8s/` dos 11 repos aplicados sem alteração nos repos.

## Pré-requisitos

- `aws`, `eksctl` e `kubectl` instalados; `openssl` e `perl` (já vêm no macOS e no Linux).
- Os 11 repos clonados lado a lado com o `api-gateway`, na `main` atualizada.
- Chaves JWT em `authorization/keys/` (`scripts/generate-keys.sh` do authorization).
- Learner Lab iniciado e as credenciais de **AWS Details > AWS CLI** em `~/.aws/credentials` (ou nas variáveis
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_SESSION_TOKEN`). Elas vencem com a sessão (4h). Nunca no Git.

## Subir

```bash
bash eks/create-cluster.sh   # 15 a 20 min; acha as roles LabEks* da sessão e grava o kubeconfig
bash eks/apply.sh            # Ingress NGINX, secrets e os 11 serviços
kubectl get pods -A -w       # até tudo ficar Ready (SQL Server e Oracle demoram)
```

`apply.sh` pode rodar de novo: os secrets só são criados na primeira vez.

Prometheus e Grafana (opcional, extra da rubrica): `bash k8s/observability/install.sh`, ver
[`k8s/observability/README.md`](../k8s/observability/README.md).

| Diferença em relação ao `k8s/` de cada repo | Por quê |
|---|---|
| PVC trocado por `emptyDir` (`promotion-db-data`, `support-data`, volume do SQL Server do Order) | o node role do Learner Lab não tem a policy do EBS CSI e o lab não deixa anexar; PVC ficaria `Pending`. Dado some quando o pod é recriado |
| Réplicas em 1, exceto `api-gateway` e `promotion` (2) | caber em 2 nodes `t3.large` e ainda provar balanceamento |
| Só o Ingress do gateway, sem `host` | gateway é a entrada única; o hostname do ELB não resolve `api.ganjj.local` |
| Secrets gerados com `openssl rand` | nenhum valor versionado; `INTERNAL_SECRET` igual em todos os serviços |

Senha do admin do Authorization:
`kubectl get secret authorization-credentials -o jsonpath='{.data.admin-password}' | base64 -d`

## Evidência

```bash
ELB=$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl -i "http://$ELB/api/sale"
for i in $(seq 10); do curl -s -o /dev/null -D - "http://$ELB/api/sale" | grep -i served-by; done
kubectl exec deploy/promotion -c promotion -- php artisan db:seed --force   # cupons de demonstração
kubectl exec deploy/rabbitmq -- rabbitmqctl list_queues name messages consumers
kubectl logs deploy/promotion-consumer -f
```

O DNS do ELB leva alguns minutos para propagar depois que o Service ganha `EXTERNAL-IP`. Não há painel do
RabbitMQ: a imagem do support (`rabbitmq:4.1-alpine`) não traz o plugin de management. Execução completa de
27/10/2026: [evidência no promotion](https://github.com/Back-End-Cloud-Computing/promotion/blob/main/docs/evidencias/eks-2026-10-27.md).

## Apagar (sempre no fim)

Control plane, EC2 e ELB consomem o crédito do Learner Lab mesmo com a sessão parada.

```bash
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/aws/deploy.yaml
eksctl delete cluster --name ganjj --region us-east-1
aws eks list-clusters --region us-east-1
```

O controller sai primeiro para o ELB não ficar órfão e travar a remoção da VPC. Depois confira no Console
(EC2 > Load Balancers) se não sobrou nada.
