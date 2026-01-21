import React, { useState } from 'react';
import DeleteConfirmDialog from '../components/molecules/DeleteConfirmDialog';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Button, Box } from '@mui/material';

const theme = createTheme();

export default {
  title: 'Molecules/DeleteConfirmDialog',
  component: DeleteConfirmDialog,
  decorators: [
    (Story: any) => (
      <ThemeProvider theme={theme}>
        <div style={{ padding: 20 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} as any;

// Default state
export const DefaultState = () => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    console.log('Delete confirmed!');
    setOpen(false);
  };

  const handleCancel = () => {
    console.log('Delete cancelled');
    setOpen(false);
  };

  return (
    <Box>
      <Button variant="contained" color="error" onClick={() => setOpen(true)}>
        Delete Transaction
      </Button>
      <DeleteConfirmDialog
        open={open}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

// Custom labels
export const CustomLabels = () => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    console.log('Remove confirmed!');
    setOpen(false);
  };

  const handleCancel = () => {
    console.log('Keep it');
    setOpen(false);
  };

  return (
    <Box>
      <Button variant="contained" color="error" onClick={() => setOpen(true)}>
        Remove Item
      </Button>
      <DeleteConfirmDialog
        open={open}
        title="Remove Account"
        message="This will permanently remove the account and all associated transactions."
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

// Loading state
export const LoadingState = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = () => {
    console.log('Starting delete...');
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log('Delete completed!');
      setLoading(false);
      setOpen(false);
    }, 2000);
  };

  const handleCancel = () => {
    console.log('Delete cancelled');
    setOpen(false);
  };

  return (
    <Box>
      <Button variant="contained" color="error" onClick={() => setOpen(true)}>
        Delete with Loading
      </Button>
      <DeleteConfirmDialog
        open={open}
        title="Delete Category"
        message="This will delete the category and reassign all transactions to 'Uncategorized'."
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        loading={loading}
      />
    </Box>
  );
};

// Long message text
export const LongMessage = () => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    console.log('Delete confirmed!');
    setOpen(false);
  };

  const handleCancel = () => {
    console.log('Delete cancelled');
    setOpen(false);
  };

  const longMessage = `
    You are about to permanently delete this family account. This action will:

    • Remove all family members from the account
    • Delete all transactions and financial records
    • Remove all budget categories and goals
    • Cancel any recurring transactions
    • Permanently erase all data with no possibility of recovery

    This action cannot be undone. Please make sure you have exported any data you need before proceeding.
  `;

  return (
    <Box>
      <Button variant="contained" color="error" onClick={() => setOpen(true)}>
        Delete Family Account
      </Button>
      <DeleteConfirmDialog
        open={open}
        title="Delete Family Account"
        message={longMessage}
        confirmLabel="Delete Permanently"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

// Always open (for design reference)
export const AlwaysOpen = () => {
  const handleConfirm = () => {
    console.log('Delete confirmed!');
  };

  const handleCancel = () => {
    console.log('Delete cancelled');
  };

  return (
    <DeleteConfirmDialog
      open={true}
      title="Delete Transaction"
      message="Are you sure you want to delete this transaction? This action cannot be undone."
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
};

// Always open with loading (for design reference)
export const AlwaysOpenLoading = () => {
  const handleConfirm = () => {
    console.log('Delete confirmed!');
  };

  const handleCancel = () => {
    console.log('Delete cancelled');
  };

  return (
    <DeleteConfirmDialog
      open={true}
      title="Delete Transaction"
      message="Are you sure you want to delete this transaction? This action cannot be undone."
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      loading={true}
    />
  );
};

// Multiple delete scenarios
export const MultipleScenarios = () => {
  const [openTransaction, setOpenTransaction] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);

  return (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', maxWidth: 400 }}>
      <Button
        variant="contained"
        color="error"
        onClick={() => setOpenTransaction(true)}
      >
        Delete Transaction
      </Button>
      <Button
        variant="contained"
        color="error"
        onClick={() => setOpenAccount(true)}
      >
        Delete Account
      </Button>
      <Button
        variant="contained"
        color="error"
        onClick={() => setOpenCategory(true)}
      >
        Delete Category
      </Button>

      <DeleteConfirmDialog
        open={openTransaction}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction?"
        onConfirm={() => setOpenTransaction(false)}
        onCancel={() => setOpenTransaction(false)}
      />

      <DeleteConfirmDialog
        open={openAccount}
        title="Delete Account"
        message="This will permanently remove the account and all its transactions."
        onConfirm={() => setOpenAccount(false)}
        onCancel={() => setOpenAccount(false)}
      />

      <DeleteConfirmDialog
        open={openCategory}
        title="Delete Category"
        message="All transactions in this category will be moved to 'Uncategorized'."
        onConfirm={() => setOpenCategory(false)}
        onCancel={() => setOpenCategory(false)}
      />
    </Box>
  );
};
