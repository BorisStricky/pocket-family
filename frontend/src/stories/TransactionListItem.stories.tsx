import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import TransactionListItem from '../components/molecules/TransactionListItem';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import List from '@mui/material/List';
import { Transaction } from '../components/molecules/TransactionListItem';

const theme = createTheme();

export default {
  title: 'Molecules/TransactionListItem',
  component: TransactionListItem,
  decorators: [(Story) => <ThemeProvider theme={theme}><div style={{padding:20, maxWidth:800}}><Story /></div></ThemeProvider>],
} as ComponentMeta<typeof TransactionListItem>;

const base: Transaction = {
  id: 'tx-1',
  tenant_id: 'tenant-1',
  account_id: 'acc-1',
  account: 'Cash',
  description: 'Mercado Central - cartão',
  transaction_date: new Date().toISOString(),
  amount: 12345,
  currency: 'BRL',
  avatarUrl: null,
  category_id: 'cat-1',
  category: 'Groceries',
  transaction_type: 'expense',
  reconciled: false,
  source: 'manual',
};

const Template: ComponentStory<typeof TransactionListItem> = (args) => (
  <List>
    <TransactionListItem {...args} />
  </List>
);

export const Default = Template.bind({});
Default.args = { tx: base };

export const Compact = Template.bind({});
Compact.args = { tx: { ...base, id: 'tx-2', description: 'Salário', amount: 500000, transaction_type: 'income' }, compact: true, showCategory: false };
