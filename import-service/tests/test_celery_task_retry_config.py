# import-service/tests/test_celery_task_retry_config.py
# Guards the bounded retry binding on the self-host Celery task.
#
# The self-host / Redis path has no SQS-style DLQ, so a task that raises is
# acked-and-lost unless the task itself retries. We add `autoretry_for` scoped to
# transient infra errors only. This config-level test asserts that binding exists
# (and is bounded) without needing a live broker — Celery stores the decorator
# options as attributes on the registered task object.

from sqlalchemy.exc import InterfaceError, OperationalError

from app.tasks.celery_tasks import execute_import


def test_execute_import_retries_are_bounded():
    """max_retries is finite so a perpetually-failing task can't retry forever."""
    assert execute_import.max_retries == 3


def test_execute_import_retries_transient_infra_errors():
    """Transient DB/connection errors are in autoretry_for so blips get re-run."""
    assert OperationalError in execute_import.autoretry_for
    assert InterfaceError in execute_import.autoretry_for
    assert ConnectionError in execute_import.autoretry_for


def test_execute_import_does_not_retry_deterministic_errors():
    """A deterministic data error (ValueError) is NOT retried — it fails fast.

    Retrying bad-row errors just burns attempts before the inevitable FAILED, so
    only transient infra errors are eligible for autoretry.
    """
    assert ValueError not in execute_import.autoretry_for


def test_execute_import_uses_backoff():
    """Retries back off (with jitter) rather than hammering a struggling broker/DB."""
    assert execute_import.retry_backoff
    assert execute_import.retry_jitter
