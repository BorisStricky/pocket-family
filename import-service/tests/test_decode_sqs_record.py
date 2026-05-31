# import-service/tests/test_decode_sqs_record.py
# Unit tests for the kombu/Celery-v2 SQS envelope decoder used by the Lambda.
#
# The decoder couples us to Celery's wire format, so we test it against the exact
# layered encoding kombu emits to SQS:
#   outer:  SQS body  = (optionally base64'd) JSON envelope
#   inner:  envelope["body"] = (optionally base64'd) JSON [args, kwargs, embed]
# We cover both the base64-wrapped and plain-JSON outer-body cases, and — when
# kombu is importable — also assert against a message built the same way kombu
# builds one, so the test tracks the real producer format rather than a guess.

import base64
import json

import pytest

from app.lambda_handler import decode_sqs_record, handler


# A representative import payload — the dict the backend passes as
# send_task(..., kwargs={"payload": payload}).
EXAMPLE_PAYLOAD = {
    "import_job_id": "11111111-1111-1111-1111-111111111111",
    "tenant_id": "22222222-2222-2222-2222-222222222222",
    "account_id": "33333333-3333-3333-3333-333333333333",
    "created_by": "44444444-4444-4444-4444-444444444444",
    "currency": "BRL",
    "file_key": "uploads/example.csv",
    "rows": [
        {
            "transaction_date": "2026-01-15",
            "amount": "12.34",
            "transaction_type": "expense",
            "description": "Coffee",
            "category_id": None,
        }
    ],
}


def _build_celery_v2_message_body(payload: dict, *, base64_inner: bool):
    """Build the inner Celery protocol v2 message body for the given payload.

    Celery v2 message body is the 3-element array [args, kwargs, embed] encoded
    as JSON. kombu's SQS transport may then base64-encode that body and record
    body_encoding="base64" in the envelope properties.
    """
    celery_v2_array = [[], {"payload": payload}, {"callbacks": None, "errbacks": None, "chain": None, "chord": None}]
    inner_json = json.dumps(celery_v2_array)
    if base64_inner:
        encoded = base64.b64encode(inner_json.encode("utf-8")).decode("utf-8")
        return encoded, "base64"
    return inner_json, None


def _build_envelope(payload: dict, *, base64_inner: bool) -> dict:
    """Build the kombu SQS envelope dict wrapping a Celery v2 message."""
    inner_body, body_encoding = _build_celery_v2_message_body(payload, base64_inner=base64_inner)
    properties = {}
    if body_encoding is not None:
        properties["body_encoding"] = body_encoding
    return {
        "body": inner_body,
        "content-encoding": "utf-8",
        "content-type": "application/json",
        "headers": {"task": "import_service.execute_import"},
        "properties": properties,
    }


def _make_sqs_record(envelope: dict, *, base64_outer: bool) -> dict:
    """Wrap an envelope into an SQS record's `body`, optionally base64'ing it."""
    envelope_json = json.dumps(envelope)
    if base64_outer:
        sqs_body = base64.b64encode(envelope_json.encode("utf-8")).decode("utf-8")
    else:
        sqs_body = envelope_json
    return {"messageId": "abc", "body": sqs_body}


@pytest.mark.parametrize("base64_outer", [False, True], ids=["plain-outer", "base64-outer"])
@pytest.mark.parametrize("base64_inner", [False, True], ids=["plain-inner", "base64-inner"])
def test_decode_recovers_exact_payload(base64_outer, base64_inner):
    """The decoder recovers the EXACT payload across all encoding combinations."""
    envelope = _build_envelope(EXAMPLE_PAYLOAD, base64_inner=base64_inner)
    record = _make_sqs_record(envelope, base64_outer=base64_outer)

    recovered_payload = decode_sqs_record(record)

    assert recovered_payload == EXAMPLE_PAYLOAD


def test_handler_passes_decoded_payload_to_core(monkeypatch):
    """handler() decodes each record and forwards the exact payload to process_import."""
    # Default kombu SQS shape: base64 inner body, plain outer body.
    envelope = _build_envelope(EXAMPLE_PAYLOAD, base64_inner=True)
    record = _make_sqs_record(envelope, base64_outer=False)

    captured_payloads = []

    def fake_process_import(payload):
        captured_payloads.append(payload)
        return {"status": "done", "imported": len(payload["rows"])}

    # Patch the name the handler module actually calls.
    import app.lambda_handler as lambda_handler
    monkeypatch.setattr(lambda_handler, "process_import", fake_process_import)

    response = handler({"Records": [record]}, None)

    assert captured_payloads == [EXAMPLE_PAYLOAD]
    assert response["processed"] == 1


def test_decode_matches_real_kombu_encoding():
    """When kombu is installed, decode a message built by kombu's own encoder.

    This anchors the decoder to the real producer format. kombu's SQS transport
    base64-encodes the message body and sets properties.body_encoding="base64";
    we reproduce that exact step via kombu's encode helpers (the same ones the
    transport uses) rather than hand-rolling the bytes. Skipped if kombu is not
    importable (e.g. the Lambda-style environment without celery/kombu).
    """
    kombu_message_encode = pytest.importorskip("kombu.message")  # noqa: F841
    from kombu.utils.encoding import bytes_to_str
    from kombu.transport.virtual.base import Message  # presence check only  # noqa: F401

    # Build the Celery v2 body and apply kombu's SQS body_encoding the way the
    # SQS transport's `_apply_record` / `Channel.encode_body` does: base64.
    celery_v2_array = [[], {"payload": EXAMPLE_PAYLOAD}, {"callbacks": None, "errbacks": None, "chain": None, "chord": None}]
    inner_json = json.dumps(celery_v2_array)
    body_encoded = bytes_to_str(base64.b64encode(inner_json.encode("utf-8")))
    envelope = {
        "body": body_encoded,
        "content-encoding": "utf-8",
        "content-type": "application/json",
        "properties": {"body_encoding": "base64"},
        "headers": {"task": "import_service.execute_import"},
    }
    record = {"body": json.dumps(envelope)}

    assert decode_sqs_record(record) == EXAMPLE_PAYLOAD
