// src/features/accounts/components/AccountSummary.tsx
// Component for displaying account information in a summary card

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import type { AccountRead, AccountType } from '@/types/account';
import { formatDisplayDate } from '@/lib/dateUtils';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

/**
 * Props for AccountSummary component
 */
interface AccountSummaryProps {
  account: AccountRead;
  onEdit?: () => void;
  showEditButton?: boolean;
}

/**
 * AccountSummary component displays key account information in a card
 *
 * Features:
 * - Account name as prominent heading
 * - Account type badge with color coding
 * - Currency display
 * - Current balance with formatting (or "Hidden" if null/masked)
 * - Owner name for multi-user context
 * - Created and updated timestamps
 * - Optional edit button for account owner
 *
 * Balance Display:
 * - Positive balances shown in green
 * - Negative balances shown in red (for credit card debt)
 * - Null/masked balances shown as "Hidden" (shared accounts with hidden visibility)
 *
 * @example
 * <AccountSummary
 *   account={account}
 *   onEdit={handleEdit}
 *   showEditButton={isOwner}
 * />
 */
export function AccountSummary({
  account,
  onEdit,
  showEditButton = false,
}: AccountSummaryProps) {
  const { t } = useTranslation();

  // Map account type to color for badge display
  // Matches the color scheme used in AgAccountsGrid
  const getAccountTypeColor = (
    type: AccountType
  ): 'default' | 'primary' | 'secondary' | 'success' => {
    switch (type) {
      case 'cash':
        return 'success'; // Green for cash accounts
      case 'debit':
        return 'primary'; // Blue for debit accounts
      case 'credit':
        return 'secondary'; // Purple for credit cards
      default:
        return 'default';
    }
  };

  // Format account type using the shared enums.accountType translation keys
  // for consistency with AgAccountsGrid and AccountSelect
  const formatAccountType = (type: AccountType): string => {
    return t(`enums.accountType.${type}`);
  };

  // Format balance with currency symbol.
  // Returns the localised "Hidden" label when balance is null
  // (shared account with hidden visibility).
  const formatBalance = (): string => {
    if (account.balance === null) {
      return t('accounts.hidden');
    }

    try {
      const balance = Number(account.balance);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: account.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(balance);
    } catch {
      return account.balance;
    }
  };

  // Determine balance color based on value
  // Negative = red (debt), Positive = green, Hidden = gray
  const getBalanceColor = (): string => {
    if (account.balance === null) {
      return 'text.secondary'; // Gray for hidden balance
    }

    const balance = Number(account.balance);
    if (isNaN(balance)) return 'text.primary';

    return balance < 0 ? 'error.main' : 'success.main';
  };

  // Format date for display using shared utility (dd-MMM-yyyy)
  const formatDate = (dateString: string): string => formatDisplayDate(dateString);

  return (
    <Card>
      <CardContent>
        {/* Header with Account Name and Edit Button */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {/* Colored circle with optional icon — only rendered when at least one is set */}
            {(account.icon || account.color) && (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: account.color ?? 'transparent',
                  border: account.color ? 'none' : '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {account.icon && (
                  <Icon
                    name={account.icon as IconName}
                    size={18}
                    style={{ color: account.color ? '#fff' : 'inherit' }}
                  />
                )}
              </Box>
            )}
            <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 0 }}>
              {account.name}
            </Typography>
          </Box>
          {showEditButton && onEdit && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={onEdit}
            >
              {t('common.edit')}
            </Button>
          )}
        </Box>

        {/* Account Type Badge and Currency */}
        <Stack direction="row" spacing={2} mb={3}>
          <Chip
            label={formatAccountType(account.type)}
            color={getAccountTypeColor(account.type)}
            size="medium"
          />
          <Chip label={account.currency} variant="outlined" size="medium" />
        </Stack>

        {/* Current Balance */}
        <Box mb={3}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('accounts.currentBalance')}
          </Typography>
          <Typography
            variant="h4"
            component="div"
            sx={{
              color: getBalanceColor(),
              fontWeight: 500,
              fontStyle: account.balance === null ? 'italic' : 'normal',
            }}
          >
            {formatBalance()}
          </Typography>
        </Box>

        {/* Account Owner */}
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('accounts.owner')}
          </Typography>
          <Typography variant="body1">{account.user_name}</Typography>
        </Box>

        {/* Timestamps */}
        <Stack direction="row" spacing={4} mt={2}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('accounts.created')}
            </Typography>
            <Typography variant="body2">{formatDate(account.created_at)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('accounts.lastUpdated')}
            </Typography>
            <Typography variant="body2">{formatDate(account.updated_at)}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
