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
#   RUN_MIGRATIONS   — set to 0 to skip the DB migration step (default: 1). When 1
#                      and the backend image was built, the script runs the
#                      pocket-family-migrate ECS task and waits for it to finish
#                      BEFORE any rollout. A failed migration aborts the script, so
#                      the running services keep the old image + schema. Idempotent:
#                      `alembic upgrade head` is a no-op when already at head.
#   MIGRATE_TASK     — migrate task definition (default: pocket-family-migrate)
#   MIGRATE_SUBNETS  — comma-separated subnet IDs for the migrate task's awsvpc config
#                      (default: auto-discovered default-VPC subnets)
#   MIGRATE_SECURITY_GROUPS — comma-separated SG IDs for the migrate task
#                      (default: the ${ECS_CLUSTER}-fargate security group)
#
# IAM: credentials running this script need ecs:RunTask + iam:PassRole (task and
# execution roles) on the migrate task, on top of the ECR push permissions.
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
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
MIGRATE_TASK="${MIGRATE_TASK:-pocket-family-migrate}"

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

# Step 5 — apply database migrations before any service picks up the new image.
# The migration runs INSIDE the VPC as a one-off ECS task (the operator's machine
# can't reach Aurora directly), and must succeed before any rollout — a failed
# migration aborts the script, leaving the running services on the old image+schema.
if [[ "$RUN_MIGRATIONS" == "1" && "$BUILD_BACKEND" == "1" ]]; then
  echo "==> Applying database migrations via ECS task '$MIGRATE_TASK'..."

  # Resolve awsvpc network config (override with MIGRATE_SUBNETS / MIGRATE_SECURITY_GROUPS).
  if [[ -z "${MIGRATE_SUBNETS:-}" ]]; then
    MIGRATE_SUBNETS=$(aws ec2 describe-subnets --region "$AWS_REGION" \
      --filters Name=default-for-az,Values=true \
      --query 'Subnets[].SubnetId' --output text | tr '\t' ',')
  fi
  if [[ -z "${MIGRATE_SECURITY_GROUPS:-}" ]]; then
    MIGRATE_SECURITY_GROUPS=$(aws ec2 describe-security-groups --region "$AWS_REGION" \
      --filters "Name=group-name,Values=${ECS_CLUSTER}-fargate" \
      --query 'SecurityGroups[0].GroupId' --output text)
  fi
  if [[ -z "$MIGRATE_SUBNETS" || -z "$MIGRATE_SECURITY_GROUPS" || "$MIGRATE_SECURITY_GROUPS" == "None" ]]; then
    echo "ERROR: could not resolve migrate network config" >&2
    echo "       (subnets='$MIGRATE_SUBNETS' security_groups='$MIGRATE_SECURITY_GROUPS')." >&2
    echo "       Set MIGRATE_SUBNETS and MIGRATE_SECURITY_GROUPS explicitly and retry." >&2
    exit 1
  fi

  NETWORK_CONFIG="awsvpcConfiguration={subnets=[$MIGRATE_SUBNETS],securityGroups=[$MIGRATE_SECURITY_GROUPS],assignPublicIp=ENABLED}"

  TASK_ARN=$(aws ecs run-task --region "$AWS_REGION" --cluster "$ECS_CLUSTER" \
    --task-definition "$MIGRATE_TASK" --launch-type FARGATE \
    --network-configuration "$NETWORK_CONFIG" \
    --query 'tasks[0].taskArn' --output text)
  if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
    echo "ERROR: failed to start migrate task '$MIGRATE_TASK'." >&2
    exit 1
  fi
  echo "    Started $TASK_ARN — waiting for it to stop..."
  aws ecs wait tasks-stopped --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN"

  EXIT_CODE=$(aws ecs describe-tasks --region "$AWS_REGION" --cluster "$ECS_CLUSTER" \
    --tasks "$TASK_ARN" --query 'tasks[0].containers[0].exitCode' --output text)
  if [[ "$EXIT_CODE" != "0" ]]; then
    echo "ERROR: migration task exited with code '$EXIT_CODE' — aborting before rollout." >&2
    echo "       Inspect CloudWatch logs: group /ecs/$ECS_CLUSTER, stream prefix 'migrate'." >&2
    exit 1
  fi
  echo "    Migrations applied (exit 0)."
  echo
elif [[ "$RUN_MIGRATIONS" == "1" ]]; then
  echo "==> Skipping migrations (BUILD_BACKEND=0 — no new backend image)."
  echo
fi

# Step 6 — optionally trigger an ECS rollout so running tasks pick up the
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
