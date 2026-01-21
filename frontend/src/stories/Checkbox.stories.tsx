import React, { useState } from 'react';
import Checkbox from '../components/atoms/Checkbox';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Checkbox',
  component: Checkbox,
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
  const [checked, setChecked] = useState(false);
  return <Checkbox {...args} checked={checked} onChange={(v: boolean) => setChecked(v)} />;
};

export const Default = Template.bind({});
(Default as any).args = { label: 'Remember me', disabled: false };
