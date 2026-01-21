import React from 'react';
import Chip from '../components/atoms/Chip';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Chip',
  component: Chip,
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

const Template = (args: any) => <Chip {...args} />;

export const Category = Template.bind({});
(Category as any).args = { label: 'Groceries' };

export const Colored = Template.bind({});
(Colored as any).args = { label: 'Salary', colorHex: '#2b8aef' };
