import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enUS } from 'date-fns/locale';
import { Close as CloseIcon } from '@mui/icons-material';

/**
 * DateRangePicker component for selecting a date range
 *
 * Provides two date inputs (start and end) with validation to ensure
 * the end date is not before the start date. Used for filtering
 * transactions, reports, and other date-based data.
 *
 * @example
 * <DateRangePicker
 *   startDate="2024-01-01"
 *   endDate="2024-01-31"
 *   onChange={(start, end) => handleDateChange(start, end)}
 *   label="Filter by date"
 * />
 */
export interface DateRangePickerProps {
  /** Start date as ISO string (YYYY-MM-DD) or null */
  startDate: string | null;
  /** End date as ISO string (YYYY-MM-DD) or null */
  endDate: string | null;
  /** Callback when date range changes */
  onChange: (startDate: string | null, endDate: string | null) => void;
  /** Minimum selectable date (ISO string) */
  minDate?: string;
  /** Maximum selectable date (ISO string) */
  maxDate?: string;
  /** Optional label for the date range picker */
  label?: string;
}

/**
 * Convert ISO date string (YYYY-MM-DD) to local Date object without timezone shift
 *
 * ISO strings are parsed as UTC by default, so "2026-01-18" becomes UTC midnight
 * which may display as "2026-01-17" in local timezone (e.g., EST/PST). This function
 * creates a Date in local timezone to ensure the selected date matches what the user sees.
 */
const parseISODate = (isoString: string | null): Date | null => {
  if (!isoString) return null;

  // Parse date components and create Date in local timezone
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
};

/**
 * Convert Date object to ISO date string (YYYY-MM-DD) in local timezone
 *
 * Formats the Date using local timezone values to ensure the output
 * matches the date the user selected, avoiding UTC conversion issues.
 */
const formatToISODate = (date: Date | null): string | null => {
  if (!date) return null;

  // Format using local timezone values to avoid UTC conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // month is 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  label = 'Date Range',
}) => {
  // Convert ISO strings to Date objects for the date picker
  const startDateValue = parseISODate(startDate);
  const endDateValue = parseISODate(endDate);
  const minDateValue = parseISODate(minDate || null);
  const maxDateValue = parseISODate(maxDate || null);

  // Handle start date change
  const handleStartDateChange = (newStartDate: Date | null) => {
    const isoStartDate = formatToISODate(newStartDate);

    // If new start date is after current end date, clear end date
    if (newStartDate && endDateValue && newStartDate > endDateValue) {
      onChange(isoStartDate, null);
    } else {
      onChange(isoStartDate, endDate);
    }
  };

  // Handle end date change
  const handleEndDateChange = (newEndDate: Date | null) => {
    const isoEndDate = formatToISODate(newEndDate);

    // If new end date is before current start date, set start date to end date
    if (newEndDate && startDateValue && newEndDate < startDateValue) {
      onChange(isoEndDate, isoEndDate);
    } else {
      onChange(startDate, isoEndDate);
    }
  };

  // Clear both dates
  const handleClear = () => {
    onChange(null, null);
  };

  const hasValues = startDate || endDate;

  // Use English locale with dd-MMM-yyyy format for consistent app-wide date display
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enUS}>
      <Box>
        {/* Label with clear button */}
        {label && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              {label}
            </Typography>
            {hasValues && (
              <IconButton
                size="small"
                onClick={handleClear}
                sx={{ ml: 1 }}
                aria-label="Clear date range"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}

        {/* Date inputs */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Start Date - format prop ensures keyboard input follows dd-MMM-yyyy pattern */}
          <DatePicker
            label="Start Date"
            value={startDateValue}
            onChange={handleStartDateChange}
            minDate={minDateValue}
            maxDate={maxDateValue}
            format="dd-MMM-yyyy"
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
              },
            }}
          />

          {/* Separator */}
          <Typography variant="body2" color="text.secondary">
            to
          </Typography>

          {/* End Date - format prop ensures keyboard input follows dd-MMM-yyyy pattern */}
          <DatePicker
            label="End Date"
            value={endDateValue}
            onChange={handleEndDateChange}
            minDate={startDateValue || minDateValue} // End date cannot be before start date
            maxDate={maxDateValue}
            format="dd-MMM-yyyy"
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
              },
            }}
          />
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangePicker;
