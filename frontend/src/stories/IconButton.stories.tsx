import React from 'react';
import IconButton from '../components/atoms/IconButton';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/IconButton',
  component: IconButton,
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

const Template = (args: any) => <IconButton {...args} />;

export const Default = Template.bind({});
(Default as any).args = { icon: 'Search', title: 'Search' };

export const Small = Template.bind({});
(Small as any).args = { icon: 'X', title: 'Close', size: 'small' };
