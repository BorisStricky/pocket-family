# backend/api/app/services/imports.py
# CSV import service helpers relocated from routers/imports.py.
#
# These are mostly pure/sync parsing utilities (decode, parse, amount/type
# normalization) plus a sync ownership guard. They do not interact with the
# database, so they take no session — only the file-key guard takes a tenant_id.

import csv
import io
import re
from decimal import Decimal, InvalidOperation
from uuid import UUID

# NOTE (follow-up): starlette 1.x renamed the status constants used below
# (HTTP_422_UNPROCESSABLE_ENTITY -> HTTP_422_UNPROCESSABLE_CONTENT,
# HTTP_413_REQUEST_ENTITY_TOO_LARGE -> HTTP_413_CONTENT_TOO_LARGE) and
# deprecates the old names. We intentionally keep the old names for now
# because FastAPI itself still references them internally; rename once
# FastAPI drops them, to silence the DeprecationWarnings (values unchanged).
from fastapi import HTTPException, status

# Type normalization — maps common bank statement type column values to
# "expense" or "income". Covers English and Portuguese variations.
_EXPENSE_VALUES = frozenset({
    "debit", "d", "db", "deb", "expense", "out", "withdrawal",
    "saída", "saida", "débito", "debito", "gasto", "-",
})
_INCOME_VALUES = frozenset({
    "credit", "c", "cr", "cred", "income", "in", "deposit",
    "entrada", "crédito", "credito", "receita", "+",
})


def decode_csv_bytes(raw: bytes) -> str:
    """Decode CSV bytes to a string, handling BOM and common encodings."""
    # utf-8-sig strips the BOM that Excel prepends to UTF-8 exports
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def parse_csv(text: str, start_row: int) -> tuple[list[str], list[dict]]:
    """Return (header_columns, data_rows) using start_row as the header row index."""
    all_lines = list(csv.reader(io.StringIO(text)))
    if start_row >= len(all_lines):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"start_row {start_row} exceeds number of rows in file",
        )
    headers = [col.strip() for col in all_lines[start_row]]
    # Convert remaining lines to dicts using the detected headers
    data_rows = []
    for line in all_lines[start_row + 1:]:
        if not any(cell.strip() for cell in line):
            continue  # skip blank lines
        # Zip truncates to the shorter sequence; extra cells in the row are dropped
        data_rows.append(dict(zip(headers, [cell.strip() for cell in line])))
    return headers, data_rows


def parse_amount(raw: str, positive_is_expense: bool = False) -> tuple[Decimal, str]:
    """Parse an amount string into (absolute_value, inferred_transaction_type).

    Handles:
    - International separators: "1,234.56" and "1.234,56"
    - Currency symbols: R$, $, €, £
    - Negative sign and accounting parentheses: "-150" or "(150)"
    - Plain positive/negative numbers

    Sign-to-type inference depends on the statement convention:
    - Default bank/debit convention (``positive_is_expense=False``):
      negative → expense, positive → income.
    - Credit-card convention (``positive_is_expense=True``): the sign is flipped,
      because card purchases (expenses) are reported as positive amounts and
      payments to the card (income, from the account's perspective) as negative.
    """
    raw = raw.strip()

    # Accounting notation: (150.00) means a debit/expense
    is_accounting_negative = raw.startswith("(") and raw.endswith(")")
    if is_accounting_negative:
        raw = raw[1:-1]

    # Strip currency symbols, spaces, and other non-numeric characters except . - ,
    raw = re.sub(r"[^\d\-.,]", "", raw)

    # Determine sign from leading minus
    is_negative = raw.startswith("-") or is_accounting_negative
    raw = raw.lstrip("-")

    # European number format: "1.234,56" → "1234.56"
    # Also matches sub-thousand European values like "100,50" where no thousands group is present.
    if re.search(r"\d{1,3}(\.\d{3})+,\d{1,2}$", raw) or re.fullmatch(r"\d{1,3},\d{1,2}", raw):
        raw = raw.replace(".", "").replace(",", ".")
    else:
        # Standard English format: remove thousand-separator commas
        raw = raw.replace(",", "")

    try:
        value = Decimal(raw)
    except InvalidOperation:
        raise ValueError(f"Cannot parse amount: {raw!r}")

    # Map the sign to a transaction type. For credit-card statements the
    # convention is inverted, so a positive amount is an expense.
    if positive_is_expense:
        transaction_type = "income" if is_negative else "expense"
    else:
        transaction_type = "expense" if is_negative else "income"
    return abs(value), transaction_type


def normalize_type(raw: str) -> str:
    """Map a raw type column value to 'expense' or 'income'.

    Defaults to 'expense' for unrecognized values since expenses are more common
    in bank statements and an incorrect type is more visible to the user.
    """
    cleaned = raw.strip().lower()
    if cleaned in _INCOME_VALUES:
        return "income"
    return "expense"


def validate_file_key_ownership(file_key: str, tenant_id: UUID) -> None:
    """Ensure file_key is prefixed with the requesting tenant's ID.

    This prevents a user from referencing another tenant's uploaded file
    by guessing the storage key.
    """
    expected_prefix = f"{tenant_id}/"
    if not file_key.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this file",
        )
