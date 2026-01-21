import React from 'react';
import { Select } from '../components/atoms/Select';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();
export default {
  title: 'Atoms/Select',
  component: Select,
  decorators: [
    (Story: any) => (
      <ThemeProvider theme={theme}>
        <div style={{ padding: 20, maxWidth: 320 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} as any;

const Template = (args: any) => <Select {...args} />;

export const Default = Template.bind({});
(Default as any).args = {
  label: 'Category',
  value: '',
  options: [
    { label: 'Groceries', value: 'groceries' },
    { label: 'Rent', value: 'rent' },
  ],
};
