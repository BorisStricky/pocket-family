import React from 'react';
import Avatar from '../components/atoms/Avatar';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Avatar',
  component: Avatar,
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

const Template = (args: any) => <Avatar {...args} />;

export const WithInitials = Template.bind({});
(WithInitials as any).args = { name: 'Boris Silva', size: 48 };
