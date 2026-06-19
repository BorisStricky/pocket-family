// src/features/accounts/components/AddAccountModal.tsx
// Modal dialog for creating new accounts.
// Supports both family-scoped (auto-shares with family) and global (no sharing) contexts.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle, DialogContent, Alert } from '@mui/material';
import { AccountForm } from './AccountForm';
import { useCreateAccount } from '../hooks/useCreateAccount';
import type { AccountCreate, AccountRead } from '@/types/account';

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, auto-shares the new account with this family. Omit for global context. */
  familyId?: string;
  /** Optional callback with the newly created account, e.g. to auto-select it in a parent form. */
  onCreated?: (account: AccountRead) => void;
}

/**
 * AddAccountModal — Dialog wrapper around AccountForm for inline account creation.
 *
 * In family context (familyId provided): the new account is automatically shared
 * with the family so all members can see it immediately.
 *
 * In global context (no familyId): the account is created without any shares;
 * the user can share it with families later.
 */
export function AddAccountModal({ open, onClose, familyId, onCreated }: AddAccountModalProps) {
  const { t } = useTranslation();
  // Prevent closing on backdrop click to avoid accidental data loss on mobile
  const handleDialogClose = (_event: object, reason: string) => {
    if (reason === 'backdropClick') return;
    onClose();
  };

  const { mutate: createAccount, isPending, error } = useCreateAccount(familyId);

  const handleSubmit = (data: AccountCreate) => {
    // In family context, auto-share the account so family members see it right away
    const accountData: AccountCreate = familyId
      ? {
          ...data,
          share_with: {
            tenant_id: familyId,
            visibility: 'visible',
          },
        }
      : data;

    createAccount(accountData, {
      onSuccess: (newAccount) => {
        // Notify parent so it can auto-select the new account (e.g. in TransactionForm)
        onCreated?.(newAccount);
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('accounts.formTitleCreate')}</DialogTitle>
      <DialogContent>
        {/* API error displayed above the form */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error instanceof Error ? error.message : t('accounts.failedToCreate')}
          </Alert>
        )}

        <AccountForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isPending}
          hideTitle
        />
      </DialogContent>
    </Dialog>
  );
}
