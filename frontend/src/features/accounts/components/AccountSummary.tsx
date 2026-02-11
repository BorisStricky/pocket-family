// src/features/accounts/components/AccountSummary.tsx
// Component for displaying account information in a summary card

import React from 'react';
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

  // Format account type for display (capitalize first letter)
  const formatAccountType = (type: AccountType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Format balance with currency symbol
  // Returns "Hidden" if balance is null (shared account with hidden visibility)
  const formatBalance = (): string => {
    if (account.balance === null) {
      return 'Hidden';
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
          <Typography variant="h5" component="h2" gutterBottom>
            {account.name}
          </Typography>
          {showEditButton && onEdit && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={onEdit}
            >
              Edit
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
            Current Balance
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
            Owner
          </Typography>
          <Typography variant="body1">{account.user_name}</Typography>
        </Box>

        {/* Timestamps */}
        <Stack direction="row" spacing={4} mt={2}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Created
            </Typography>
            <Typography variant="body2">{formatDate(account.created_at)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Last Updated
            </Typography>
            <Typography variant="body2">{formatDate(account.updated_at)}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
