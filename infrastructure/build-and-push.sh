#!/usr/bin/env bash
# Build and push pocket-family Docker images to ECR.
#
# Used by both the Terraform stack (us-east-1) and the CloudFormation stack (us-east-2).
# The same script handles either region — pass AWS_REGION to control where images land.
#
# Required environment variables:
#   AWS_ACCESS_KEY_ID     — IAM user access key (or use `aws configure`)
#   AWS_SECRET_ACCESS_KEY — IAM user secret key (or use `aws configure`)
#   AWS_REGION            — target region (e.g. us-east-1)
#   AWS_ACCOUNT_ID        — 12-digit AWS account ID
#
# (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are only required if you have
# not run `aws configure` to persist credentials to ~/.aws/credentials.)
#
# Optional environment variables:
#   IMAGE_TAG        — tag applied to both images (default: latest)
#   BUILD_BACKEND    — set to 0 to skip backend build (default: 1)
#   BUILD_FRONTEND   — set to 0 to skip frontend build (default: 1)
#   BUILD_IMPORT_WORKER — set to 0 to skip import worker build (default: 1)
#   DEMO_MODE        — set to 1 to bake the demo build flag into the frontend
#                      image (default: 0). The backend honours DEMO_MODE at
#                      runtime via the ECS task definition; only the frontend
#                      needs it baked in because Vite resolves env vars at
#                      build time.
#   FORCE_NEW_DEPLOYMENT — set to 1 to trigger `aws ecs update-service
#                      --force-new-deployment` after the push (default: 0).
#                      Use when the image tag stays the same (e.g. `latest`)
#                      and the ECS task definition is unchanged — otherwise
#                      ECS won't know to re-pull. Targets the cluster/service
#                      named below (override with ECS_CLUSTER / ECS_SERVICE).
#   ECS_CLUSTER      — ECS cluster name for FORCE_NEW_DEPLOYMENT (default: pocket-family)
#   ECS_SERVICE      — ECS service name for FORCE_NEW_DEPLOYMENT (default: pocket-family-svc)
#   ECS_WORKER_SERVICE — Worker ECS service name (default: pocket-family-import-worker-svc)
#
# Usage:
#   export AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=...   # if not using `aws configure`
#   AWS_REGION=us-east-1 AWS_ACCOUNT_ID=123456789012 ./infrastructure/build-and-push.sh
#   AWS_REGION=us-east-2 AWS_ACCOUNT_ID=123456789012 IMAGE_TAG=v1.0.0 ./infrastructure/build-and-push.sh

set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required (e.g. us-east-1)}"
: "${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required (12-digit account ID)}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_BACKEND="${BUILD_BACKEND:-1}"
BUILD_FRONTEND="${BUILD_FRONTEND:-1}"
BUILD_IMPORT_WORKER="${BUILD_IMPORT_WORKER:-1}"
DEMO_MODE="${DEMO_MODE:-0}"
FORCE_NEW_DEPLOYMENT="${FORCE_NEW_DEPLOYMENT:-0}"
ECS_CLUSTER="${ECS_CLUSTER:-pocket-family}"
ECS_SERVICE="${ECS_SERVICE:-pocket-family-svc}"
ECS_WORKER_SERVICE="${ECS_WORKER_SERVICE:-pocket-family-import-worker-svc}"

# Map our 0/1 sh-friendly flag onto the "true"/"false" string the Vite build
# expects via VITE_DEMO_MODE (compared directly in src/lib/constants.ts).
if [[ "$DEMO_MODE" == "1" ]]; then
  VITE_DEMO_MODE_VALUE="true"
else
  VITE_DEMO_MODE_VALUE="false"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BACKEND_REPO="${ECR_REGISTRY}/pocket-family-backend"
FRONTEND_REPO="${ECR_REGISTRY}/pocket-family-frontend"
IMPORT_WORKER_REPO="${ECR_REGISTRY}/pocket-family-import-worker"

# Capture the current git SHA so we can also tag images with an immutable reference.
# Falls back to "unknown" if not in a git repo (e.g. running from a tarball).
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "==> Region:     $AWS_REGION"
echo "==> Account:    $AWS_ACCOUNT_ID"
echo "==> Registry:   $ECR_REGISTRY"
echo "==> Image tag:  $IMAGE_TAG (also tagging with $GIT_SHA)"
echo

