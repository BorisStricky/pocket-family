// src/features/family/components/CreateFamilyModal.tsx
// Modal dialog for creating a new family/tenant
// Used in FamiliesPage to allow users to start a new family

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
} from '@mui/material';

/**
 * Props for CreateFamilyModal component
 */
interface CreateFamilyModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called with the family name when the form is submitted */
  onCreate: (name: string) => void;
  /** Whether the creation request is in progress */
  isLoading?: boolean;
  /** Error message to display if creation failed */
  error?: string;
}

/**
 * CreateFamilyModal - A dialog for creating a new family
 *
 * Provides a simple form with a single "Family Name" text field.
 * Validates that the name is at least 2 characters long.
 * On successful submission, the parent component typically switches
 * to the newly created family context.
 */
export function CreateFamilyModal({
  open,
  onClose,
  onCreate,
  isLoading = false,
  error,
}: CreateFamilyModalProps) {
  const [familyName, setFamilyName] = useState('');
  const [validationError, setValidationError] = useState('');

  // Validate family name meets minimum length requirement
  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setValidationError('Family name is required');
      return false;
    }
    if (name.trim().length < 2) {
      setValidationError('Family name must be at least 2 characters');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSubmit = () => {
    if (validateName(familyName)) {
      onCreate(familyName.trim());
    }
  };

  // Reset form state when modal closes
  const handleClose = () => {
    setFamilyName('');
    setValidationError('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="create-family-dialog-title"
    >
      <DialogTitle id="create-family-dialog-title">Create New Family</DialogTitle>
      <DialogContent>
        {/* Show API error if creation failed */}
        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Family Name"
          fullWidth
          value={familyName}
          onChange={(event) => {
            setFamilyName(event.target.value);
            // Clear validation error on edit to provide immediate feedback
            if (validationError) {
              validateName(event.target.value);
            }
          }}
          error={!!validationError}
          helperText={validationError || 'Choose a name for your family or household'}
          disabled={isLoading}
          onKeyDown={(event) => {
            // Allow submitting with Enter key for convenience
            if (event.key === 'Enter' && !isLoading) {
              handleSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !familyName.trim()}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? 'Creating...' : 'Create Family'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
