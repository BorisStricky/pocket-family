// src/features/accounts/components/AccountShareList.tsx
// Component for displaying and managing account shares

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useAccountShares } from '../hooks/useAccountShares';
import { useDeleteAccountShare } from '../hooks/useDeleteAccountShare';
import type { AccountShareRead, ShareVisibility } from '@/types/account';

/**
 * Props for AccountShareList component
 */
interface AccountShareListProps {
  accountId: string;
  isOwner: boolean;
  onShareClick?: () => void;
  onEditShare?: (share: AccountShareRead) => void;
}

/**
 * AccountShareList component displays families an account is shared with
 *
 * Features:
 * - Only renders content if user is account owner
 * - Lists all families account is shared with
 * - Shows visibility status for each share (hidden/visible)
 * - Edit button to change share visibility
 * - Delete button to remove share (with confirmation)
 * - "Share Account" button to add new shares
 * - Empty state when no shares exist
 *
 * Visibility Status:
 * - "Hidden": Family members see account but balance is masked (null)
 * - "Visible": Family members see full account details including balance
 *
 * @example
 * <AccountShareList
 *   accountId={accountId}
 *   isOwner={isOwner}
 *   onShareClick={() => setShareDialogOpen(true)}
 *   onEditShare={(share) => openEditDialog(share)}
 * />
 */
export function AccountShareList({
  accountId,
  isOwner,
  onShareClick,
  onEditShare,
}: AccountShareListProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState<AccountShareRead | null>(
    null
  );

  // Fetch shares only if user is owner
  // Query is automatically disabled when isOwner is false
  const { data: shares, isLoading, error } = useAccountShares(accountId, {
    isOwner,
  });

  // Mutation for deleting shares
  const { mutate: deleteShare, isPending: isDeleting } =
    useDeleteAccountShare();

  // Don't render anything if user is not owner
  if (!isOwner) {
    return null;
  }

  // Handle delete confirmation dialog open
  const handleDeleteClick = (share: AccountShareRead) => {
    setShareToDelete(share);
    setDeleteConfirmOpen(true);
  };

  // Handle delete confirmation dialog close
  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setShareToDelete(null);
  };

  // Handle confirmed delete action
  const handleDeleteConfirm = () => {
    if (shareToDelete) {
      deleteShare(
        {
          accountId,
          tenantId: shareToDelete.tenant_id,
        },
        {
          onSuccess: () => {
            setDeleteConfirmOpen(false);
            setShareToDelete(null);
          },
        }
      );
    }
  };

  // Map visibility to chip color
  // Hidden = gray (default), Visible = green (success)
  const getVisibilityColor = (
    visibility: ShareVisibility
  ): 'default' | 'success' => {
    return visibility === 'visible' ? 'success' : 'default';
  };

  // Format visibility label for display
  const formatVisibility = (visibility: ShareVisibility): string => {
    return visibility.charAt(0).toUpperCase() + visibility.slice(1);
  };

  return (
    <>
      <Card>
        <CardContent>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h3">
              Account Sharing
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<ShareIcon />}
              onClick={onShareClick}
              disabled={isLoading}
            >
              Share Account
            </Button>
          </Box>

          {/* Loading State */}
          {isLoading && (
            <Typography variant="body2" color="text.secondary">
              Loading shares...
            </Typography>
          )}

          {/* Error State */}
          {error && (
            <Typography variant="body2" color="error">
              Error loading shares: {error.message}
            </Typography>
          )}

          {/* Empty State */}
          {!isLoading && !error && shares && shares.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              This account is not shared with any families
            </Typography>
          )}

          {/* Shares List */}
          {!isLoading && !error && shares && shares.length > 0 && (
            <List>
              {shares.map((share) => (
                <ListItem
                  key={share.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        size="small"
                        onClick={() => onEditShare?.(share)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        size="small"
                        onClick={() => handleDeleteClick(share)}
                        disabled={isDeleting}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="body1">
                          {/* Display family name for better user experience */}
                          {share.tenant_name}
                        </Typography>
                        <Chip
                          label={formatVisibility(share.visibility)}
                          color={getVisibilityColor(share.visibility)}
                          size="small"
                        />
                      </Stack>
                    }
                    secondary={`Shared on ${new Date(share.granted_at).toLocaleDateString()}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-share-dialog-title"
      >
        <DialogTitle id="delete-share-dialog-title">Remove Share</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to stop sharing this account? The family will
            immediately lose access to this account.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing...' : 'Remove Share'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
