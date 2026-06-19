// src/features/family/components/MembersList.tsx
// Displays the list of family members with their roles, statuses, and action menus
// Shows owner badge, pending status, and provides removal actions for owners

import { useState } from 'react';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { MoreVertical, Crown, Clock, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MembershipRead, MembershipRole } from '@/types/family';

/**
 * Props for MembersList component
 */
interface MembersListProps {
  /** List of memberships to display */
  members: MembershipRead[];
  /** The current user's membership in this family (for permission checks) */
  currentUserMembership?: MembershipRead | null;
  /** Called when the owner wants to remove a member */
  onRemoveMember?: (membershipId: string) => void;
  /** Whether a remove operation is in progress */
  isRemoveLoading?: boolean;
}

/**
 * Map of membership roles to display colors for badges
 * Helps users quickly identify member permissions at a glance
 */
const roleColorMap: Record<MembershipRole, 'primary' | 'default' | 'secondary'> = {
  owner: 'primary',
  member: 'default',
  viewer: 'secondary',
};

/**
 * Map of membership statuses to display colors
 */
const statusColorMap: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  pending: 'warning',
  revoked: 'error',
};

/**
 * MembersList - Displays family members with roles, statuses, and action menus
 *
 * Features:
 * - Shows member email/name with avatar
 * - Role badges (owner, member, viewer) with distinct colors
 * - Status badges (active, pending, revoked) for membership lifecycle
 * - Action menu for owners: remove member
 * - Highlights the current user's membership
 * - Confirmation dialog before removing a member
 * - Empty state when no members exist
 */
export function MembersList({
  members,
  currentUserMembership,
  onRemoveMember,
  isRemoveLoading = false,
}: MembersListProps) {
  const { t } = useTranslation();
  // State for the action menu (which member's menu is open)
  const [menuAnchorElement, setMenuAnchorElement] = useState<null | HTMLElement>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);

  // State for the remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MembershipRead | null>(null);

  // Determine if current user is an owner (needed for showing action menus)
  const isCurrentUserOwner = currentUserMembership?.role === 'owner';

  // Count active owners to determine if an owner can be removed
  // At least one owner must remain to prevent orphaned families
  const activeOwnerCount = members.filter(
    (member) => member.role === 'owner' && member.status === 'active'
  ).length;

  /**
   * Open the action menu for a specific member
   */
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, membershipId: string) => {
    setMenuAnchorElement(event.currentTarget);
    setSelectedMembershipId(membershipId);
  };

  /**
   * Close the action menu
   */
  const handleCloseMenu = () => {
    setMenuAnchorElement(null);
    setSelectedMembershipId(null);
  };

  /**
   * Open the remove confirmation dialog for a member
   */
  const handleOpenRemoveDialog = (member: MembershipRead) => {
    setMemberToRemove(member);
    setRemoveDialogOpen(true);
    handleCloseMenu();
  };

  /**
   * Confirm and execute member removal
   */
  const handleConfirmRemove = () => {
    if (memberToRemove && onRemoveMember) {
      onRemoveMember(memberToRemove.id);
    }
    setRemoveDialogOpen(false);
    setMemberToRemove(null);
  };

  // Empty state when no members
  if (members.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', paddingY: 4 }}>
        <Typography variant="body1" color="text.secondary">
          {t('family.noMembersYet')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ marginTop: 1 }}>
          {t('family.invitePrompt')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <List>
        {members.map((member) => {
          // Determine if this is the current user's row for highlighting
          const isCurrentUser = currentUserMembership?.id === member.id;

          // Display email or "Unknown" for members without email data
          const displayName = member.user_email || 'Unknown member';

          // Generate avatar initials from email
          const avatarInitial = displayName.charAt(0).toUpperCase();

          return (
            <ListItem
              key={member.id}
              sx={{
                // Highlight current user's membership with subtle background
                backgroundColor: isCurrentUser ? 'action.selected' : 'transparent',
                borderRadius: 1,
              }}
              secondaryAction={
                // Show action menu for owners on other members' rows
                // Allow removing other owners only when more than one owner exists
                isCurrentUserOwner && !isCurrentUser && (member.role !== 'owner' || activeOwnerCount > 1) ? (
                  <IconButton
                    edge="end"
                    aria-label={`actions for ${displayName}`}
                    onClick={(event) => handleOpenMenu(event, member.id)}
                  >
                    <MoreVertical size={20} />
                  </IconButton>
                ) : null
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ backgroundColor: isCurrentUser ? 'primary.main' : 'grey.400' }}>
                  {avatarInitial}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1">
                      {displayName}
                      {isCurrentUser && (
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          sx={{ marginLeft: 0.5 }}
                        >
                          {t('family.youSuffix')}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, marginTop: 0.5 }}>
                    {/* Role badge — translate the raw backend role value to a display label */}
                    <Chip
                      label={t(`family.role${member.role.charAt(0).toUpperCase()}${member.role.slice(1)}`)}
                      size="small"
                      color={roleColorMap[member.role]}
                      variant={member.role === 'owner' ? 'filled' : 'outlined'}
                      icon={member.role === 'owner' ? <Crown size={14} /> : undefined}
                    />
                    {/* Status badge — only show for non-active statuses; translate status value */}
                    {member.status !== 'active' && (
                      <Chip
                        label={t(`family.status${member.status.charAt(0).toUpperCase()}${member.status.slice(1)}`)}
                        size="small"
                        color={statusColorMap[member.status] || 'default'}
                        variant="outlined"
                        icon={member.status === 'pending' ? <Clock size={14} /> : <UserX size={14} />}
                      />
                    )}
                  </Box>
                }
              />
            </ListItem>
          );
        })}
      </List>

      {/* Action menu for member management (owner only) */}
      <Menu
        anchorEl={menuAnchorElement}
        open={Boolean(menuAnchorElement)}
        onClose={handleCloseMenu}
      >
        <MenuItem
          onClick={() => {
            const member = members.find((memberItem) => memberItem.id === selectedMembershipId);
            if (member) {
              handleOpenRemoveDialog(member);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          {t('family.removeMemberMenuItem')}
        </MenuItem>
      </Menu>

      {/* Confirmation dialog for removing a member */}
      <Dialog
        open={removeDialogOpen}
        // Prevent closing on backdrop click to avoid accidental data loss on mobile
        onClose={(_event: object, reason: string) => {
          if (reason === 'backdropClick') return;
          setRemoveDialogOpen(false);
        }}
        aria-labelledby="remove-member-dialog-title"
      >
        <DialogTitle id="remove-member-dialog-title">{t('family.removeMemberDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {/* Use email-interpolated message when available, fallback for members without email */}
            {memberToRemove?.user_email
              ? t('family.removeMemberConfirm', { email: memberToRemove.user_email })
              : t('family.removeMemberConfirmFallback')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialogOpen(false)} disabled={isRemoveLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmRemove}
            color="error"
            variant="contained"
            disabled={isRemoveLoading}
          >
            {isRemoveLoading ? t('family.removing') : t('common.remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
