// src/features/settings/hooks/useExchangeRates.ts
// React Query hooks for reading and updating per-family exchange rates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getExchangeRates,
  updateExchangeRate,
  deleteExchangeRate,
  type ExchangeRateRead,
} from '../api/exchangeRatesApi';

/**
 * Fetch all exchange rates configured for a family.
 *
 * Used in two places:
 * 1. CurrencySettings — to display and edit the rate table
 * 2. TransactionForm — to compute the live conversion preview
 *
 * @param familyId - UUID of the family whose rates to fetch
 */
export function useExchangeRates(familyId: string) {
  return useQuery<ExchangeRateRead[]>({
    queryKey: ['exchangeRates', familyId],
    queryFn: () => getExchangeRates(familyId),
    // Exchange rates are unlikely to change mid-session; stale time of 5 minutes
    // reduces redundant fetches while the user fills out transaction forms
    staleTime: 5 * 60 * 1000,
    enabled: !!familyId,
  });
}

/**
 * Mutation hook for creating or updating an exchange rate for a specific currency.
 *
 * After a successful save, the exchange rates list is invalidated so the
 * CurrencySettings table and TransactionForm preview both update immediately.
 *
 * @param familyId - UUID of the family to configure rates for
 */
export function useUpdateExchangeRate(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ currency, rate }: { currency: string; rate: number }): Promise<ExchangeRateRead> => {
      return updateExchangeRate(familyId, currency, rate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchangeRates', familyId] });
    },
  });
}

/**
 * Mutation hook for deleting an exchange rate for a specific currency.
 *
 * After deletion the rates list is invalidated so the UI reflects the change.
 *
 * @param familyId - UUID of the family to remove the rate from
 */
export function useDeleteExchangeRate(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (currency: string): Promise<void> => {
      return deleteExchangeRate(familyId, currency);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchangeRates', familyId] });
    },
  });
}
