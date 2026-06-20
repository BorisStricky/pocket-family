// src/features/family/components/FamilySettings.tsx
// Family settings component with leave/delete actions
// Shows contextual actions based on the current user's role

import { useState } from 'react';
import { formatDisplayDate } from '@/lib/dateUtils';
import {
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Box,
} from '@mui/material';
import { LogOut, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TenantRead, MembershipRead } from '@/types/family';

/**
 * Props for FamilySettings component
 */
interface FamilySettingsProps {
  /** The family data */
  family: TenantRead;
  /** The current user's membership in this family */
  currentUserMembership: MembershipRead | null;
  /** Called when user clicks "Leave Family" */
  onLeaveFamily?: () => void;
  /** Called when owner clicks "Delete Family" */
  onDeleteFamily?: () => void;
  /** Whether a leave or delete operation is in progress */
  isLoading?: boolean;
  /** Error message for failed operations */
  error?: string;
  /** Number of active owners in this family (for owner leave rules) */
  activeOwnerCount?: number;
}

/**
 * FamilySettings - Displays family info and provides leave/delete actions
 *
 * Shows role-aware actions:
 * - Members/viewers can leave
 * - Owners can leave only if another active owner exists
 * - Owners can always delete
 *
 * The delete confirmation requires typing the family name to prevent accidental deletions.
 * This is a common pattern for destructive actions on important data.
 */
export function FamilySettings({
  family,
  currentUserMembership,
  onLeaveFamily,
  onDeleteFamily,
  isLoading = false,
  error,
  activeOwnerCount = 0,
}: FamilySettingsProps) {
  const { t } = useTranslation();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  const isOwner = currentUserMembership?.role === 'owner';
  const canOwnerLeave = isOwner && activeOwnerCount > 1;
  const canShowLeave = !isOwner || canOwnerLeave;

  // Delete confirmation requires exact family name match for safety
  const isDeleteConfirmed = deleteConfirmationName === family.name;

  const handleConfirmLeave = () => {
    if (onLeaveFamily) {
      onLeaveFamily();
    }
    setLeaveDialogOpen(false);
  };

  const handleConfirmDelete = () => {
    if (onDeleteFamily && isDeleteConfirmed) {
      onDeleteFamily();
    }
    setDeleteDialogOpen(false);
    setDeleteConfirmationName('');
  };

  return (
    <Paper sx={{ padding: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('family.settingsTitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ marginBottom: 2 }}>
          {error}
        </Alert>
      )}

      {/* Family information */}
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('family.settingsFamilyName')}
        </Typography>
        <Typography variant="body1">{family.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ marginTop: 1 }}>
          {t('family.settingsCreated', { date: formatDisplayDate(family.created_at) })}
        </Typography>
      </Box>

      <Stack spacing={2}>
        {/* Leave Family - visible for non-owners and owners when another owner exists */}
        {canShowLeave && (
          <Button
            variant="outlined"
            color="warning"
            startIcon={<LogOut size={18} />}
            onClick={() => setLeaveDialogOpen(true)}
            disabled={isLoading}
          >
            {t('family.leaveFamily')}
          </Button>
        )}

        {/* Delete Family - visible for owners only */}
        {isOwner && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Trash2 size={18} />}
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isLoading}
          >
            {t('family.deleteFamily')}
          </Button>
        )}
      </Stack>

      {/* Leave Family Confirmation Dialog */}
      <Dialog
        open={leaveDialogOpen}
        // Prevent closing on backdrop click to avoid accidental data loss on mobile
        onClose={(_event: object, reason: string) => {
          if (reason === 'backdropClick') return;
          setLeaveDialogOpen(false);
        }}
        aria-labelledby="leave-family-dialog-title"
      >
        <DialogTitle id="leave-family-dialog-title">{t('family.leaveDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('family.leaveDialogMessage', { name: family.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveDialogOpen(false)} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmLeave}
            color="warning"
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? t('family.leaving') : t('family.leaveFamilyConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Family Confirmation Dialog - requires typing family name */}
      <Dialog
        open={deleteDialogOpen}
        // Prevent closing on backdrop click to avoid accidental data loss on mobile
        onClose={(_event: object, reason: string) => {
          if (reason === 'backdropClick') return;
          setDeleteDialogOpen(false);
          setDeleteConfirmationName('');
        }}
        aria-labelledby="delete-family-dialog-title"
      >
        <DialogTitle id="delete-family-dialog-title" sx={{ color: 'error.main' }}>
          {t('family.deleteDialogTitle')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {t('family.deletePermanentWarning')}
          </Alert>
          <DialogContentText sx={{ marginBottom: 2 }}>
            {t('family.deleteDialogIntro', { name: family.name })}
          </DialogContentText>
          <Box component="ul" sx={{ paddingLeft: 2, marginBottom: 2 }}>
            <li>{t('family.deleteListMembers')}</li>
            <li>{t('family.deleteListTransactions')}</li>
            <li>{t('family.deleteListAccounts')}</li>
            <li>{t('family.deleteListCategories')}</li>
          </Box>
          <DialogContentText sx={{ marginBottom: 2 }}>
            {t('family.deleteTypePrompt', { name: family.name })}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            placeholder={family.name}
            value={deleteConfirmationName}
            onChange={(event) => setDeleteConfirmationName(event.target.value)}
            disabled={isLoading}
            error={deleteConfirmationName.length > 0 && !isDeleteConfirmed}
            helperText={
              deleteConfirmationName.length > 0 && !isDeleteConfirmed
                ? t('family.deleteNameMismatch')
                : undefined
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmationName('');
            }}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isLoading || !isDeleteConfirmed}
          >
            {isLoading ? t('family.deleting') : t('family.permanentlyDelete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