# Step 1 — authenticate Docker to ECR in the target region.
echo "==> Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Step 2 — build frontend with AWS-specific build args (nginx.aws.conf proxies to localhost:8000).
if [[ "$BUILD_FRONTEND" == "1" ]]; then
  echo
  echo "==> Building frontend image..."
  docker build \
    -t "pocket-family-frontend:${IMAGE_TAG}" \
    --build-arg NGINX_CONF=nginx.aws.conf \
    --build-arg VITE_API_URL=/api \
    --build-arg VITE_DEMO_MODE="$VITE_DEMO_MODE_VALUE" \
    "$REPO_ROOT/frontend"

  docker tag "pocket-family-frontend:${IMAGE_TAG}" "${FRONTEND_REPO}:${IMAGE_TAG}"
  docker tag "pocket-family-frontend:${IMAGE_TAG}" "${FRONTEND_REPO}:${GIT_SHA}"

  echo "==> Pushing frontend image..."
  docker push "${FRONTEND_REPO}:${IMAGE_TAG}"
  docker push "${FRONTEND_REPO}:${GIT_SHA}"
fi

# Step 3 — build backend (no build args needed; all config is runtime via ECS task definition).
if [[ "$BUILD_BACKEND" == "1" ]]; then
  echo
  echo "==> Building backend image..."
  docker build \
    -t "pocket-family-backend:${IMAGE_TAG}" \
    --file "$REPO_ROOT/backend/api/Dockerfile" \
    "$REPO_ROOT/backend"

  docker tag "pocket-family-backend:${IMAGE_TAG}" "${BACKEND_REPO}:${IMAGE_TAG}"
  docker tag "pocket-family-backend:${IMAGE_TAG}" "${BACKEND_REPO}:${GIT_SHA}"

  echo "==> Pushing backend image..."
  docker push "${BACKEND_REPO}:${IMAGE_TAG}"
  docker push "${BACKEND_REPO}:${GIT_SHA}"
fi

# Step 4 — build import worker (no build args; config is runtime via ECS task definition).
if [[ "$BUILD_IMPORT_WORKER" == "1" ]]; then
  echo
  echo "==> Building import-worker image..."
  docker build \
    -t "pocket-family-import-worker:${IMAGE_TAG}" \
    "$REPO_ROOT/import-service"

  docker tag "pocket-family-import-worker:${IMAGE_TAG}" "${IMPORT_WORKER_REPO}:${IMAGE_TAG}"
  docker tag "pocket-family-import-worker:${IMAGE_TAG}" "${IMPORT_WORKER_REPO}:${GIT_SHA}"

  echo "==> Pushing import-worker image..."
  docker push "${IMPORT_WORKER_REPO}:${IMAGE_TAG}"
  docker push "${IMPORT_WORKER_REPO}:${GIT_SHA}"
fi

echo
echo "==> Done. Image URIs:"
[[ "$BUILD_FRONTEND"      == "1" ]] && echo "    ${FRONTEND_REPO}:${IMAGE_TAG}"
[[ "$BUILD_BACKEND"       == "1" ]] && echo "    ${BACKEND_REPO}:${IMAGE_TAG}"
[[ "$BUILD_IMPORT_WORKER" == "1" ]] && echo "    ${IMPORT_WORKER_REPO}:${IMAGE_TAG}"
echo

# Step 5 — optionally trigger an ECS rollout so running tasks pick up the
# newly-pushed images. Required when the image tag is reused (e.g. `latest`)
# because ECS otherwise sees no change and won't re-pull. We force-deploy each
# service whose image was rebuilt in this run.
if [[ "$FORCE_NEW_DEPLOYMENT" == "1" ]]; then
  if [[ "$BUILD_BACKEND" == "1" || "$BUILD_FRONTEND" == "1" ]]; then
    echo "==> Forcing new ECS deployment on $ECS_CLUSTER/$ECS_SERVICE..."
    aws ecs update-service \
      --cluster "$ECS_CLUSTER" \
      --service "$ECS_SERVICE" \
      --force-new-deployment \
      --region "$AWS_REGION" \
      --no-cli-pager > /dev/null
  fi
  if [[ "$BUILD_IMPORT_WORKER" == "1" ]]; then
    echo "==> Forcing new ECS deployment on $ECS_CLUSTER/$ECS_WORKER_SERVICE..."
    aws ecs update-service \
      --cluster "$ECS_CLUSTER" \
      --service "$ECS_WORKER_SERVICE" \
      --force-new-deployment \
      --region "$AWS_REGION" \
      --no-cli-pager > /dev/null
  fi
  echo "==> Deployment(s) triggered. Watch progress with:"
  echo "    aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE $ECS_WORKER_SERVICE --region $AWS_REGION --query 'services[].deployments'"
else
  echo "Force ECS to pick up the new images with:"
  echo "  aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment --region $AWS_REGION"
  echo "  aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_WORKER_SERVICE --force-new-deployment --region $AWS_REGION"
  echo "  (or re-run this script with FORCE_NEW_DEPLOYMENT=1)"
fi
