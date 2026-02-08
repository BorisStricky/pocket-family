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
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('member');
  const [validationError, setValidationError] = useState('');

  /**
   * Validate the email field before submission
   */
  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue.trim()) {
      setValidationError('Email address is required');
      return false;
    }
    if (!isValidEmail(emailValue.trim())) {
      setValidationError('Please enter a valid email address');
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="invite-member-dialog-title"
    >
      <DialogTitle id="invite-member-dialog-title">Invite Member</DialogTitle>
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
            label="Email Address"
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
            helperText={validationError || 'Enter the email address of the person to invite'}
            disabled={isLoading}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isLoading) {
                handleSubmit();
              }
            }}
          />

          {/* Role selector for the invited member */}
          <FormControl fullWidth>
            <InputLabel id="invite-role-label">Role</InputLabel>
            <Select
              labelId="invite-role-label"
              value={role}
              label="Role"
              onChange={(event) => setRole(event.target.value as MembershipRole)}
              disabled={isLoading}
            >
              <MenuItem value="owner">Owner - full control including member management</MenuItem>
              <MenuItem value="member">Member - can create and edit transactions</MenuItem>
              <MenuItem value="viewer">Viewer - read-only access</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !email.trim()}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? 'Sending...' : 'Send Invitation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
