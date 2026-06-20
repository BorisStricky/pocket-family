// src/features/family/pages/AcceptInvitePage.tsx
// Placeholder page for accepting family invitations
// Full implementation requires a backend endpoint for token validation

import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  Stack,
} from '@mui/material';
import { Mail, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

/**
 * AcceptInvitePage - Placeholder for invite acceptance flow
 *
 * This page is shown when a user clicks an invitation link.
 * Currently displays a placeholder message since the backend
 * endpoint for validating invitation tokens is not yet implemented.
 *
 * URL pattern: /accept-invite?token=xxx
 *
 * Future implementation will:
 * 1. Validate the invite token via POST /auth/accept-invite?token=xxx
 * 2. Create a user account if the email doesn't exist
 * 3. Update the membership status from PENDING to ACTIVE
 * 4. Return an access token and redirect to the family
 *
 * Route: /accept-invite (public, no auth required)
 */
export function AcceptInvitePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');

  return (
    <Container maxWidth="sm" sx={{ paddingY: 8 }}>
      <Paper sx={{ padding: 4, textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          {/* Icon */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'primary.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={32} />
          </Box>

          {/* Title */}
          <Typography variant="h4" component="h1">
            {t('auth.inviteTitle')}
          </Typography>

          {/* Placeholder message */}
          <Alert severity="info" sx={{ textAlign: 'left' }}>
            <Typography variant="body2">
              {t('auth.inviteComingSoon')}
            </Typography>
          </Alert>

          {/* Show token for debugging (development only) */}
          {inviteToken && (
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('auth.inviteTokenDebug')}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  wordBreak: 'break-all',
                  display: 'block',
                  padding: 1,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                }}
              >
                {inviteToken}
              </Typography>
            </Box>
          )}

          {!inviteToken && (
            <Alert severity="warning" sx={{ textAlign: 'left' }}>
              <Typography variant="body2">
                {t('auth.inviteNoToken')}
              </Typography>
            </Alert>
          )}

          {/* Navigation back to login */}
          <Button
            component={Link}
            to={ROUTES.LOGIN}
            variant="outlined"
            startIcon={<ArrowLeft size={18} />}
          >
            {t('auth.backToLogin')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export default AcceptInvitePage;
