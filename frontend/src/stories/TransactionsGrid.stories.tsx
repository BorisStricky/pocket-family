import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import TransactionsGrid from '../components/organisms/TransactionsGrid';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Transaction } from '../components/molecules/TransactionListItem';

const theme = createTheme();

const makeMock = (n = 200) => {
  return Array.from({ length: n }).map((_, i) => {
    const income = i % 10 === 0;
    const tx: Transaction = {
      id: `tx-${i + 1}`,
      tenant_id: `tenant-${Math.ceil((i+1)/50)}`,
      account_id: `acc-${(i % 3) + 1}`,
      account: income ? 'Cash' : `Account #${(i % 2) + 1}`,
      category_id: income ? `cat-salary` : `cat-${(i%3)+1}`,
      category: income ? 'Salary' : ['Groceries', 'Transport', 'Shopping'][i % 3],
      transaction_date: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
      transaction_type: income ? 'income' : 'expense',
      amount: income ? 250000 : (Math.floor(Math.random() * 20000) + 1200),
      currency: 'BRL',
      created_by: 'Boris',
      description: income ? 'Salary deposit' : `Purchase ${i + 1}`,
      reconciled: i % 7 === 0,
      source: i % 13 === 0 ? 'recurring' : 'manual',
    };
    return tx;
  });
};

export default {
  title: 'Organisms/TransactionsGrid',
  component: TransactionsGrid,
  decorators: [(Story: any) => <ThemeProvider theme={theme}><div style={{padding:20}}><Story /></div></ThemeProvider>],
} as ComponentMeta<typeof TransactionsGrid>;

const Template: ComponentStory<typeof TransactionsGrid> = (args: any) => <TransactionsGrid {...args} />;

export const Default = Template.bind({});
Default.args = {
  data: makeMock(200),
  pageSize: 15,
  height: 520,
};
