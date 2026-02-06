// src/hooks/useDebounce.ts
// Custom hook to debounce rapidly changing values (e.g., search input)

import { useEffect, useState } from 'react';

/**
 * Debounces a value by delaying updates until the value stops changing
 * for a specified delay period. Useful for preventing excessive API calls
 * during user input.
 *
 * The hook works by setting up a timer whenever the input value changes.
 * If the value changes again before the timer expires, the old timer is
 * cleared and a new one is set. Only when the timer expires without
 * interruption does the debounced value get updated.
 *
 * @param value - The value to debounce (can be string, number, or any type)
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns The debounced value that only updates after delay period of inactivity
 *
 * @example
 * // Debounce search query to reduce API calls
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedSearchQuery = useDebounce(searchQuery, 500);
 *
 * // searchQuery updates immediately on every keystroke (for UI responsiveness)
 * // debouncedSearchQuery updates 500ms after user stops typing (for API calls)
 *
 * useEffect(() => {
 *   // This only runs when debouncedSearchQuery changes (not on every keystroke)
 *   fetchSearchResults(debouncedSearchQuery);
 * }, [debouncedSearchQuery]);
 *
 * @example
 * // Debounce date filter changes
 * const [startDate, setStartDate] = useState<string | null>(null);
 * const debouncedStartDate = useDebounce(startDate, 500);
 *
 * // Use debouncedStartDate in query key instead of startDate
 * const { data } = useQuery({
 *   queryKey: ['transactions', familyId, { start_date: debouncedStartDate }],
 *   queryFn: () => fetchTransactions(familyId, { start_date: debouncedStartDate })
 * });
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  // Store the debounced value in state
  // Initially set to the input value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up timer to update debounced value after delay
    // This timer will update debouncedValue to match the current value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function runs when:
    // 1. Value changes (before next effect runs) - clears old timer
    // 2. Component unmounts - prevents memory leaks
    // This prevents setting stale debounced values
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Re-run effect when value or delay changes

  return debouncedValue;
}
