# import-service/app/lambda_handler.py
# AWS Lambda entry point for the CSV import worker.
#
# On AWS the import path is serverless: the backend still dispatches with Celery's
# `send_task(...)` to SQS (unchanged), but the *consumer* is this Lambda wired to
# the SQS queue via an event source mapping — there is no Celery worker on AWS.
# Because the backend produces a Celery/kombu envelope on the wire, this handler
# decodes that envelope to recover the original `payload`, then calls the shared
# `process_import` core (the same code the local Celery task runs).
#
# IMPORTANT: this module imports ONLY the celery-free core
# (`app.tasks.import_csv.process_import`), never `celery_app`, so it runs in the
# Lambda image which excludes celery/kombu/redis. See import-service/CLAUDE.md.

import base64
import binascii
import json
import logging

# Import the shared core directly. import_csv.py does not import celery, so this
# is safe in the Lambda image where celery is not installed.
from .tasks.import_csv import process_import

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _maybe_base64_to_text(candidate: str) -> str | None:
    """Return the base64-decoded UTF-8 text of `candidate`, or None if it is not
    valid base64-encoded text.

    Used to probe whether a string is base64-wrapped without raising — kombu may
    base64 the whole SQS body and/or the inner message body, and we must tolerate
    both encoded and plain-JSON forms.
    """
    try:
        decoded_bytes = base64.b64decode(candidate, validate=True)
    except (binascii.Error, ValueError):
        return None
    try:
        return decoded_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return None


def decode_sqs_record(record: dict) -> dict:
    """Decode one SQS record into the original Celery task `payload` dict.

    The kombu SQS transport + Celery protocol v2 produce a layered encoding:
      1. record["body"] is the raw SQS message body. It is JSON, but kombu may
         have base64-encoded the entire body, so we try plain json.loads first
         and fall back to base64-decoding then json.loads.
      2. The resulting "envelope" dict carries the actual message in
         envelope["body"]; if envelope["properties"]["body_encoding"] == "base64"
         that inner body is itself base64-encoded and must be decoded.
      3. The decoded inner body is the Celery v2 message:
         [args, kwargs, embed] (a 3-element JSON array). The backend dispatches
         with kwargs={"payload": {...}}, so payload = kwargs["payload"].

    This is isolated here (and unit-tested) because it couples us to Celery's wire
    format; if that ever proves brittle, the escape hatch is raw-JSON SQS dispatch
    (see docs/aws_lambda.md Risks).
    """
    raw_body = record["body"]

    # Step 1 — recover the envelope dict. Prefer plain JSON; if that fails, the
    # whole SQS body was base64-encoded by kombu.
    try:
        envelope = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        decoded_text = _maybe_base64_to_text(raw_body)
        if decoded_text is None:
            raise ValueError("SQS body is neither JSON nor base64-encoded JSON")
        envelope = json.loads(decoded_text)

    # Step 2 — extract the inner message body, honoring its declared encoding.
    message_body = envelope["body"]
    body_encoding = envelope.get("properties", {}).get("body_encoding")
    if body_encoding == "base64":
        message_body = base64.b64decode(message_body).decode("utf-8")

    # Step 3 — Celery protocol v2 message: [args, kwargs, embed].
    arguments, keyword_arguments, _embed = json.loads(message_body)
    return keyword_arguments["payload"]


def handler(event, context):
    """SQS-triggered Lambda entry point.

    With the event source mapping configured at batch_size=1 (plan B3), each
    invocation receives exactly one SQS record. We decode it to the original
    payload and run the shared import core. Exceptions are intentionally NOT
    caught here: a raised exception fails the invocation, SQS makes the message
    visible again, and after maxReceiveCount attempts it lands in the DLQ — this
    mirrors the Celery worker's task_acks_late semantics.
    """
    records = event.get("Records", [])
    results = []
    for record in records:
        payload = decode_sqs_record(record)
        # Let any exception propagate so SQS retries → DLQ (see docstring).
        result = process_import(payload)
        results.append(result)

    # Returned only for observability/tests; SQS does not consume this value when
    # batch_size=1 and no partial-batch-response is configured.
    return {"processed": len(results), "results": results}
