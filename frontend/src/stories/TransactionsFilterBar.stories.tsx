import React from 'react';
import TransactionsFilterBar from '../components/molecules/TransactionsFilterBar';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Molecules/TransactionsFilterBar',
  component: TransactionsFilterBar,
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
  return (
    <TransactionsFilterBar
      {...args}
      onSearch={(q: string) => console.log('search', q)}
      onCategoryChange={(c: any) => console.log('category', c)}
      onClear={() => console.log('clear')}
    />
  );
};

export const Default = Template.bind({});
(Default as any).args = {};
