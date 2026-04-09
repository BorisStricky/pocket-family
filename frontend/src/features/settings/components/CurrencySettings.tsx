// src/features/settings/components/CurrencySettings.tsx
// Currency settings panel: family default currency and per-currency exchange rates
// Only family owners can modify rates; all members can view them

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Paper,
} from '@mui/material';
import { useUpdateFamily } from '@/features/family/hooks/useUpdateFamily';
import { useExchangeRates, useUpdateExchangeRate } from '../hooks/useExchangeRates';
import type { TenantRead } from '@/types/family';
import type { MembershipRead } from '@/types/family';

/** All supported currency codes */
const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR', 'RSD'] as const;

/** Human-readable labels for each currency */
const CURRENCY_LABELS: Record<string, string> = {
  BRL: 'Brazilian Real (BRL)',
  USD: 'United States Dollar (USD)',
  EUR: 'Euro (EUR)',
  RSD: 'Serbian Dinar (RSD)',
};

interface CurrencySettingsProps {
  family: TenantRead;
  currentUserMembership: MembershipRead | null;
}

/**
 * CurrencySettings panel displayed in the Settings → Currency tab.
 *
 * Shows two sections:
 * 1. Default currency selector — the currency all transaction amounts are stored in.
 *    Changing it does NOT retroactively convert existing transactions.
 * 2. Exchange rate table — one editable row per non-default currency.
 *    Rate = how many units of the default currency equal 1 unit of the foreign currency.
 *    Example: default=BRL, currency=USD, rate=5.5 → 1 USD = 5.5 BRL.
 *
 * Owners can edit both. Members and viewers see a read-only view.
 */
