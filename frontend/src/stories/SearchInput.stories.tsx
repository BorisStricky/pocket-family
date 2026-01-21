import React, { useState } from 'react';
import SearchInput from '../components/molecules/SearchInput';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

const theme = createTheme();

export default {
  title: 'Molecules/SearchInput',
  component: SearchInput,
  decorators: [
    (Story: any) => (
      <ThemeProvider theme={theme}>
        <div style={{ padding: 20, maxWidth: 600 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} as any;

// Empty state
export const EmptyState = () => {
  const [value, setValue] = useState('');

  return (
    <SearchInput
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        console.log('Search value:', newValue);
      }}
      placeholder="Search transactions..."
    />
  );
};

// With search text
export const WithSearchText = () => {
  const [value, setValue] = useState('groceries');

  return (
    <SearchInput
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        console.log('Search value:', newValue);
      }}
      placeholder="Search transactions..."
    />
  );
};

// Full width variant
export const FullWidth = () => {
  const [value, setValue] = useState('');

  return (
    <SearchInput
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        console.log('Search value:', newValue);
      }}
      placeholder="Search across all transactions..."
      fullWidth
    />
  );
};

// Disabled state
export const DisabledState = () => {
  const [value, setValue] = useState('Cannot edit this');

  return (
    <SearchInput
      value={value}
      onChange={setValue}
      placeholder="Search..."
      disabled
    />
  );
};

// With custom placeholder
export const CustomPlaceholder = () => {
  const [value, setValue] = useState('');

  return (
    <SearchInput
      value={value}
      onChange={setValue}
      placeholder="Find expenses by description, category, or amount..."
    />
  );
};

// With onClear callback
export const WithClearCallback = () => {
  const [value, setValue] = useState('test query');

  const handleClear = () => {
    console.log('Clear button clicked!');
  };

  return (
    <SearchInput
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        console.log('Search value:', newValue);
      }}
      onClear={handleClear}
      placeholder="Search with clear callback..."
    />
  );
};

// Multiple search inputs in a layout
export const MultipleInputs = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search transactions..."
        fullWidth
      />
      <SearchInput
        value={accountSearch}
        onChange={setAccountSearch}
        placeholder="Search accounts..."
        fullWidth
      />
      <SearchInput
        value={categorySearch}
        onChange={setCategorySearch}
        placeholder="Search categories..."
        fullWidth
      />
    </Box>
  );
};

// Interactive demo
export const InteractiveDemo = () => {
  const [value, setValue] = useState('');

  // Simulate search results
  const mockTransactions = [
    { id: 1, description: 'Grocery shopping at Whole Foods', amount: 125.50 },
    { id: 2, description: 'Gas station', amount: 45.00 },
    { id: 3, description: 'Restaurant dinner', amount: 78.25 },
    { id: 4, description: 'Online grocery delivery', amount: 95.00 },
  ];

  const filteredTransactions = mockTransactions.filter((transaction) =>
    transaction.description.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <Box>
      <SearchInput
        value={value}
        onChange={setValue}
        placeholder="Search transactions..."
        fullWidth
      />
      <Box sx={{ mt: 2 }}>
        {value && (
          <Box sx={{ mb: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
            Found {filteredTransactions.length} results
          </Box>
        )}
        {filteredTransactions.map((transaction) => (
          <Box
            key={transaction.id}
            sx={{
              p: 1.5,
              mb: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Box sx={{ fontWeight: 500 }}>{transaction.description}</Box>
            <Box sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              ${transaction.amount.toFixed(2)}
            </Box>
          </Box>
        ))}
        {value && filteredTransactions.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            No transactions found
          </Box>
        )}
      </Box>
    </Box>
  );
};
