import React from 'react';
import { Box } from '@mui/material';

/**
 * Badge component for displaying counts, status indicators, or notifications
 *
 * A small, compact element for showing numerical values or short text labels.
 * Used for counts, status indicators, and inline notifications.
 *
 * @example
 * <Badge label={5} variant="primary" />
 * <Badge label="NEW" variant="success" size="small" />
 */
export interface BadgeProps {
  /** The content to display in the badge (number or text) */
  label: string | number;
  /** Color variant for the badge */
  variant?: 'default' | 'primary' | 'secondary' | 'error' | 'success' | 'warning';
  /** Size of the badge */
  size?: 'small' | 'medium';
}

// Color mapping for badge variants
const variantColors = {
  default: {
    backgroundColor: '#e0e0e0',
    color: '#424242',
  },
  primary: {
    backgroundColor: '#1976d2',
    color: '#ffffff',
  },
  secondary: {
    backgroundColor: '#9c27b0',
    color: '#ffffff',
  },
  error: {
    backgroundColor: '#d32f2f',
    color: '#ffffff',
  },
  success: {
    backgroundColor: '#2e7d32',
    color: '#ffffff',
  },
  warning: {
    backgroundColor: '#ed6c02',
    color: '#ffffff',
  },
};

// Size mapping for badge dimensions
const sizeStyles = {
  small: {
    fontSize: '0.625rem', // 10px
    padding: '2px 6px',
    minWidth: '18px',
    height: '18px',
  },
  medium: {
    fontSize: '0.75rem', // 12px
    padding: '4px 8px',
    minWidth: '24px',
    height: '24px',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'medium',
}) => {
  // Get color and size styles based on props
  const colorStyle = variantColors[variant];
  const dimensionStyle = sizeStyles[size];

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        fontWeight: 600,
        lineHeight: 1,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...colorStyle,
        ...dimensionStyle,
      }}
    >
      {label}
    </Box>
  );
};

export default Badge;
