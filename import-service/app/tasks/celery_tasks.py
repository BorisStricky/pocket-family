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

from ..celery_app import celery_app
from .import_csv import process_import


@celery_app.task(bind=True, name="import_service.execute_import")
def execute_import(self, payload: dict) -> dict:
    """Thin Celery wrapper around the shared `process_import` core.

    `bind=True` gives access to `self` (the task instance) to preserve the
    original task signature, but the import logic itself needs nothing from
    Celery — it just delegates to the shared core so local and AWS paths run
    identical code.
    """
    return process_import(payload)
