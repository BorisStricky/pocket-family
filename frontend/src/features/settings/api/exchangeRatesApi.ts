// src/features/settings/api/exchangeRatesApi.ts
// API functions for managing per-family currency exchange rates
// Exchange rates define how many units of the family's default currency
// equal one unit of a foreign currency (e.g. 5.5 when default=BRL, currency=USD)

import { apiFetch } from '@/lib/apiClient';

/**
 * Represents one exchange rate row returned by the API.
 * currency is the foreign currency; rate is units-of-default per 1 unit of currency.
 */
export interface ExchangeRateRead {
  id: string;
  tenant_id: string;
  currency: string; // BRL | USD | EUR | RSD
  rate: string;     // Decimal returned as string for precision
  updated_at: string; // ISO datetime string
}

/**
 * Fetch all exchange rates configured for a family.
 * Calls GET /tenants/{familyId}/exchange-rates
 * Any active member (owner, member, viewer) may read exchange rates.
 */
export async function getExchangeRates(familyId: string): Promise<ExchangeRateRead[]> {
  return apiFetch(`/tenants/${familyId}/exchange-rates`, { method: 'GET' });
}

/**
 * Create or update the exchange rate for a specific foreign currency.
 * Calls PUT /tenants/{familyId}/exchange-rates/{currency}
 * Only owners can configure exchange rates.
 * Performs an upsert: creates the row if it doesn't exist, updates if it does.
 */
export async function updateExchangeRate(
  familyId: string,
  currency: string,
  rate: number
): Promise<ExchangeRateRead> {
  return apiFetch(`/tenants/${familyId}/exchange-rates/${currency}`, {
    method: 'PUT',
    body: JSON.stringify({ rate }),
  });
}

/**
 * Remove a configured exchange rate for a foreign currency.
 * Calls DELETE /tenants/{familyId}/exchange-rates/{currency}
 * Only owners can delete exchange rates.
 * After deletion, transactions in this currency will fail with a 422 error
 * until the rate is re-configured.
 */
export async function deleteExchangeRate(
  familyId: string,
  currency: string
): Promise<void> {
  return apiFetch(`/tenants/${familyId}/exchange-rates/${currency}`, {
    method: 'DELETE',
  });
}
