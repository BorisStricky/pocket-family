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
#   ./infrastructure/self-host.sh                    # build, migrate, start detached
#   ACTION=migrate ./infrastructure/self-host.sh     # apply DB migrations only
#   ACTION=logs    ./infrastructure/self-host.sh     # tail logs
#   ACTION=down    ./infrastructure/self-host.sh     # stop and remove containers
#   ACTION=restart ./infrastructure/self-host.sh     # rebuild, migrate, and restart
#
# Schema note: the backend no longer auto-creates tables on startup outside local
# dev (AUTO_CREATE_SCHEMA=0 in .env.production), so `up`/`restart` run
# `alembic upgrade head` before starting the services. Alembic is idempotent — a
# no-op once the DB is already at head.

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

# The 'up' / 'build' / 'restart' / 'migrate' paths need real secrets in the env file
# ('migrate' connects to the DB). 'down' / 'logs' do not, so we only enforce when relevant.
if [[ "$ACTION" =~ ^(up|build|restart|migrate)$ ]]; then
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

# Apply Alembic migrations in a throwaway backend container. `run --rm` starts the
# backend's depends_on (db), runs the command, then removes the container. This is
# the self-host counterpart of the one-off pocket-family-migrate ECS task on AWS.
run_migrations() {
  echo "==> Applying database migrations (alembic upgrade head)..."
  "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" run --rm backend uv run alembic upgrade head
}

echo "==> Repo:       $REPO_ROOT"
echo "==> Compose:    $COMPOSE_FILE"
echo "==> Env file:   $ENV_FILE"
echo "==> Action:     $ACTION"
echo

case "$ACTION" in
  up)
    # Build first so run_migrations and the services use the freshly-built image,
    # then apply migrations before the backend starts serving requests.
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" build
    run_migrations
    UP_FLAGS=()
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
  migrate)
    run_migrations
    ;;
  down)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" down
    ;;
  restart)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" down
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" build
    run_migrations
    UP_FLAGS=()
    [[ "$DETACH" == "1" ]] && UP_FLAGS+=(--detach)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" up "${UP_FLAGS[@]}"
    ;;
  logs)
    "${COMPOSE[@]}" "${COMPOSE_ARGS[@]}" logs --follow --tail=200
    ;;
  *)
    echo "ERROR: unknown ACTION '$ACTION' (expected: up | down | restart | logs | build | migrate)" >&2
    exit 1
    ;;
esac
