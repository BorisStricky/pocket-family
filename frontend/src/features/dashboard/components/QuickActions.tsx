// src/features/dashboard/components/QuickActions.tsx
// Grid of quick action buttons on the dashboard for common tasks.
// Each button navigates to the relevant page within the current family context.

import React from 'react';
import { Card, CardContent, Typography, Button, Stack } from '@mui/material';
import { Add, Assessment, Upload } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * QuickActions - provides shortcut buttons for common user actions.
 *
 * Available actions:
 * - Add Transaction: navigates to the new transaction form
 * - View Reports: navigates to the reports page
 * - Import CSV: placeholder for future CSV import feature
 */
export default function QuickActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { familyId } = useParams<{ familyId: string }>();

  const actions = [
    {
      label: t('dashboard.addTransaction'),
      icon: <Add />,
      // Navigate to TransactionsPage with state flag to auto-open the add modal.
      // This avoids a nonexistent /transactions/new route and reuses the existing
      // AddTransactionModal that TransactionsPage already manages.
      onClick: () => navigate(`/app/${familyId}/transactions`, { state: { openAddModal: true } }),
      color: 'primary' as const,
    },
    {
      label: t('dashboard.viewReports'),
      icon: <Assessment />,
      onClick: () => navigate(`/app/${familyId}/reports`),
      color: 'secondary' as const,
    },
    {
      label: t('dashboard.importCsv'),
      icon: <Upload />,
      onClick: () => navigate(`/app/${familyId}/import-csv`),
      color: 'info' as const,
    },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('dashboard.quickActions')}
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outlined"
              color={action.color}
              startIcon={action.icon}
              onClick={action.onClick}
              sx={{ textTransform: 'none' }}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
