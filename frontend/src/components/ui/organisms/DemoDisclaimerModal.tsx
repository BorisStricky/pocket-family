// First-visit acknowledgement modal for the public demo. Blocks app
// interaction until the visitor explicitly accepts the demo terms; the
// acknowledgement timestamp is stored in localStorage so returning visitors
// are not re-prompted.

import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { DEMO_ACK_STORAGE_KEY, IS_DEMO_MODE, ROUTES } from '@/lib/constants';

export default function DemoDisclaimerModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!IS_DEMO_MODE) return;
    // Check after mount so SSR-style prerenders don't flash the dialog.
    const acknowledged = window.localStorage.getItem(DEMO_ACK_STORAGE_KEY);
    if (!acknowledged) {
      setOpen(true);
    }
  }, []);

  if (!IS_DEMO_MODE) {
    return null;
  }

  const handleAcknowledge = () => {
    window.localStorage.setItem(DEMO_ACK_STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  return (
    <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="sm">
      <DialogTitle>Welcome to the Pocket Family demo</DialogTitle>
      <DialogContent dividers>
        <List dense>
          <ListItem>
            <ListItemText
              primary="This is a public demo."
              secondary="It is provided AS-IS with no warranty. The operator accepts no liability for any use, loss, or interruption."
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Do not enter real personal or financial data."
              secondary="Names, account numbers, dates of birth, or any other PII are NOT to be entered. Use only fictional, demo data."
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Everything you enter is visible to other demo users."
              secondary="The demo is a single shared account. Any data you create can be seen, edited, or deleted by other visitors."
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="All data is deleted daily."
              secondary="The demo tenant is reset every 24 hours. Do not store anything you want to keep."
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Full terms are on the Legal page."
              secondary={
                <>
                  See{' '}
                  <MuiLink component={RouterLink} to={ROUTES.LEGAL}>
                    /legal
                  </MuiLink>{' '}
                  for the complete disclaimer. Clicking continue is your
                  acknowledgement of these terms.
                </>
              }
            />
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleAcknowledge}>
          I understand — continue to demo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
