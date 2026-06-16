# import-service/app/tasks/celery_tasks.py
# Celery task wrapper(s) for local dev / self-host.
#
# This is the ONLY task module that imports `celery_app`. The actual import
# logic lives in `app/tasks/import_csv.py` as the framework-agnostic
# `process_import()` core. Keeping the Celery binding isolated here means the
# AWS Lambda image — which does not install celery/kombu/redis — can import
# `process_import` from `import_csv.py` without triggering a Celery import.
#
# `celery_app.make_celery()` lists this module in its `include` so the
# @celery_app.task decorator below runs at worker boot and registers the task
# under the same name the backend dispatches with ("import_service.execute_import").

from sqlalchemy.exc import InterfaceError, OperationalError

from ..celery_app import celery_app
from .import_csv import process_import

# Transient infrastructure errors worth retrying on the self-host / Redis path.
# These mean "the DB or a connection was momentarily unavailable", not "the data
# is bad" — a retry has a real chance of succeeding. We deliberately exclude
# deterministic errors (e.g. ValueError from a malformed row): retrying those just
# wastes attempts before the inevitable FAILED, so they fail fast instead.
#   * OperationalError — DB down / connection dropped / deadlock (SQLAlchemy)
#   * InterfaceError   — connection already closed / driver-level connection fault
#   * ConnectionError  — broker/socket connectivity (builtin)
_TRANSIENT_RETRY_ERRORS = (OperationalError, InterfaceError, ConnectionError)


@celery_app.task(
    bind=True,
    name="import_service.execute_import",
    # Bounded autoretry for transient infra failures only. The AWS/SQS path gets
    # retries + a real DLQ from the queue's redrive policy; the self-host Redis
    # path has neither, so without this a task that raises is acked-and-lost
    # (task_acks_late acks after execution regardless of success). Retrying is
    # SAFE because process_import claims idempotently (UPDATE ... WHERE status
    # != 'DONE'), so a re-run never double-inserts. After max_retries the
    # best-effort FAILED ImportJob row the core writes is the self-host
    # equivalent of the SQS DLQ — the terminal state surfaced in the UI.
    autoretry_for=_TRANSIENT_RETRY_ERRORS,
    retry_backoff=True,        # exponential backoff between attempts
    retry_backoff_max=60,      # cap the backoff at 60s
    retry_jitter=True,         # spread retries to avoid a thundering herd
    max_retries=3,             # bounded — after this the FAILED row sticks
)
def execute_import(self, payload: dict) -> dict:
    """Thin Celery wrapper around the shared `process_import` core.

    `bind=True` gives access to `self` (the task instance) to preserve the
    original task signature, but the import logic itself needs nothing from
    Celery — it just delegates to the shared core so local and AWS paths run
    identical code.
    """
    return process_import(payload)
