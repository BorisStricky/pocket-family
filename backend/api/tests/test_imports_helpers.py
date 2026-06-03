"""
Unit tests for the helper functions in app/routers/imports.py.

Validates pure-function behavior independently of the FastAPI request path:

- `_parse_amount` — handles international number formats, currency symbols,
  accounting negatives, and infers expense/income from sign.
- `_normalize_type` — maps the wide variety of debit/credit/expense/income
  values seen on bank statements to a canonical 'expense' or 'income'.
- `_validate_file_key_ownership` — enforces that a file_key is prefixed with
  the requesting tenant's UUID, blocking cross-tenant file access.
"""

from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from app.routers.imports import (
    _normalize_type,
    _parse_amount,
    _validate_file_key_ownership,
)


class TestParseAmount:
    """Tests for _parse_amount — bank-statement amount parsing."""

    def test_plain_positive_returns_income(self):
        """A plain positive number is treated as income, value unchanged."""
        absolute_value, transaction_type = _parse_amount("150")

        assert absolute_value == Decimal("150")
        assert transaction_type == "income"

    def test_plain_negative_returns_expense(self):
        """A leading minus sign flags expense and the value is absolute."""
        absolute_value, transaction_type = _parse_amount("-150")

        assert absolute_value == Decimal("150")
        assert transaction_type == "expense"

    def test_accounting_parentheses_treated_as_negative(self):
        """Accounting notation '(150)' must be interpreted as a debit/expense."""
        absolute_value, transaction_type = _parse_amount("(150)")

        assert absolute_value == Decimal("150")
        assert transaction_type == "expense"

    def test_us_format_with_thousand_separator(self):
        """US-style '1,234.56' must parse to Decimal('1234.56')."""
        absolute_value, transaction_type = _parse_amount("1,234.56")

        assert absolute_value == Decimal("1234.56")
        assert transaction_type == "income"

    def test_european_format_with_dot_thousands_and_comma_decimal(self):
        """European-style '1.234,56' must parse to Decimal('1234.56')."""
        absolute_value, transaction_type = _parse_amount("1.234,56")

        assert absolute_value == Decimal("1234.56")
        assert transaction_type == "income"

    def test_european_format_negative(self):
        """European format with a negative sign keeps absolute value and flags expense."""
        absolute_value, transaction_type = _parse_amount("-1.234,56")

        assert absolute_value == Decimal("1234.56")
        assert transaction_type == "expense"

    def test_currency_symbol_stripped(self):
        """Currency symbols (R$, $, €, £) must be stripped before parsing."""
        # The amount parser strips any non-digit/dot/dash/comma chars,
        # so currency prefixes do not break parsing.
        amount_brl, type_brl = _parse_amount("R$ 1.234,56")
        amount_usd, type_usd = _parse_amount("$ 1,234.56")
        amount_eur, type_eur = _parse_amount("€ 50.00")
        amount_gbp, type_gbp = _parse_amount("£ 25")

        assert amount_brl == Decimal("1234.56")
        assert type_brl == "income"
        assert amount_usd == Decimal("1234.56")
        assert type_usd == "income"
        assert amount_eur == Decimal("50.00")
        assert type_eur == "income"
        assert amount_gbp == Decimal("25")
        assert type_gbp == "income"

    def test_currency_symbol_with_accounting_negative_and_thousands(self):
        """Currency symbol + accounting parentheses + European thousands: expense + clean value.

        Uses a value with full European thousands grouping (1.234,56) so the
        European-format regex matches. See the parametrized 'small european'
        case for a documented quirk affecting values below 1000.
        """
        absolute_value, transaction_type = _parse_amount("(R$ 1.234,56)")

        assert absolute_value == Decimal("1234.56")
        assert transaction_type == "expense"

    def test_whitespace_is_trimmed(self):
        """Leading/trailing whitespace must not affect parsing."""
        absolute_value, transaction_type = _parse_amount("   100.00   ")

        assert absolute_value == Decimal("100.00")
        assert transaction_type == "income"

    def test_decimal_only_no_thousands(self):
        """Plain decimal '99.99' returns Decimal('99.99')."""
        absolute_value, transaction_type = _parse_amount("99.99")

        assert absolute_value == Decimal("99.99")
        assert transaction_type == "income"

    def test_european_format_below_thousand(self):
        """European-style decimal under 1000 like '100,50' parses as 100.50.

        Common case for Brazilian/European bank statements where many
        transactions are under R$ 1.000 and have no thousands separator.
        """
        absolute_value, _transaction_type = _parse_amount("100,50")

        assert absolute_value == Decimal("100.50")

    def test_invalid_amount_raises_value_error(self):
        """Garbage input must raise ValueError so the router can flag the row."""
        with pytest.raises(ValueError):
            _parse_amount("not-a-number")

    def test_empty_string_after_stripping_raises_value_error(self):
        """An empty/symbol-only string must raise ValueError."""
        # After stripping non-numeric chars only the currency symbol is left → empty
        with pytest.raises(ValueError):
            _parse_amount("R$")


