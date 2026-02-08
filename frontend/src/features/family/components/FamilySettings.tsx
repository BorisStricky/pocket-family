// src/features/family/components/FamilySettings.tsx
// Family settings component with leave/delete actions
// Shows contextual actions based on the current user's role

import { useState } from 'react';
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
        Family Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ marginBottom: 2 }}>
          {error}
        </Alert>
      )}

      {/* Family information */}
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Family Name
        </Typography>
        <Typography variant="body1">{family.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ marginTop: 1 }}>
          Created: {new Date(family.created_at).toLocaleDateString()}
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
            Leave Family
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
            Delete Family
          </Button>
        )}
      </Stack>

      {/* Leave Family Confirmation Dialog */}
      <Dialog
        open={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        aria-labelledby="leave-family-dialog-title"
      >
        <DialogTitle id="leave-family-dialog-title">Leave Family</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to leave <strong>{family.name}</strong>?
            You will lose access to all family data including transactions,
            accounts, and categories.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveDialogOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmLeave}
            color="warning"
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Leaving...' : 'Leave Family'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Family Confirmation Dialog - requires typing family name */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmationName('');
        }}
        aria-labelledby="delete-family-dialog-title"
      >
        <DialogTitle id="delete-family-dialog-title" sx={{ color: 'error.main' }}>
          Delete Family
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            This action is permanent and cannot be undone!
          </Alert>
          <DialogContentText sx={{ marginBottom: 2 }}>
            Deleting <strong>{family.name}</strong> will permanently remove:
          </DialogContentText>
          <Box component="ul" sx={{ paddingLeft: 2, marginBottom: 2 }}>
            <li>All family members and their access</li>
            <li>All transactions and financial records</li>
            <li>All accounts and balances</li>
            <li>All categories and budgets</li>
          </Box>
          <DialogContentText sx={{ marginBottom: 2 }}>
            To confirm, type the family name: <strong>{family.name}</strong>
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
                ? 'Name does not match'
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
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isLoading || !isDeleteConfirmed}
          >
            {isLoading ? 'Deleting...' : 'Permanently Delete Family'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
