import React, { useState } from 'react';
import Modal from '../components/atoms/Modal';
import Button from '../components/atoms/Button';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Modal',
  component: Modal,
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

const Template = (args: any) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="contained" onClick={() => setOpen(true)}>Open modal</Button>
      <Modal {...args} open={open} onClose={() => setOpen(false)}>
        <div style={{ minWidth: 320 }}>
          <p>This is sample modal content.</p>
        </div>
      </Modal>
    </div>
  );
};

export const Default = Template.bind({});
(Default as any).args = { title: 'Example modal' };
