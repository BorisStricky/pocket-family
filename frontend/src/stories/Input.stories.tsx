import React from 'react';
import { Input } from '../components/atoms/Input';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Input',
  component: Input,
  decorators: [
    (Story: any) => (
      <ThemeProvider theme={theme}>
        <div style={{ padding: 20, maxWidth: 420 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} as any;

const Template = (args: any) => <Input {...args} />;

export const Default = Template.bind({});
(Default as any).args = { label: 'Name', placeholder: 'Enter name' };
