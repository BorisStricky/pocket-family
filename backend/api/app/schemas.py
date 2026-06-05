# backend/api/app/schemas.py
from __future__ import annotations
from typing import Literal, Optional, List, get_args
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from pydantic import field_validator
from sqlmodel import SQLModel, Field

from .models import (
    User,
    Tenant,
    Membership,
    CategoryKind,
    TransactionSource,
    MembershipRole,
    MembershipStatus,
    AccountType,
    Currency,
    ShareVisibility,
    ImportJobStatus,
)


# -------------------------
# Auth / simple forms
# -------------------------
class SignupIn(SQLModel):
    """Input schema for user signup.

    Args:
        email: User email address used for login.
        password: Plaintext password provided by the user (will be hashed).
        name: Optional display name.
    """
    email: str
    password: str
    name: Optional[str] = None


class LoginIn(SQLModel):
    """Input schema for user login.

    Args:
        email: User email address.
        password: Plaintext password.
        tenant_uuid (Option): specify a tenant to login
    """
    email: str
    password: str
    tenant_uuid: Optional[UUID] = None


class TokenOut(SQLModel):
    """Output schema for authentication tokens.

    Attributes:
        access_token: JWT access token string.
        token_type: Type of token (default: 'bearer').
        refresh_token: Optional opaque refresh token (only present in tests).
    """
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None  # Only returned in TEST_MODE


# Canonical type for a supported UI language code. The Literal is the single
# source of truth: the read schema types `language` with it, and the runtime
# set below is derived from it via get_args, so the read schema and the update
# validator can never drift out of sync when a language is added or removed.
LanguageCode = Literal["en", "pt-BR"]
SUPPORTED_LANGUAGES = set(get_args(LanguageCode))


class UserRead(SQLModel):
    """Public read schema for the authenticated user's own profile.

    Deliberately excludes sensitive fields (password_hash) and returns only the
    safe subset the frontend needs to render and sync preferences.

    Attributes:
        id: User identifier.
        email: Login email address.
        name: Optional display name.
        language: Preferred UI language code ("en" or "pt-BR").
        created_at: Account creation timestamp.
    """
    id: UUID
    email: str
    name: Optional[str] = None
    language: LanguageCode
    created_at: datetime


class UserUpdate(SQLModel):
    """Input schema for updating the authenticated user's own preferences.

    Only fields the user is allowed to self-edit are exposed here. `language`
    is validated against SUPPORTED_LANGUAGES so an unsupported code is rejected
    with a 422 rather than silently persisted.

    Args:
        language: New preferred UI language code (optional).
    """
    language: Optional[str] = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: Optional[str]) -> str:
        """Reject any language code outside the supported set.

        This validator only runs when `language` is actually present in the
        request body (Pydantic does not validate the omitted default), so a
        partial update that omits `language` stays valid. When the field *is*
        supplied, `None` is rejected too — the column is non-nullable, so an
        explicit `null` must fail cleanly with a 422 rather than reaching the
        database and raising a 500.
        """
        if value is None or value not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"language must be one of {sorted(SUPPORTED_LANGUAGES)}"
            )
        return value


class InviteCreate(SQLModel):
    """Input schema to create an invite for a tenant.

    Args:
        email: Email address to invite.
        role: Role to assign when the invite is accepted.
    """
    email: str
    role: Optional[MembershipRole] = MembershipRole.MEMBER

class ActiveContext(SQLModel):
    """User and Tenant pair that are part of the authorization header
    
        Attributes:
            active_user: User record
            active_tenant: Tenant record
            active_membership: Membership record
    """
    active_user: User
    active_tenant: Tenant
    active_membership: Membership
# -------------------------
# Tenant
# -------------------------
class TenantCreate(SQLModel):
    """Input schema to create a new tenant.

    Args:
        name: Human-readable name for the tenant.
    """
    name: str


class TenantRead(SQLModel):
    """Read schema for tenant information returned by the API.

    Attributes:
        id: Tenant identifier.
        name: Tenant name.
        created_at: Creation timestamp.
    """
    id: UUID
    name: str
    created_at: datetime


class TenantUpdate(SQLModel):
    """Input schema for updating a tenant's properties.

    Args:
        name: New name for the tenant (optional).
    """
    name: Optional[str] = None


