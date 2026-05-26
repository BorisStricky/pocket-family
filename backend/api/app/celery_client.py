# backend/api/app/celery_client.py
# Dispatch-only Celery client for the backend API.
#
# The backend never runs Celery workers — it only dispatches tasks to the
# import-service worker via this client. The task name must exactly match
# the @task(name=...) registration in import-service/app/tasks/import_csv.py.

import os
from celery import Celery

_broker_url = os.getenv("BROKER_URL", "redis://localhost:6379/0")
_default_queue = os.getenv("CELERY_DEFAULT_QUEUE", "celery")

# Minimal Celery instance — no workers, no autodiscovery, dispatch only.
# No result backend: the backend reads job status from the importjob PostgreSQL
# table rather than Celery's result store, so no backend URL is needed here.
celery_client = Celery(
    "import_dispatch",
    broker=_broker_url,
)

celery_client.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_default_queue=_default_queue,
)
