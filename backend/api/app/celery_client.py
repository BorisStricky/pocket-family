# backend/api/app/celery_client.py
# Dispatch-only Celery client for the backend API.
#
# The backend never runs Celery workers — it only dispatches tasks to the
# import-service worker via this client. The task name must exactly match
# the @task(name=...) registration in import-service/app/tasks/import_csv.py.

import os
from celery import Celery

_broker_url = os.getenv("BROKER_URL", "redis://localhost:6379/0")
_result_backend = os.getenv("RESULT_BACKEND", "redis://localhost:6379/1")

# Minimal Celery instance — no workers, no autodiscovery, dispatch only.
# The broker and backend URLs are identical to those the import-service worker uses
# so tasks dispatched here are picked up by the correct worker.
celery_client = Celery(
    "import_dispatch",
    broker=_broker_url,
    backend=_result_backend,
)

celery_client.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)