export function CurrencySettings({ family, currentUserMembership }: CurrencySettingsProps) {
  const isOwner = currentUserMembership?.role === 'owner';

  // Fetch exchange rates currently configured for this family
  const { data: exchangeRates = [], isLoading: isLoadingRates } = useExchangeRates(family.id);

  // Mutation for updating the family's default currency
  const { mutate: updateFamily, isPending: isUpdatingCurrency, error: currencyUpdateError } =
    useUpdateFamily(family.id);

  // Mutation for saving an exchange rate
  const { mutate: updateExchangeRate, isPending: isSavingRate } = useUpdateExchangeRate(family.id);

  // Local state: draft rate values keyed by currency code
  // Pre-populated from the API; editable by owners before saving
  const [draftRates, setDraftRates] = useState<Record<string, string>>({});

  // Feedback messages per currency row after a save attempt
  const [rowMessages, setRowMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  // Sync draft rates when API data loads, only for currencies that have no unsaved draft yet
  React.useEffect(() => {
    const initialDrafts: Record<string, string> = {};
    for (const rate of exchangeRates) {
      if (!(rate.currency in draftRates)) {
        initialDrafts[rate.currency] = rate.rate;
      }
    }
    if (Object.keys(initialDrafts).length > 0) {
      setDraftRates((previous) => ({ ...initialDrafts, ...previous }));
    }
  }, [exchangeRates]);

  /** Non-default currencies that need rates configured */
  const foreignCurrencies = SUPPORTED_CURRENCIES.filter(
    (currency) => currency !== family.default_currency
  );

  const handleDefaultCurrencyChange = (newCurrency: string) => {
    updateFamily(
      { default_currency: newCurrency },
      {
        onSuccess: () => {
          // Clear any exchange rate drafts that may now be for the new main currency
          setDraftRates((previous) => {
            const updated = { ...previous };
            delete updated[newCurrency];
            return updated;
          });
        },
      }
    );
  };

  const handleSaveRate = (currency: string) => {
    const rateString = draftRates[currency];
    const rateValue = Number(rateString);

    if (!rateString || isNaN(rateValue) || rateValue <= 0) {
      setRowMessages((previous) => ({
        ...previous,
        [currency]: { type: 'error', text: 'Rate must be a positive number' },
      }));
      return;
    }

    updateExchangeRate(
      { currency, rate: rateValue },
      {
        onSuccess: () => {
          setRowMessages((previous) => ({
            ...previous,
            [currency]: { type: 'success', text: 'Saved' },
          }));
          // Clear the success message after 2 seconds
          setTimeout(() => {
            setRowMessages((previous) => {
              const updated = { ...previous };
              delete updated[currency];
              return updated;
            });
          }, 2000);
        },
        onError: (error: Error) => {
          setRowMessages((previous) => ({
            ...previous,
            [currency]: { type: 'error', text: error.message },
          }));
        },
      }
    );
  };

  /** Find the stored rate for a currency, if any */
  const getStoredRate = (currency: string) =>
    exchangeRates.find((rate) => rate.currency === currency);

  return (
    <Stack spacing={4}>
      {/* ── Section 1: Default Currency ── */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Default Currency
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          All transaction amounts are stored in this currency. When a transaction is
          recorded in a different currency, it is automatically converted using the
          exchange rates below. Changing this setting does{' '}
          <strong>not</strong> retroactively convert existing transactions.
        </Typography>

        {currencyUpdateError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to update: {(currencyUpdateError as Error).message}
          </Alert>
        )}

        <FormControl sx={{ minWidth: 280 }} disabled={!isOwner || isUpdatingCurrency}>
          <InputLabel id="default-currency-label">Default Currency</InputLabel>
          <Select
            labelId="default-currency-label"
            label="Default Currency"
            value={family.default_currency}
            onChange={(event) => handleDefaultCurrencyChange(event.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <MenuItem key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {isUpdatingCurrency && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption">Saving…</Typography>
          </Box>
        )}

        {!isOwner && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Only the family owner can change the default currency.
          </Typography>
        )}
      </Box>

      {/* ── Section 2: Exchange Rates ── */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Exchange Rates
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Set how many <strong>{family.default_currency}</strong> equal 1 unit of each
          foreign currency. These rates are used when recording transactions in a
          currency other than your default.
        </Typography>

        {isLoadingRates ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Currency</TableCell>
                  <TableCell>
                    Rate (1 unit = ? {family.default_currency})
                  </TableCell>
                  <TableCell>Last Updated</TableCell>
                  {isOwner && <TableCell align="right">Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {foreignCurrencies.map((currency) => {
                  const storedRate = getStoredRate(currency);
                  const draftValue = draftRates[currency] ?? '';
                  const rowMessage = rowMessages[currency];

                  return (
                    <TableRow key={currency}>
                      {/* Currency label with configured/not-configured indicator */}
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2">
                            {CURRENCY_LABELS[currency]}
                          </Typography>
                          {!storedRate && (
                            <Chip label="not set" size="small" color="warning" variant="outlined" />
                          )}
                        </Stack>
                      </TableCell>

                      {/* Rate input (editable for owners, read-only for others) */}
                      <TableCell>
                        {isOwner ? (
                          <TextField
                            size="small"
                            type="number"
                            value={draftValue}
                            onChange={(event) =>
                              setDraftRates((previous) => ({
                                ...previous,
                                [currency]: event.target.value,
                              }))
                            }
                            inputProps={{ min: 0, step: 'any' }}
                            sx={{ width: 140 }}
                            placeholder="e.g. 5.50"
                          />
                        ) : (
                          <Typography variant="body2">
                            {storedRate ? Number(storedRate.rate).toFixed(6) : '—'}
                          </Typography>
                        )}

                        {/* Per-row success / error feedback */}
                        {rowMessage && (
                          <Typography
                            variant="caption"
                            color={rowMessage.type === 'success' ? 'success.main' : 'error.main'}
                            sx={{ display: 'block', mt: 0.5 }}
                          >
                            {rowMessage.text}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Last updated timestamp */}
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {storedRate
                            ? new Date(storedRate.updated_at).toLocaleDateString()
                            : '—'}
                        </Typography>
                      </TableCell>

                      {/* Save button (owner only) */}
                      {isOwner && (
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleSaveRate(currency)}
                            disabled={isSavingRate || !draftValue}
                          >
                            Save
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>
    </Stack>
  );
}
