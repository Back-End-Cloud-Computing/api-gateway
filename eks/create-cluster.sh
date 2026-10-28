#!/usr/bin/env bash
# Cria o cluster da N2 no EKS com as roles da sessão atual do Learner Lab.
# Pré-requisito: credenciais da sessão em ~/.aws/credentials (AWS Details > AWS CLI).
set -euo pipefail
cd "$(dirname "$0")"
export AWS_REGION=us-east-1

aws sts get-caller-identity --query Account --output text >/dev/null

# O Learner Lab cria as roles com prefixo e sufixo gerados (ex.: c2...-LabEksClusterRole-D1Ax...).
role_arn() {
  aws iam list-roles --query "Roles[?contains(RoleName,'$1')].Arn | [0]" --output text
}
CLUSTER_ROLE_ARN=$(role_arn LabEksClusterRole)
NODE_ROLE_ARN=$(role_arn LabEksNodeRole)
[[ $CLUSTER_ROLE_ARN == arn:* && $NODE_ROLE_ARN == arn:* ]] || { echo "roles do lab não encontradas" >&2; exit 1; }
export CLUSTER_ROLE_ARN NODE_ROLE_ARN

sed -e "s|\${CLUSTER_ROLE_ARN}|$CLUSTER_ROLE_ARN|" -e "s|\${NODE_ROLE_ARN}|$NODE_ROLE_ARN|" cluster.yaml |
  eksctl create cluster -f -

kubectl get nodes -o wide
