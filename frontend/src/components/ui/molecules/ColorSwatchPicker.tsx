// ColorSwatchPicker.tsx
// A row of predefined color swatches for assigning a visual identity to categories,
// accounts, and budgets. No external library — just styled MUI Box elements.

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

// 16 distinct colors aligned with the chart palette used across the app.
// These match or extend the CHART_COLORS in reports/utils.ts for visual consistency.
export const SWATCH_COLORS: string[] = [
  '#F44336', // Red
  '#FF5722', // Deep Orange
  '#FF9800', // Orange
  '#FFC107', // Amber
  '#4CAF50', // Green
  '#009688', // Teal
  '#2196F3', // Blue
  '#3F51B5', // Indigo
  '#9C27B0', // Purple
  '#E91E63', // Pink
  '#607D8B', // Blue Grey
  '#795548', // Brown
  '#00BCD4', // Cyan
  '#8BC34A', // Light Green
  '#CDDC39', // Lime
  '#9E9E9E', // Grey
];

interface ColorSwatchPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
}

export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ value, onChange, disabled = false }) => {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        Color
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {/* "None" option — a swatch with a diagonal strikethrough to indicate no color */}
        <Tooltip title="No color">
          <Box
            component="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: value === null ? 'primary.main' : 'divider',
              background: 'linear-gradient(to bottom right, #fff 45%, #bbb 45%, #bbb 55%, #fff 55%)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: 0,
              outline: 'none',
              flexShrink: 0,
              transition: 'transform 0.1s',
              '&:hover': { transform: disabled ? 'none' : 'scale(1.15)' },
            }}
          />
        </Tooltip>

        {SWATCH_COLORS.map((swatchColor) => (
          <Tooltip key={swatchColor} title={swatchColor}>
            <Box
              component="button"
              disabled={disabled}
              onClick={() => onChange(swatchColor)}
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: value === swatchColor ? 'primary.main' : 'transparent',
                backgroundColor: swatchColor,
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: 0,
                outline: 'none',
                flexShrink: 0,
                boxShadow: value === swatchColor ? `0 0 0 1px ${swatchColor}` : 'none',
                transition: 'transform 0.1s',
                '&:hover': { transform: disabled ? 'none' : 'scale(1.15)' },
              }}
            />
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};

export default ColorSwatchPicker;
