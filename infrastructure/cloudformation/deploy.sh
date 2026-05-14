#!/usr/bin/env bash
# Deploy (or update) the pocket-family CloudFormation stack.
#
# Defaults to us-east-2 to avoid colliding with the live sa-east-1 manual
# deployment and the Terraform us-east-1 stack.
#
# Required environment variables (or pass via flags below):
#   DB_MASTER_PASSWORD   — `openssl rand -base64 24`
#   JWT_SECRET           — `openssl rand -hex 32`
#   VPC_ID               — VPC ID, e.g. vpc-0abc123
#   SUBNET_IDS           — Comma-separated subnet IDs, e.g. subnet-aaa,subnet-bbb
#
# Optional:
#   AWS_REGION           — default us-east-2
#   STACK_NAME           — default pocket-family
#   CORS_ORIGINS         — leave empty on first deploy, set to ALB DNS afterwards
#   IMAGE_TAG            — default latest

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-2}"
STACK_NAME="${STACK_NAME:-pocket-family}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CORS_ORIGINS="${CORS_ORIGINS:-}"

: "${DB_MASTER_PASSWORD:?DB_MASTER_PASSWORD is required (openssl rand -base64 24)}"
: "${JWT_SECRET:?JWT_SECRET is required (openssl rand -hex 32)}"
: "${VPC_ID:?VPC_ID is required (e.g. vpc-0abc123 — the default VPC works)}"
: "${SUBNET_IDS:?SUBNET_IDS is required (comma-separated, at least 2 across AZs)}"

TEMPLATE_FILE="$(dirname "${BASH_SOURCE[0]}")/pocket-family-stack.yaml"

echo "==> Validating template..."
aws cloudformation validate-template \
  --template-body "file://${TEMPLATE_FILE}" \
  --region "$AWS_REGION" > /dev/null

echo "==> Deploying stack '$STACK_NAME' to $AWS_REGION..."
aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    "DbMasterPassword=${DB_MASTER_PASSWORD}" \
    "JwtSecret=${JWT_SECRET}" \
    "VpcId=${VPC_ID}" \
    "SubnetIds=${SUBNET_IDS}" \
    "ImageTag=${IMAGE_TAG}" \
    "CorsOrigins=${CORS_ORIGINS}"

echo
echo "==> Stack outputs:"
aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table
