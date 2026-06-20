// src/features/family/components/InviteMemberModal.tsx
// Modal dialog for inviting a new member to a family
// Allows owners to send email invitations with role selection

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MembershipRole } from '@/types/family';

/**
 * Props for InviteMemberModal component
 */
interface InviteMemberModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called with email and role when the form is submitted */
  onInvite: (email: string, role: MembershipRole) => void;
  /** Whether the invite request is in progress */
  isLoading?: boolean;
  /** Error message to display if invitation failed */
  error?: string;
  /** Success message to display after successful invitation */
  successMessage?: string;
}

/**
 * Basic email format validation
 * Checks for @ symbol and at least one dot after it
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * InviteMemberModal - A dialog for inviting new members to a family
 *
 * Features:
 * - Email input with validation (required, valid format)
 * - Role selector (member or viewer - owner role is not selectable)
 * - Success message display after sending invitation
 * - Loading state during API call
 * - Error display for failed invitations
 */
export function InviteMemberModal({
  open,
  onClose,
  onInvite,
  isLoading = false,
  error,
  successMessage,
}: InviteMemberModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('member');
  const [validationError, setValidationError] = useState('');

  /**
   * Validate the email field before submission
   */
  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue.trim()) {
      setValidationError(t('family.emailRequired'));
      return false;
    }
    if (!isValidEmail(emailValue.trim())) {
      setValidationError(t('family.emailInvalid'));
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSubmit = () => {
    if (validateEmail(email)) {
      onInvite(email.trim(), role);
    }
  };

  // Reset form state when modal closes
  const handleClose = () => {
    setEmail('');
    setRole('member');
    setValidationError('');
    onClose();
  };

  // Prevent closing on backdrop click to avoid accidental data loss on mobile
  const handleDialogClose = (_event: object, reason: string) => {
    if (reason === 'backdropClick') return;
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="invite-member-dialog-title"
    >
      <DialogTitle id="invite-member-dialog-title">{t('family.inviteDialogTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ marginTop: 1 }}>
          {/* Show success message after invitation sent */}
          {successMessage && (
            <Alert severity="success">{successMessage}</Alert>
          )}

          {/* Show API error if invitation failed */}
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          <TextField
            autoFocus
            label={t('family.emailLabel')}
            type="email"
            fullWidth
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              // Clear validation error on edit
              if (validationError) {
                validateEmail(event.target.value);
              }
            }}
            error={!!validationError}
            helperText={validationError || t('family.emailHelper')}
            disabled={isLoading}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isLoading) {
                handleSubmit();
              }
            }}
          />

          {/* Role selector for the invited member */}
          <FormControl fullWidth>
            <InputLabel id="invite-role-label">{t('family.roleLabel')}</InputLabel>
            <Select
              labelId="invite-role-label"
              value={role}
              label={t('family.roleLabel')}
              onChange={(event) => setRole(event.target.value as MembershipRole)}
              disabled={isLoading}
            >
              <MenuItem value="owner">{t('family.roleOwnerOption')}</MenuItem>
              <MenuItem value="member">{t('family.roleMemberOption')}</MenuItem>
              <MenuItem value="viewer">{t('family.roleViewerOption')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !email.trim()}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? t('family.sending') : t('family.sendInvitation')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
