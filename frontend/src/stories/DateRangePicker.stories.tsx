import React, { useState } from 'react';
import DateRangePicker from '../components/molecules/DateRangePicker';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export default {
  title: 'Molecules/DateRangePicker',
  component: DateRangePicker,
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

// Empty state - no dates selected
export const EmptyState = () => {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const handleChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    console.log('Date range changed:', { start, end });
  };

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      label="Select Date Range"
    />
  );
};

// With selected dates
export const WithSelectedDates = () => {
  const [startDate, setStartDate] = useState<string | null>('2024-01-01');
  const [endDate, setEndDate] = useState<string | null>('2024-01-31');

  const handleChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    console.log('Date range changed:', { start, end });
  };

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      label="Transaction Date Range"
    />
  );
};

// With min/max constraints
export const WithConstraints = () => {
  const [startDate, setStartDate] = useState<string | null>('2024-06-01');
  const [endDate, setEndDate] = useState<string | null>('2024-06-15');

  const handleChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    console.log('Date range changed:', { start, end });
  };

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      minDate="2024-01-01"
      maxDate="2024-12-31"
      label="2024 Date Range Only"
    />
  );
};

// Custom label
export const CustomLabel = () => {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const handleChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    console.log('Date range changed:', { start, end });
  };

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      label="Filter Expenses by Date"
    />
  );
};

// No label
export const NoLabel = () => {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const handleChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    console.log('Date range changed:', { start, end });
  };

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
    />
  );
};

// Current month preset
export const CurrentMonth = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState<string | null>(formatDate(firstDay));
  const [endDate, setEndDate] = useState<string | null>(formatDate(lastDay));

  const handleChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    console.log('Date range changed:', { start, end });
  };

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      label="Current Month"
    />
  );
};
