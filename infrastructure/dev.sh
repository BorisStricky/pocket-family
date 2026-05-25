#!/usr/bin/env bash
# One-command dev launcher for pocket-family.
#
# Stateful infra (Postgres, Redis) runs in Docker via docker-compose.dev.yml.
# Your code (FastAPI API, Celery worker, Vite frontend) runs on the host so
# every iterated process gets native hot-reload, breakpoints and stdout logs.
#
# Usage:
#   ./infrastructure/dev.sh             # default: ACTION=up
#   ACTION=down  ./infrastructure/dev.sh    # kill host processes + stop containers
#   ACTION=infra ./infrastructure/dev.sh    # only start Postgres + Redis
#   ACTION=seed  ./infrastructure/dev.sh    # wipe + re-seed db-dev with QA data
#   ACTION=logs  ./infrastructure/dev.sh    # tail container logs
#
# Optional:
#   STOP_INFRA=1  → also stop db-dev/redis-dev on Ctrl+C (default leaves them
#                   running so the next `dev.sh up` starts in seconds)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
ACTION="${ACTION:-up}"
STOP_INFRA="${STOP_INFRA:-0}"

# Load the repo-root .env so JWT_SECRET (and any other vars) are visible
# to every subshell we launch. None of our Python entry points auto-load
# .env, so without this the API and the seed script fail at import time
# with "JWT_SECRET environment variable is required". Per-subshell
# DATABASE_URL overrides below still take precedence over the one in .env.
#
# We read line-by-line instead of `source`-ing so unquoted values with
# spaces (e.g. VITE_TEST_USER_NAME=Test User) don't break the shell.
if [[ -f "$REPO_ROOT/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip blank lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # Must look like KEY=VALUE
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    # Strip wrapping quotes if present
    [[ "$value" == \"*\" || "$value" == \'*\' ]] && value="${value:1:-1}"
    export "$key=$value"
  done < "$REPO_ROOT/.env"
fi
: "${JWT_SECRET:?JWT_SECRET must be set (add it to $REPO_ROOT/.env — see .env.example)}"

# Shared local upload dir — backend writes here, worker reads from here.
# Both processes must agree on this path, so we set it once and export.
UPLOAD_DIR="$REPO_ROOT/.dev-uploads"

# Prefer the v2 plugin, fall back to legacy v1 (mirrors self-host.sh).
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: neither 'docker compose' nor 'docker-compose' is installed." >&2
  exit 1
fi

start_infra() {
  echo "==> Starting db-dev + redis-dev (Docker)…"
  "${COMPOSE[@]}" --file "$COMPOSE_FILE" up --detach db-dev redis-dev
  # Wait until both containers report healthy before launching dependents.
  for service in db-dev redis-dev; do
    printf "==> Waiting for %s to be healthy" "$service"
    for _ in $(seq 1 30); do
      status=$("${COMPOSE[@]}" --file "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null \
        | grep -oE '"Health":"[^"]*"' | head -n1 | cut -d'"' -f4 || true)
      if [[ "$status" == "healthy" ]]; then
        echo " ✓"
        break
      fi
      printf "."
      sleep 1
    done
  done
}

case "$ACTION" in
  up)
    mkdir -p "$UPLOAD_DIR"
    start_infra

    # Env shared by API and worker. Each subshell picks the right DB driver.
    export BROKER_URL="redis://localhost:6379/0"
    export RESULT_BACKEND="redis://localhost:6379/1"
    export STORAGE_BACKEND="local"
    export LOCAL_UPLOAD_DIR="$UPLOAD_DIR"
    # db-dev publishes 5432 → host 5433 (see docker-compose.dev.yml)
    DB_HOST_URL_BASE="postgres:postgres@localhost:5433/pfinancedb_dev"

    echo
    echo "==> Launching host processes (API, worker, frontend)…"
    echo "    Upload dir: $UPLOAD_DIR"
    echo "    Ctrl+C to stop. STOP_INFRA=1 also stops Postgres/Redis."
    echo

    # Dev API listens on 8001 (not 8000) so it can coexist with the prod
    # `backend` container, which publishes 8000:8000 on the host.
    API_PORT=8001

    # API — async (asyncpg)
    (cd "$REPO_ROOT/backend/api" \
      && DATABASE_URL="postgresql+asyncpg://$DB_HOST_URL_BASE" \
         uv run uvicorn app.main:app --reload --host 0.0.0.0 --port "$API_PORT" \
      ) 2>&1 | sed 's/^/[api]    /' &
    PID_API=$!

    # Celery worker — sync (psycopg2)
    (cd "$REPO_ROOT/import-service" \
      && DATABASE_URL="postgresql+psycopg2://$DB_HOST_URL_BASE" \
         uv run celery -A app.celery_app worker --loglevel=info --concurrency=2 \
      ) 2>&1 | sed 's/^/[worker] /' &
    PID_WORKER=$!

    # Vite frontend — BACKEND_URL points the /api proxy at the host API.
    # (vite.config.ts default is :8080, which is wrong for our setup.)
    (cd "$REPO_ROOT/frontend" \
      && BACKEND_URL="http://localhost:$API_PORT" \
         npm run dev \
      ) 2>&1 | sed 's/^/[web]    /' &
    PID_WEB=$!

    cleanup() {
      echo
      echo "==> Stopping host processes…"
      kill "$PID_API" "$PID_WORKER" "$PID_WEB" 2>/dev/null || true
      wait "$PID_API" "$PID_WORKER" "$PID_WEB" 2>/dev/null || true
      if [[ "$STOP_INFRA" == "1" ]]; then
        echo "==> Stopping Docker infra (STOP_INFRA=1)…"
        "${COMPOSE[@]}" --file "$COMPOSE_FILE" stop db-dev redis-dev
      else
        echo "==> Leaving db-dev/redis-dev running. Set STOP_INFRA=1 to stop them too."
      fi
    }
    trap cleanup INT TERM EXIT

    wait
    ;;

  infra)
    mkdir -p "$UPLOAD_DIR"
    start_infra
    echo
    echo "Infra is up. Launch API/worker/frontend manually, or rerun with ACTION=up."
    ;;

  down)
    echo "==> Killing host dev processes (uvicorn, celery worker, vite)…"
    # `pkill -f` matches against the full command line, so these patterns
    # only hit the dev processes we started — not arbitrary uvicorn/vite
    # invocations elsewhere on the system.
    pkill -f "uvicorn app.main:app" || true
    pkill -f "celery -A app.celery_app" || true
    pkill -f "vite" || true

    echo "==> Stopping db-dev + redis-dev and removing .dev-uploads…"
    "${COMPOSE[@]}" --file "$COMPOSE_FILE" down
    rm -rf "$UPLOAD_DIR"

    echo "==> Verifying nothing is still listening on dev ports…"
    if command -v lsof >/dev/null 2>&1; then
      lsof -nP -iTCP:8001 -iTCP:5173 -iTCP:5433 -iTCP:6379 -sTCP:LISTEN || echo "    (all clear)"
    fi
    ;;

  seed)
    # backend/scripts/seed_test_data.py wipes the DB and inserts a structured
    # QA dataset. The script enforces FORCE_SEED=1 itself; we set it here so
    # the user only types one command.
    start_infra
    echo
    echo "==> Wiping db-dev and re-seeding with QA test data…"
    (cd "$REPO_ROOT/backend" \
      && FORCE_SEED=1 \
         DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/pfinancedb_dev" \
         uv run python scripts/seed_test_data.py)
    ;;

  logs)
    "${COMPOSE[@]}" --file "$COMPOSE_FILE" logs --follow --tail=200
    ;;

  *)
    echo "ERROR: unknown ACTION '$ACTION' (expected: up | infra | down | seed | logs)" >&2
    exit 1
    ;;
esac
