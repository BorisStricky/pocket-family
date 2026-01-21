import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import Select from '../atoms/Select';
import IconButton from '../atoms/IconButton';
import Chip from '../atoms/Chip';
import Icon from '../atoms/Icon';

export interface TransactionsFilterBarProps {
  onSearch?: (q: string) => void;
  onCategoryChange?: (value: string | number) => void;
  onClear?: () => void;
  categories?: { label: string; value: string }[];
}

const defaultCategories = [
  { label: 'All', value: '' },
  { label: 'Groceries', value: 'groceries' },
  { label: 'Rent', value: 'rent' },
  { label: 'Salary', value: 'salary' },
];

export const TransactionsFilterBar: React.FC<TransactionsFilterBarProps> = ({
  onSearch,
  onCategoryChange,
  onClear,
  categories = defaultCategories,
}) => {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<string | number>('');

  return (
    <Box sx={{ width: '100%', py: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions"
            label="Search"
            InputProps={{
              endAdornment: (
                <IconButton icon="Search" title="Search" onClick={() => onSearch?.(query)} />
              ),
            }}
          />
        </Box>

        <Box sx={{ width: 220 }}>
          <Select
            label="Category"
            value={category}
            options={categories}
            onChange={(v) => {
              setCategory(v);
              onCategoryChange?.(v);
            }}
          />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" onClick={() => { setQuery(''); setCategory(''); onClear?.(); }}>
            Clear
          </Button>

          <Button variant="contained" onClick={() => onSearch?.(query)}>
            Apply
          </Button>

          <IconButton icon="Filter" title="Advanced filters" />
        </Stack>
      </Stack>

      {/* quick chips below */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label="Last 7 days" />
        <Chip label="This month" />
        <Chip label="Last month" />
        <Chip label="Recurring" />
      </Box>
    </Box>
  );
};

export default TransactionsFilterBar;
