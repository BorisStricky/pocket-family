import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import TransactionsList from '../components/organisms/TransactionsList';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Transaction } from '../components/molecules/TransactionListItem';

const theme = createTheme();

const mock: Transaction[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `tx-${i + 1}`,
  tenant_id: `tenant-1`,
  account_id: `acc-${(i%2)+1}`,
  account: i % 3 === 0 ? 'Cash' : 'Bank account',
  transaction_date: new Date(Date.now() - i * 86400000).toISOString(),
  amount: i % 3 === 0 ? 250000 : (i + 1) * 1234,
  currency: 'BRL',
  created_by: 'Boris',
  category_id: i % 3 === 0 ? 'cat-salary' : `cat-${i+1}`,
  category: i % 3 === 0 ? 'Salary' : 'Groceries',
  transaction_type: i % 3 === 0 ? 'income' : 'expense',
  description: i % 3 === 0 ? 'Salário' : `Compra #${i + 1}`,
  reconciled: i % 4 === 0,
  source: i % 5 === 0 ? 'recurring' : 'manual',
}));

export default {
  title: 'Organisms/TransactionsList',
  component: TransactionsList,
  decorators: [(Story: any) => <ThemeProvider theme={theme}><div style={{padding:20, maxWidth:900}}><Story /></div></ThemeProvider>],
} as ComponentMeta<typeof TransactionsList>;

const Template: ComponentStory<typeof TransactionsList> = (args: any) => <TransactionsList {...args} />;

export const Default = Template.bind({});
Default.args = { data: mock, page: 1, totalPages: 3, loading: false };

export const Loading = Template.bind({});
Loading.args = { loading: true };

export const Empty = Template.bind({});
Empty.args = { data: [], loading: false };
