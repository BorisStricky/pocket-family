// src/features/imports/components/steps/UploadStep.tsx
// Step 0 of the CSV import wizard: file selection and upload.
// After upload the user sees a column preview and a sample of rows
// before advancing to the mapping step.

import React, { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useUploadCsv } from '../../hooks/useUploadCsv';
import type { ImportUploadResponse } from '../../types';

interface UploadStepProps {
  onUploaded: (result: ImportUploadResponse) => void;
}

/**
 * UploadStep — let the user pick a CSV file and upload it.
 *
 * On success the component calls onUploaded with the file_key and detected
 * columns so the parent wizard can advance to the mapping step.
 */
export function UploadStep({ onUploaded }: UploadStepProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportUploadResponse | null>(null);

  const { mutate: uploadFile, isPending, error } = useUploadCsv();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    // Reset preview when a new file is picked so the user doesn't see stale data
    setPreview(null);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadFile(selectedFile, {
      onSuccess: (result) => {
        setPreview(result);
        onUploaded(result);
      },
    });
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        {t('imports.uploadIntro')}
      </Typography>

      {/* File selector — clicking the styled dropzone opens the hidden file input */}
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          mt: 2,
          mb: 3,
          textAlign: 'center',
          borderStyle: 'dashed',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" gutterBottom>
          {/* Show the chosen file name once selected; otherwise show the invite prompt */}
          {selectedFile ? selectedFile.name : t('imports.uploadDropzonePrompt')}
        </Typography>
        {selectedFile && (
          <Typography variant="caption" color="text.secondary">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </Typography>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : t('imports.uploadErrorFallback')}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleUpload}
        disabled={!selectedFile || isPending}
        startIcon={isPending ? <CircularProgress size={16} /> : undefined}
      >
        {isPending ? t('imports.uploadButtonUploading') : t('imports.uploadButtonUpload')}
      </Button>

      {/* Column and sample data preview shown after a successful upload.
          Column headers in the table are the user's own CSV column names —
          these are user data and must NOT be translated. */}
      {preview && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('imports.uploadPreviewTitle', { count: preview.row_count })}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('imports.uploadDetectedColumns')} {preview.detected_columns.join(', ')}
          </Typography>

          {preview.sample_rows.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1, maxHeight: 220 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {preview.detected_columns.map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 600 }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.sample_rows.map((sampleRow, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {preview.detected_columns.map((column) => (
                        <TableCell key={column}>{sampleRow[column] ?? ''}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
}
