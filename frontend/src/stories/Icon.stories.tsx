import React from 'react';
import { Icon } from '../components/atoms/Icon';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Icon',
  component: Icon,
  decorators: [
    (Story: any) => (
      <ThemeProvider theme={theme}>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} as any;

const Template = (args: any) => <Icon {...args} />;

export const Sample = Template.bind({});
(Sample as any).args = { name: 'Activity', size: 24, title: 'activity' };