class TestParseAmountCreditCardConvention:
    """Tests for _parse_amount with positive_is_expense=True (credit-card statements).

    Credit-card exports report purchases (expenses) as positive amounts and
    payments to the card (income, from the account's perspective) as negative.
    The flag flips the sign-to-type mapping so the importer classifies these
    correctly. The absolute value must be identical regardless of the flag.
    """

    def test_positive_becomes_expense(self):
        """With the flag on, a positive amount (a card purchase) is an expense."""
        absolute_value, transaction_type = _parse_amount("150", positive_is_expense=True)

        assert absolute_value == Decimal("150")
        assert transaction_type == "expense"

    def test_negative_becomes_income(self):
        """With the flag on, a negative amount (a card payment) is income."""
        absolute_value, transaction_type = _parse_amount("-150", positive_is_expense=True)

        assert absolute_value == Decimal("150")
        assert transaction_type == "income"

    def test_accounting_parentheses_becomes_income(self):
        """Accounting-negative '(150)' flips to income under the credit convention."""
        absolute_value, transaction_type = _parse_amount("(150)", positive_is_expense=True)

        assert absolute_value == Decimal("150")
        assert transaction_type == "income"

    def test_default_argument_keeps_bank_convention(self):
        """Omitting the flag must preserve the original bank convention (regression guard)."""
        # Same inputs, default flag → unchanged behavior.
        assert _parse_amount("150")[1] == "income"
        assert _parse_amount("-150")[1] == "expense"
        # Explicit False must match the default.
        assert _parse_amount("150", positive_is_expense=False)[1] == "income"
        assert _parse_amount("-150", positive_is_expense=False)[1] == "expense"


class TestNormalizeType:
    """Tests for _normalize_type — mapping bank type column values to canonical types."""

    @pytest.mark.parametrize("raw_value", [
        "credit", "Credit", "CREDIT", "c", "C", "cr", "cred",
        "income", "Income", "in", "deposit", "Deposit",
        "entrada", "Entrada", "crédito", "credito", "receita", "+",
    ])
    def test_income_synonyms_map_to_income(self, raw_value: str):
        """All known income/credit variations must normalize to 'income'."""
        assert _normalize_type(raw_value) == "income"

    @pytest.mark.parametrize("raw_value", [
        "debit", "Debit", "DEBIT", "d", "D", "db", "deb",
        "expense", "Expense", "out", "Out", "withdrawal",
        "saída", "saida", "débito", "debito", "gasto", "-",
    ])
    def test_expense_synonyms_map_to_expense(self, raw_value: str):
        """All known debit/expense variations must normalize to 'expense'."""
        assert _normalize_type(raw_value) == "expense"

    def test_unknown_values_default_to_expense(self):
        """Unrecognized type values default to 'expense' (the safer default)."""
        # Per the docstring on _normalize_type: expenses are more common in
        # bank statements and a wrong type is more visible to the user.
        assert _normalize_type("totally-random") == "expense"
        assert _normalize_type("xyz") == "expense"

    def test_whitespace_and_case_are_normalized(self):
        """Surrounding whitespace and case must not affect the mapping."""
        assert _normalize_type("  CREDIT  ") == "income"
        assert _normalize_type("  Debit  ") == "expense"


class TestValidateFileKeyOwnership:
    """Tests for _validate_file_key_ownership — cross-tenant file access guard."""

    def test_matching_prefix_passes(self):
        """A file_key prefixed with the active tenant's UUID must pass silently."""
        tenant_id = uuid4()
        file_key = f"{tenant_id}/some-uuid.csv"

        # Should not raise
        _validate_file_key_ownership(file_key, tenant_id)

    def test_different_tenant_prefix_raises_403(self):
        """A file_key prefixed with another tenant's UUID must raise 403 Forbidden."""
        active_tenant_id = uuid4()
        other_tenant_id = uuid4()
        file_key = f"{other_tenant_id}/some-uuid.csv"

        with pytest.raises(HTTPException) as exception_info:
            _validate_file_key_ownership(file_key, active_tenant_id)

        assert exception_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Access denied" in exception_info.value.detail

    def test_missing_prefix_raises_403(self):
        """A file_key with no UUID prefix at all must be rejected."""
        active_tenant_id = uuid4()

        with pytest.raises(HTTPException) as exception_info:
            _validate_file_key_ownership("just-a-file.csv", active_tenant_id)

        assert exception_info.value.status_code == status.HTTP_403_FORBIDDEN

    def test_prefix_without_trailing_slash_is_rejected(self):
        """A key that contains the tenant id but not as a path segment must be rejected.

        The check requires '{tenant_id}/' (with trailing slash), so a key like
        '{tenant_id}suffix.csv' must NOT pass — it could be a confusable name.
        """
        active_tenant_id = uuid4()
        # No slash between the tenant id and the rest of the key
        suspicious_key = f"{active_tenant_id}suffix.csv"

        with pytest.raises(HTTPException) as exception_info:
            _validate_file_key_ownership(suspicious_key, active_tenant_id)

        assert exception_info.value.status_code == status.HTTP_403_FORBIDDEN
