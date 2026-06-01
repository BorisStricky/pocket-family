#!/usr/bin/env bash
# Build and run pocket-family containers for self-hosting.
#
# Uses the top-level docker-compose.yaml to build and start the database,
# backend, and frontend on the local host. Intended for home-server /
# local-network deployments (the AWS path lives in build-and-push.sh).
#
# Required:
#   .env.production at the repo root (copy from .env.production.example).
#
# Optional environment variables:
#   ENV_FILE       — path to env file (default: <repo>/.env.production)
#   COMPOSE_FILE   — path to compose file (default: <repo>/docker-compose.yaml)
#   ACTION         — up | down | restart | logs | build | migrate (default: up)
#   DETACH         — set to 0 to run in the foreground (default: 1)
#
# Usage:
#   ./infrastructure/self-host.sh                    # build + start detached
#   ACTION=logs    ./infrastructure/self-host.sh     # tail logs
#   ACTION=down    ./infrastructure/self-host.sh     # stop and remove containers
#   ACTION=restart ./infrastructure/self-host.sh     # rebuild and restart
#   ACTION=migrate ./infrastructure/self-host.sh     # run alembic upgrade head inside backend

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/docker-compose.yaml}"
ACTION="${ACTION:-up}"
DETACH="${DETACH:-1}"

# Resolve the docker compose CLI — prefer the v2 plugin, fall back to legacy v1.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: neither 'docker compose' nor 'docker-compose' is installed." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

# The 'up' / 'build' / 'restart' paths need real secrets in the env file.
# 'down' / 'logs' do not require it, so we only enforce when relevant.
if [[ "$ACTION" =~ ^(up|build|restart)$ ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: env file not found: $ENV_FILE" >&2
    echo "Copy .env.production.example to .env.production and fill in DB_PASSWORD + JWT_SECRET." >&2
    exit 1
  fi

  # Surface unset/placeholder values early instead of getting a cryptic
  # Postgres or JWT error after the containers boot.
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  : "${DB_PASSWORD:?DB_PASSWORD must be set in $ENV_FILE}"
  : "${JWT_SECRET:?JWT_SECRET must be set in $ENV_FILE}"
  if [[ "$DB_PASSWORD" == "change_me_strong_password" \
     || "$JWT_SECRET"  == "replace_me_with_output_of_openssl_rand_hex_32" ]]; then
    echo "ERROR: $ENV_FILE still contains placeholder values. Replace DB_PASSWORD and JWT_SECRET." >&2
    exit 1
  fi
fi

COMPOSE_ARGS=(--file "$COMPOSE_FILE")
[[ -f "$ENV_FILE" ]] && COMPOSE_ARGS+=(--env-file "$ENV_FILE")

echo "==> Repo:       $REPO_ROOT"
echo "==> Compose:    $COMPOSE_FILE"
echo "==> Env file:   $ENV_FILE"
echo "==> Action:     $ACTION"
echo

case "$ACTION" in
  up)
    UP_FLAGS=(--build)
    [[ "$DETACH" == "1" ]] && UP_FLAGS+=(--detach)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" up "${UP_FLAGS[@]}"
    if [[ "$DETACH" == "1" ]]; then
      echo
      "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" ps
      echo
      echo "Frontend: http://localhost:3000"
      echo "Backend:  http://localhost:8000"
      echo "Tail logs with: ACTION=logs $0"
    fi
    ;;
  build)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" build
    ;;
  down)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" down
    ;;
  restart)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" down
    UP_FLAGS=(--build)
    [[ "$DETACH" == "1" ]] && UP_FLAGS+=(--detach)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" up "${UP_FLAGS[@]}"
    ;;
  logs)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" logs --follow --tail=200
    ;;
  migrate)
    # Run alembic inside the already-running backend container — the DB port
    # isn't published to the host, so a host-side alembic can't reach it.
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" exec backend uv run alembic upgrade head
    ;;
  *)
    echo "ERROR: unknown ACTION '$ACTION' (expected: up | down | restart | logs | build)" >&2
    exit 1
    ;;
esac
