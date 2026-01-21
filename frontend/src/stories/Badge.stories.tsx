import React from 'react';
import Badge from '../components/atoms/Badge';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Atoms/Badge',
  component: Badge,
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

const Template = (args: any) => <Badge {...args} />;

// Number badges (counts)
export const NumberDefault = Template.bind({});
(NumberDefault as any).args = { label: 5 };

export const NumberPrimary = Template.bind({});
(NumberPrimary as any).args = { label: 12, variant: 'primary' };

export const NumberSecondary = Template.bind({});
(NumberSecondary as any).args = { label: 3, variant: 'secondary' };

export const NumberSuccess = Template.bind({});
(NumberSuccess as any).args = { label: 42, variant: 'success' };

export const NumberWarning = Template.bind({});
(NumberWarning as any).args = { label: 7, variant: 'warning' };

export const NumberError = Template.bind({});
(NumberError as any).args = { label: 99, variant: 'error' };

// Text badges (status labels)
export const TextNew = Template.bind({});
(TextNew as any).args = { label: 'NEW', variant: 'success', size: 'small' };

export const TextPending = Template.bind({});
(TextPending as any).args = { label: 'PENDING', variant: 'warning', size: 'small' };

export const TextActive = Template.bind({});
(TextActive as any).args = { label: 'ACTIVE', variant: 'primary', size: 'small' };

export const TextError = Template.bind({});
(TextError as any).args = { label: 'ERROR', variant: 'error', size: 'small' };

// Size variations
export const SmallSize = Template.bind({});
(SmallSize as any).args = { label: 5, variant: 'primary', size: 'small' };

export const MediumSize = Template.bind({});
(MediumSize as any).args = { label: 5, variant: 'primary', size: 'medium' };

// Multiple badges example
export const MultipleBadges = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <Badge label={5} variant="default" />
    <Badge label={12} variant="primary" />
    <Badge label={3} variant="secondary" />
    <Badge label="NEW" variant="success" size="small" />
    <Badge label="ERROR" variant="error" size="small" />
  </div>
);
