# import-service/tests/test_celery_free_import.py
# Guards the central design constraint: the shared core and the Lambda handler
# must be importable WITHOUT celery installed, because the Lambda image excludes
# celery/kombu/redis. We simulate "celery not installed" by blocking the celery
# import, then importing the core/handler in a fresh module state and asserting
# success — and asserting the celery-backed task wrapper does require celery.

import builtins
import importlib
import sys

import pytest


def _import_with_celery_blocked(module_name: str):
    """Import `module_name` fresh with `celery` (and submodules) import-blocked."""
    real_import = builtins.__import__

    # Block the whole broker stack the Lambda image omits — not just celery, but
    # also kombu and redis — so a future direct `import kombu`/`import redis` in the
    # core or handler is caught here rather than at Lambda cold start.
    blocked_roots = ("celery", "kombu", "redis")

    def blocking_import(name, *args, **kwargs):
        if name in blocked_roots or name.startswith(tuple(f"{root}." for root in blocked_roots)):
            raise ImportError(f"{name} is not installed (simulated Lambda image)")
        return real_import(name, *args, **kwargs)

    # Snapshot the ENTIRE module table up front so we can restore it exactly after
    # the block. This is critical: importing app.* fresh under the celery block
    # creates NEW module objects, and if any of those leaked into sys.modules they
    # would shadow the conftest-patched core in later tests (process_import would
    # then run against the real Postgres engine instead of the SQLite stand-in).
    # A full clear()+update() restore guarantees byte-for-byte module identity.
    saved_modules = dict(sys.modules)
    purge_prefixes = (module_name, "app.tasks", "app.celery_app", "celery")

    # Drop the modules we want re-imported so the import actually re-runs under the
    # block (rather than returning the already-cached, celery-importing versions).
    for cached_name in list(sys.modules):
        if cached_name.startswith(purge_prefixes):
            del sys.modules[cached_name]

    builtins.__import__ = blocking_import
    try:
        return importlib.import_module(module_name)
    finally:
        builtins.__import__ = real_import
        # Restore the exact original module table so other tests are unaffected.
        sys.modules.clear()
        sys.modules.update(saved_modules)
        # Restoring sys.modules alone is NOT enough. Importing a submodule under
        # the block rebinds the PARENT PACKAGE's attribute (e.g. it sets
        # app.lambda_handler = <freshly-imported module>) and that attribute
        # assignment is not undone by restoring sys.modules. A later
        # `import app.lambda_handler as x` resolves x through that parent
        # attribute (getattr), so it would hand back the blocked re-import rather
        # than the original module — diverging from names already bound via
        # `from app.lambda_handler import handler`. That divergence makes a
        # monkeypatch on the "wrong" module object silently miss, so the real
        # process_import runs against Postgres. Re-point each restored submodule
        # onto its parent package so the attribute and sys.modules agree again.
        for restored_name, restored_module in saved_modules.items():
            if not restored_name.startswith(purge_prefixes):
                continue
            parent_name, _, child_attribute = restored_name.rpartition(".")
            if parent_name and parent_name in sys.modules:
                setattr(sys.modules[parent_name], child_attribute, restored_module)


def test_core_imports_without_celery():
    """app.tasks.import_csv.process_import imports with celery blocked."""
    core_module = _import_with_celery_blocked("app.tasks.import_csv")
    assert hasattr(core_module, "process_import")
    assert callable(core_module.process_import)


def test_handler_imports_without_celery():
    """app.lambda_handler imports (and exposes handler) with celery blocked."""
    handler_module = _import_with_celery_blocked("app.lambda_handler")
    assert hasattr(handler_module, "handler")
    assert hasattr(handler_module, "decode_sqs_record")


def test_celery_task_wrapper_requires_celery():
    """The celery wrapper module DOES need celery — confirms the split is real."""
    with pytest.raises(ImportError):
        _import_with_celery_blocked("app.tasks.celery_tasks")
