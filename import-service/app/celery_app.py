# import-service/app/celery_app.py
# Celery application factory for the import worker.
#
# The broker URL determines the queue transport:
#   redis://...   → Redis (local development)
#   sqs://        → AWS SQS (production) — kombu's built-in SQS transport
#                   activates automatically; no code changes needed.

from celery import Celery
from .config import settings


def make_celery() -> Celery:
    # `include` explicitly imports task modules at worker boot so their
    # @celery_app.task decorators run and register the tasks. We don't rely
    # on autodiscover_tasks here because it expects a submodule literally
    # named `tasks` inside each package — but our tasks live in submodules
    # like app.tasks.import_csv, which autodiscover would silently skip.
    application = Celery("import_service", include=["app.tasks.import_csv"])
    application.conf.update(
        broker_url=settings.broker_url,
        # Use JSON serialization so tasks are readable in broker logs and
        # portable across Python versions without pickle security concerns.
        task_serializer="json",
        accept_content=["json"],
        # Route tasks to the configured queue name so local Redis ("celery")
        # and AWS SQS ("pocket-family-celery") both work without code changes.
        task_default_queue=settings.celery_default_queue,
        # Acknowledge the task only after it completes (not when received).
        # This ensures a task is re-queued if the worker crashes mid-import.
        task_acks_late=True,
        # Prevent tasks from being rejected back to the queue on worker restart —
        # CSV imports are not idempotent and should not run twice.
        task_reject_on_worker_lost=True,
    )
    # Only enable the Celery result backend if a URL is explicitly configured.
    # On AWS we skip it entirely — status is read from the importjob table instead.
    if settings.result_backend:
        application.conf.result_backend = settings.result_backend
        application.conf.result_serializer = "json"
        application.conf.task_track_started = True
    return application


celery_app = make_celery()
