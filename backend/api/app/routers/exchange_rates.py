# backend/api/app/routers/exchange_rates.py
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import CurrencyExchangeRate, Currency, MembershipRole, MembershipStatus
from ..schemas import CurrencyExchangeRateRead, CurrencyExchangeRateUpdate, ActiveContext
from ..deps import get_db, get_active_context

# Exchange rates are nested under /tenants so they share the same URL namespace
# and tenant-auth pattern as the rest of tenant-scoped resources.
router = APIRouter(prefix="/tenants", tags=["exchange-rates"])


@router.get("/{tenant_id}/exchange-rates", response_model=List[CurrencyExchangeRateRead])
async def list_exchange_rates(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """List all exchange rates configured for a family.

    Any active family member (owner, member, viewer) may read exchange rates.
    The rates are needed by the frontend to preview currency conversion before
    submitting a transaction.

    Args:
        tenant_id: Family to list rates for.

    Returns:
        List of CurrencyExchangeRateRead records, one per configured currency.
    """
    tenant = active_context.active_tenant
    membership = active_context.active_membership

    # Ensure the token's tenant matches the URL tenant to prevent cross-family reads
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    if membership.status != MembershipStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an active member")

    rate_query = select(CurrencyExchangeRate).where(CurrencyExchangeRate.tenant_id == tenant_id)
    rate_query_result = await db.execute(rate_query)
    return rate_query_result.scalars().all()


@router.put(
    "/{tenant_id}/exchange-rates/{currency}",
    response_model=CurrencyExchangeRateRead,
)
async def update_exchange_rate(
    tenant_id: UUID,
    currency: Currency,
    payload: CurrencyExchangeRateUpdate,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Create or update the exchange rate for a specific foreign currency.

    Only family owners may configure exchange rates. The rate is stored as
    "how many units of the family's default currency equal 1 unit of the
    foreign currency" — for example, if the family default is BRL and the
    foreign currency is USD, a rate of 5.5 means 1 USD = 5.5 BRL.

    The (tenant_id, currency) pair is unique, so this endpoint performs an
    upsert: it creates the row if it doesn't exist, or updates the rate if it does.

    Args:
        tenant_id: Family to configure the rate for.
        currency: The foreign currency code (e.g. USD, EUR, RSD).
        payload: CurrencyExchangeRateUpdate with the new rate value.

    Returns:
        The saved CurrencyExchangeRateRead record.

    Raises:
        HTTPException 400 if currency equals the family's default currency
            (a rate of 1:1 for the main currency is meaningless to store).
        HTTPException 403 if the requester is not an owner.
    """
    tenant = active_context.active_tenant
    membership = active_context.active_membership

    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    if membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can configure exchange rates")

    # Storing a rate for the family's own default currency is a no-op that would
    # cause confusion (conversion is only applied when currencies differ).
    if currency == tenant.default_currency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{currency} is already the family's default currency; no rate needed",
        )

    # Look for an existing rate row to update (upsert pattern)
    existing_rate_query = select(CurrencyExchangeRate).where(
        CurrencyExchangeRate.tenant_id == tenant_id,
        CurrencyExchangeRate.currency == currency,
    )
    existing_rate_result = await db.execute(existing_rate_query)
    exchange_rate_record = existing_rate_result.scalars().first()

    if exchange_rate_record:
        exchange_rate_record.rate = payload.rate
        exchange_rate_record.updated_at = datetime.utcnow()
    else:
        exchange_rate_record = CurrencyExchangeRate(
            tenant_id=tenant_id,
            currency=currency,
            rate=payload.rate,
        )

    db.add(exchange_rate_record)
    await db.commit()
    await db.refresh(exchange_rate_record)
    return exchange_rate_record


@router.delete("/{tenant_id}/exchange-rates/{currency}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exchange_rate(
    tenant_id: UUID,
    currency: Currency,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Remove a configured exchange rate for a foreign currency.

    After deletion, attempting to create a transaction in that currency will
    return a 422 error until the rate is re-configured.

    Only owners may delete exchange rates.

    Args:
        tenant_id: Family to remove the rate from.
        currency: The foreign currency code to remove.

    Raises:
        HTTPException 403 if the requester is not an owner.
        HTTPException 404 if no rate exists for that currency.
    """
    tenant = active_context.active_tenant
    membership = active_context.active_membership

    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    if membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can configure exchange rates")

    rate_query = select(CurrencyExchangeRate).where(
        CurrencyExchangeRate.tenant_id == tenant_id,
        CurrencyExchangeRate.currency == currency,
    )
    rate_result = await db.execute(rate_query)
    exchange_rate_record = rate_result.scalars().first()

    if not exchange_rate_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No exchange rate found for {currency}")

    await db.delete(exchange_rate_record)
    await db.commit()
    return
