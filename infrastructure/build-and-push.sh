#!/usr/bin/env bash
# Build and push pocket-family Docker images to ECR.
#
# Used by both the Terraform stack (us-east-1) and the CloudFormation stack (us-east-2).
# The same script handles either region — pass AWS_REGION to control where images land.
#
# Required environment variables:
#   AWS_REGION       — target region (e.g. us-east-1)
#   AWS_ACCOUNT_ID   — 12-digit AWS account ID
#
# Optional environment variables:
#   IMAGE_TAG        — tag applied to both images (default: latest)
#   BUILD_BACKEND    — set to 0 to skip backend build (default: 1)
#   BUILD_FRONTEND   — set to 0 to skip frontend build (default: 1)
#
# Usage:
#   AWS_REGION=us-east-1 AWS_ACCOUNT_ID=123456789012 ./infrastructure/build-and-push.sh
#   AWS_REGION=us-east-2 AWS_ACCOUNT_ID=123456789012 IMAGE_TAG=v1.0.0 ./infrastructure/build-and-push.sh

set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required (e.g. us-east-1)}"
: "${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required (12-digit account ID)}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_BACKEND="${BUILD_BACKEND:-1}"
BUILD_FRONTEND="${BUILD_FRONTEND:-1}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BACKEND_REPO="${ECR_REGISTRY}/pocket-family-backend"
FRONTEND_REPO="${ECR_REGISTRY}/pocket-family-frontend"

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

echo
echo "==> Done. Image URIs:"
[[ "$BUILD_FRONTEND" == "1" ]] && echo "    ${FRONTEND_REPO}:${IMAGE_TAG}"
[[ "$BUILD_BACKEND"  == "1" ]] && echo "    ${BACKEND_REPO}:${IMAGE_TAG}"
echo
echo "Force ECS to pick up the new images with:"
echo "  aws ecs update-service --cluster pocket-family --service pocket-family-svc --force-new-deployment --region $AWS_REGION"