# -------------------------
# Membership
# -------------------------
class MembershipCreate(SQLModel):
    """Input schema to create a membership or invite within a tenant.
    Tenant ID is derived from the active context within the access_token

    Args:
        user_email: Email of the user to invite or add.
        role: Role to assign to the membership.
    """
    user_email: str
    role: Optional[MembershipRole] = MembershipRole.MEMBER


class MembershipRead(SQLModel):
    """Read schema returning membership details.
    Tenant ID is derived from the active context within the access_token

    Attributes:
        id: Membership identifier.
        tenant_id: Tenant the membership belongs to.
        user_id: Optional linked user id.
        user_email: Optional invite email.
        role: Assigned role.
        status: Membership status.
        created_at: Creation timestamp.
    """
    id: UUID
    tenant_id: UUID
    user_id: Optional[UUID]
    user_email: Optional[str]
    role: MembershipRole
    status: MembershipStatus
    created_at: datetime


class MembershipUpdate(SQLModel):
    """Input schema for updating membership properties.
    Tenant ID is derived from the active context within the access_token
    memebrhsip Id is derived from the path param

    Args:
        role: New role (optional).
        status: New status (optional).
    """
    role: Optional[MembershipRole] = None
    status: Optional[MembershipStatus] = None


# -------------------------
# Account
# -------------------------
class AccountCreate(SQLModel):
    """Input schema to create an account.

    Args:
        name: Account name.
        type: Account type.
        currency: Optional currency (defaults to BRL).
        balance: Optional starting balance.
        share_with: Optional tenant to share account with atomically during creation.
        icon: Optional lucide-react icon name for visual identity.
        color: Optional hex color string (#RRGGBB) for visual identity.
    """
    name: str
    type: AccountType
    currency: Optional[Currency] = Currency.BRL
    balance: Optional[Decimal] = Decimal("0.00")
    share_with: Optional[AccountShareWith] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class AccountRead(SQLModel):
    """Read schema for account data returned by the API.

    Attributes:
        id: Account identifier.
        user_id: Owner user id.
        name: Account name.
        type: Account type.
        currency: Currency code.
        balance: Monetary balance or None when masked.
        icon: Optional lucide-react icon name.
        color: Optional hex color string (#RRGGBB).
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    id: UUID
    user_id: UUID
    user_name: str
    name: str
    type: AccountType
    currency: Currency
    balance: Optional[Decimal]  # None when masked/hidden for the requester
    icon: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AccountUpdate(SQLModel):
    """Input schema for updating an account.

    Args:
        name: New account name.
        type: New account type.
        currency: New currency code.
        balance: New balance value.
        icon: New icon name (pass None to clear).
        color: New hex color (pass None to clear).
    """
    name: Optional[str] = None
    type: Optional[AccountType] = None
    currency: Optional[Currency] = None
    balance: Optional[Decimal] = None
    icon: Optional[str] = None
    color: Optional[str] = None


# -------------------------
# Category
# -------------------------
class CategoryCreate(SQLModel):
    """Input schema to create a category.

    Args:
        name: Category name.
        kind: Category kind (expense/income).
        parent_id: Optional parent category id.
        icon: Optional lucide-react icon name for visual identity.
        color: Optional hex color string (#RRGGBB) for visual identity.
    """
    name: str
    kind: CategoryKind
    parent_id: Optional[UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryRead(SQLModel):
    """Read schema returning category data.

    Attributes:
        id: Category id.
        tenant_id: Tenant id.
        name: Category name.
        kind: Category kind.
        parent_id: Optional parent id.
        icon: Optional lucide-react icon name.
        color: Optional hex color string (#RRGGBB).
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    id: UUID
    tenant_id: UUID
    name: str
    kind: CategoryKind
    parent_id: Optional[UUID] = None
    parent_name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CategoryUpdate(SQLModel):
    """Input schema for updating a category.

    Args:
        name: New name (optional).
        kind: New kind (optional).
        parent_id: New parent id (optional).
        icon: New icon name (pass None to clear).
        color: New hex color (pass None to clear).
    """
    name: Optional[str] = None
    kind: Optional[CategoryKind] = None
    parent_id: Optional[UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None


# -------------------------
# Transaction
# -------------------------
class TransactionCreate(SQLModel):
    """Input schema to create a transaction.

    Args:
        account_id: Account to which the transaction belongs.
        category_id: Optional category classification.
        amount: Monetary amount.
        currency: Currency code (defaults to BRL).
        transaction_date: Date when the transaction occurred.
        transaction_type: Expense or income (CategoryKind).
        description: Optional text describing the transaction.
        source: Optional transaction source.
    
    tenant_id is derived from the active context (access token).
    """
    account_id: UUID
    category_id: Optional[UUID] = None
    amount: Decimal
    currency: Optional[Currency] = Currency.BRL
    transaction_date: date
    transaction_type: CategoryKind                   # same enum as Category.kind
    description: Optional[str] = None
    source: Optional[TransactionSource] = TransactionSource.MANUAL

class TransactionRead(SQLModel):
    """Read schema returning transaction details.

    Attributes:
        id: Transaction id.
        tenant_id: Tenant id.
        account_id: Account id.
        category_id: Optional category id.
        amount: Monetary amount.
        currency: Currency code.
        transaction_date: Date of transaction.
        transaction_type: Expense or income.
        description: Optional text description.
        created_by: User who created it.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
        reconciled: Reconciliation flag.
        source: Transaction source.
    """
    id: UUID
    tenant_id: UUID
    account_id: Optional[UUID]
    account_name: Optional[str]
    # Icon name and color hex resolved via Account join for visual display
    account_icon: Optional[str] = None
    account_color: Optional[str] = None
    category_id: Optional[UUID]
    category_name: Optional[str]
    # Icon name and color hex resolved via Category join for visual display
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    amount: Decimal
    currency: Currency
    transaction_date: date
    transaction_type: CategoryKind
    description: Optional[str]
    created_by: UUID
    # Display name of the user who created the transaction, resolved via User join
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    reconciled: bool
    source: TransactionSource


class TransactionUpdate(SQLModel):
    """Input schema for updating transactions.

    Args:
        account_id: New account id (optional).
        category_id: New category id (optional).
        amount: New amount (optional).
        currency: New currency (optional).
        transaction_date: New date (optional).
        transaction_type: New type (optional).
        description: New description (optional).
        reconciled: Updated reconciliation flag (optional).
    """
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    amount: Optional[Decimal] = None
    currency: Optional[Currency] = None
    transaction_date: Optional[date] = None
    transaction_type: Optional[CategoryKind] = None
    description: Optional[str] = None
    reconciled: Optional[bool] = None


# -------------------------
# AccountShare
# -------------------------
class AccountShareWith(SQLModel):
    """Input schema for sharing an account with a tenant during account creation.

    Used in AccountCreate.share_with to atomically create an account and share
    it with another tenant in a single operation.

    Args:
        tenant_id: Tenant to share the account with.
        visibility: Visibility setting for the shared balance.
    """
    tenant_id: UUID
    visibility: Optional[ShareVisibility] = ShareVisibility.HIDDEN


class AccountShareCreate(SQLModel):
    """Input schema to create an account share granting access to a tenant.

    When creating via the account-scoped endpoint (/accounts/{account_id}/shares)
    the account_id may be omitted from the body and will be derived from the
    path parameter. For the deprecated global /account_shares endpoint the
    account_id may be supplied in the payload.

    Args:
        account_id: Optional account to share (may be provided or omitted).
        tenant_id: Tenant receiving the share.
        visibility: Visibility of the shared balance.
    """
    # account_id: Optional[UUID] = None
    tenant_id: UUID
    visibility: Optional[ShareVisibility] = ShareVisibility.HIDDEN

class AccountShareRead(SQLModel):
    """Read schema for account share data returned by the API.

    Attributes:
        id: Share id.
        account_id: Shared account id.
        tenant_id: Tenant receiving the share.
        tenant_name: Name of the tenant (family) receiving the share.
        visibility: Visibility setting for the share.
        granted_by: User that granted the share.
        granted_at: Timestamp when the share was granted.
    """
    id: UUID
    account_id: UUID
    tenant_id: UUID
    tenant_name: str
    visibility: ShareVisibility
    granted_by: UUID
    granted_at: datetime


class AccountShareUpdate(SQLModel):
    """Input schema for updating an account share.

    Args:
        visibility: New visibility setting (optional).
    """
    visibility: Optional[ShareVisibility] = None


# -------------------------
# Budget
# -------------------------
class BudgetCreate(SQLModel):
    """Input schema to create a budget.

    The tenant_id is derived from the active context (access token).
    Category IDs are optional; when omitted the budget becomes a universal
    budget that tracks ALL tenant expense transactions.

    Args:
        name: Human-readable budget name.
        amount: Spending limit (must be > 0).
        currency: Currency code for the budget (defaults to BRL).
        category_ids: Optional list of category UUIDs to associate.
        icon: Optional lucide-react icon name for visual identity.
        color: Optional hex color string (#RRGGBB) for visual identity.
    """
    name: str
    amount: Decimal = Field(gt=0)
    currency: Optional[Currency] = Currency.BRL
    category_ids: Optional[List[UUID]] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class BudgetRead(SQLModel):
    """Read schema for budget data returned by the API.

    Includes computed fields (spent, month, year) that are calculated
    on-read by aggregating expense transactions for the requested month.

    Attributes:
        id: Budget identifier.
        tenant_id: Tenant the budget belongs to.
        name: Budget name.
        amount: Budget spending limit.
        currency: Currency code.
        categories: List of associated categories.
        spent: Total expenses in the budget's categories for the month.
        month: Calendar month the spent calculation covers.
        year: Calendar year the spent calculation covers.
        icon: Optional lucide-react icon name.
        color: Optional hex color string (#RRGGBB).
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    id: UUID
    tenant_id: UUID
    name: str
    amount: Decimal
    currency: Currency
    categories: List[CategoryRead] = []
    spent: Decimal = Decimal("0.00")
    month: int
    year: int
    icon: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BudgetUpdate(SQLModel):
    """Input schema for updating a budget.

    When category_ids is provided it fully replaces the existing category
    set. When omitted, categories remain unchanged.

    Args:
        name: New budget name (optional).
        amount: New spending limit (optional, must be > 0).
        currency: New currency code (optional).
        category_ids: Optional list replacing the entire category set.
        icon: New icon name (pass None to clear).
        color: New hex color (pass None to clear).
    """
    name: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    currency: Optional[Currency] = None
    category_ids: Optional[List[UUID]] = None
    icon: Optional[str] = None
    color: Optional[str] = None


# -------------------------
# CSV Import
# -------------------------

class ImportUploadResponse(SQLModel):
    """Response returned after successfully uploading a CSV file.

    Attributes:
        file_key: Opaque storage key used to reference the file in subsequent steps.
        filename: Original filename the user uploaded, preserved for the
                  import history display.
        detected_columns: Column names from the first (header) row of the CSV.
        sample_rows: Up to 5 data rows as raw string dicts for preview.
        row_count: Total number of data rows in the file.
    """
    file_key: str
    filename: Optional[str] = None
    detected_columns: List[str]
    sample_rows: List[dict]
    row_count: int


class ColumnMapping(SQLModel):
    """Maps CSV column names to transaction fields.

    Only date_column and amount_column are required. When type_column is
    omitted, the transaction type is inferred from the sign of the amount
    (negative → expense, positive → income).

    Args:
        date_column: CSV column containing the transaction date.
        amount_column: CSV column containing the monetary amount.
        description_column: Optional column for the transaction description.
        type_column: Optional column indicating expense/income (various values supported).
    """
    date_column: str
    amount_column: str
    description_column: Optional[str] = None
    type_column: Optional[str] = None


class AnalyzeRequest(SQLModel):
    """Request body for the /imports/analyze endpoint.

    Args:
        file_key: Storage key returned by /imports/upload.
        account_id: Target account UUID for the import.
        column_mapping: How CSV columns map to transaction fields.
        start_row: Zero-indexed row number of the header row (default 0).
        currency: Currency to assign to all imported transactions.
        positive_amounts_are_expenses: When True, flips sign-based type inference so
            positive amounts become expenses and negative amounts income. This matches
            credit-card statements (purchases positive, payments negative). Defaults to
            False (bank/debit convention). Only affects rows whose type is inferred from
            the amount sign — an explicit type_column still takes precedence.
    """
    file_key: str
    account_id: UUID
    column_mapping: ColumnMapping
    start_row: int = 0
    currency: Optional[Currency] = Currency.BRL
    positive_amounts_are_expenses: bool = False


class ParsedRow(SQLModel):
    """A single transaction row parsed from the CSV during the analyze step.

    Attributes:
        row_index: Zero-indexed position within the data rows.
        transaction_date: Parsed date in ISO format (YYYY-MM-DD).
        amount: Absolute monetary amount as a decimal string.
        transaction_type: "expense" or "income".
        description: Extracted description text, or None.
        is_duplicate: True when a matching transaction already exists in the DB.
        matching_transaction_id: UUID of the matching transaction when is_duplicate=True.
        parse_error: Human-readable error message when the row could not be parsed.
    """
    row_index: int
    transaction_date: Optional[date] = None
    amount: Optional[Decimal] = None
    transaction_type: Optional[str] = None
    description: Optional[str] = None
    is_duplicate: bool = False
    matching_transaction_id: Optional[UUID] = None
    parse_error: Optional[str] = None


class AnalyzeResponse(SQLModel):
    """Response from /imports/analyze containing all parsed rows with duplicate flags.

    Attributes:
        rows: All data rows from the CSV with parse results and duplicate flags.
        duplicate_count: Number of rows that match existing transactions.
        parse_error_count: Number of rows that could not be parsed.
        date_range_start: Earliest transaction date in the CSV.
        date_range_end: Latest transaction date in the CSV.
    """
    rows: List[ParsedRow]
    duplicate_count: int
    parse_error_count: int
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None


class RowToImport(SQLModel):
    """A single transaction row confirmed by the user for import.

    The user may have edited the description or assigned a category
    during the review step. Only non-skipped rows are included in the
    ExecuteRequest.

    Args:
        row_index: Original zero-indexed row position (for traceability).
        transaction_date: Date in YYYY-MM-DD format.
        amount: Absolute monetary amount as a decimal string.
        transaction_type: "expense" or "income".
        description: Final description (may differ from CSV value).
        category_id: Optional category UUID selected by the user.
    """
    row_index: int
    transaction_date: date
    amount: Decimal
    transaction_type: str
    description: Optional[str] = None
    category_id: Optional[UUID] = None


class ExecuteRequest(SQLModel):
    """Request body for /imports/execute — triggers the background import job.

    Args:
        file_key: Storage key from the upload step (deleted after import).
        filename: Original filename uploaded by the user (persisted to history).
        account_id: Target account for all imported transactions.
        currency: Currency assigned to all imported transactions.
        rows: User-confirmed list of non-skipped rows with final field values.
    """
    file_key: str
    filename: Optional[str] = None
    account_id: UUID
    currency: Optional[Currency] = Currency.BRL
    rows: List[RowToImport]


class ExecuteResponse(SQLModel):
    """Response from /imports/execute containing the background job identifier.

    Attributes:
        job_id: Celery task ID used to poll /imports/jobs/{job_id} for status.
    """
    job_id: str


class JobStatusResponse(SQLModel):
    """Response from /imports/jobs/{job_id} describing current import progress.

    Attributes:
        job_id: The Celery task ID being polled.
        status: One of pending / started / done / failed.
        imported: Number of transactions imported so far (available after started).
        total: Total rows to import (available after started).
        error: Human-readable error message (only present when status=failed).
    """
    job_id: str
    status: str
    imported: Optional[int] = None
    total: Optional[int] = None
    error: Optional[str] = None


class ImportJobRead(SQLModel):
    """Read schema for a single historical import job.

    Returned by GET /imports/jobs. The account_name is joined in at query time
    so the history list can render without follow-up requests per row.

    Attributes:
        id: Import job identifier.
        account_id: Target account UUID.
        account_name: Display name of the target account.
        filename: Original filename uploaded by the user, or None.
        total_rows: Number of rows the user confirmed for import.
        imported_rows: Number of rows actually committed to the DB.
        status: Lifecycle status (pending/started/done/failed).
        error_message: Failure reason (only when status=failed).
        created_at: When the import was dispatched.
        completed_at: When the worker finished (only when status in {done, failed}).
    """
    id: UUID
    account_id: UUID
    account_name: Optional[str] = None
    filename: Optional[str] = None
    total_rows: int
    imported_rows: int
    status: ImportJobStatus
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
