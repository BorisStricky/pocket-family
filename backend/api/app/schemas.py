# backend/api/app/schemas.py
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

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
        default_currency: The family's main currency for transaction conversion.
        created_at: Creation timestamp.
    """
    id: UUID
    name: str
    default_currency: Currency
    created_at: datetime


class TenantUpdate(SQLModel):
    """Input schema for updating a tenant's properties.

    Args:
        name: New name for the tenant (optional).
        default_currency: New default currency (optional). Changing this does not
            retroactively re-convert existing transactions.
    """
    name: Optional[str] = None
    default_currency: Optional[Currency] = None


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
    """
    name: str
    type: AccountType
    currency: Optional[Currency] = Currency.BRL
    balance: Optional[Decimal] = Decimal("0.00")
    share_with: Optional[AccountShareWith] = None


class AccountRead(SQLModel):
    """Read schema for account data returned by the API.

    Attributes:
        id: Account identifier.
        user_id: Owner user id.
        name: Account name.
        type: Account type.
        currency: Currency code.
        balance: Monetary balance or None when masked.
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
    created_at: datetime
    updated_at: datetime


class AccountUpdate(SQLModel):
    """Input schema for updating an account.

    Args:
        name: New account name.
        type: New account type.
        currency: New currency code.
        balance: New balance value.
    """
    name: Optional[str] = None
    type: Optional[AccountType] = None
    currency: Optional[Currency] = None
    balance: Optional[Decimal] = None


# -------------------------
# Category
# -------------------------
class CategoryCreate(SQLModel):
    """Input schema to create a category.

    Args:
        name: Category name.
        kind: Category kind (expense/income).
        parent_id: Optional parent category id.
    """
    name: str
    kind: CategoryKind
    parent_id: Optional[UUID] = None


class CategoryRead(SQLModel):
    """Read schema returning category data.

    Attributes:
        id: Category id.
        tenant_id: Tenant id.
        name: Category name.
        kind: Category kind.
        parent_id: Optional parent id.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    id: UUID
    tenant_id: UUID
    name: str
    kind: CategoryKind
    parent_id: Optional[UUID] = None
    parent_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CategoryUpdate(SQLModel):
    """Input schema for updating a category.

    Args:
        name: New name (optional).
        kind: New kind (optional).
        parent_id: New parent id (optional).
    """
    name: Optional[str] = None
    kind: Optional[CategoryKind] = None
    parent_id: Optional[UUID] = None


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
        amount: Monetary amount in the family's default currency (after conversion).
        currency: The family's default currency code (the currency of `amount`).
        original_amount: Amount exactly as the user entered it (before conversion).
        original_currency: Currency as the user entered it. Equals `currency` when
            the transaction was recorded in the family's default currency.
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
    category_id: Optional[UUID]
    category_name: Optional[str]
    amount: Decimal
    currency: Currency
    original_amount: Decimal
    original_currency: Currency
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
    """
    name: str
    amount: Decimal = Field(gt=0)
    currency: Optional[Currency] = Currency.BRL
    category_ids: Optional[List[UUID]] = None


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
    """
    name: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    currency: Optional[Currency] = None
    category_ids: Optional[List[UUID]] = None


# -------------------------
# CurrencyExchangeRate
# -------------------------
class CurrencyExchangeRateRead(SQLModel):
    """Read schema for a per-family exchange rate.

    Attributes:
        id: Exchange rate record identifier.
        tenant_id: Family this rate belongs to.
        currency: The foreign currency (not the family's default).
        rate: How many units of the family's default currency equal 1 unit of
            this foreign currency (e.g. 5.5 when default=BRL, currency=USD).
        updated_at: Timestamp of last update.
    """
    id: UUID
    tenant_id: UUID
    currency: Currency
    rate: Decimal
    updated_at: datetime


class CurrencyExchangeRateUpdate(SQLModel):
    """Input schema for creating or updating an exchange rate.

    The currency is provided in the URL path, not in the body.

    Args:
        rate: Exchange rate — units of family default currency per 1 unit of
            the foreign currency. Must be greater than zero.
    """
    rate: Decimal = Field(gt=0)
