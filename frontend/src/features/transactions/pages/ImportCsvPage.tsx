// src/features/transactions/pages/ImportCsvPage.tsx
// Entry point for the CSV import wizard at /app/:familyId/import-csv.
// Viewers are redirected immediately — they have no write access to import data.

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImportWizard } from '@/features/imports/components/ImportWizard';
import { useCurrentRole } from '@/features/family/hooks/useCurrentRole';

export function ImportCsvPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const currentRole = useCurrentRole();

  useEffect(() => {
    if (currentRole === 'viewer') {
      navigate(`/app/${familyId}/transactions`, { replace: true });
    }
  }, [currentRole, familyId, navigate]);

  return <ImportWizard />;
}
