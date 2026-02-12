// src/components/ui/organisms/OverviewCard.tsx
// Reusable KPI card that displays a metric with optional trend delta and icon.
// Used on the Dashboard to show total expenses, income, and net balance at a glance.

import React from 'react';
import { Card, CardContent, Typography, Box, SvgIconProps } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';

/**
 * Props for OverviewCard component.
 * - title: label above the metric (e.g. "Total Expenses")
 * - value: formatted metric string (e.g. "$1,234.56")
 * - delta: optional percentage change from previous period
 * - icon: optional MUI icon component to display alongside the metric
 * - color: optional theme color for the card accent
 */
export interface OverviewCardProps {
  title: string;
  value: string;
  delta?: number | null;
  icon?: React.ComponentType<SvgIconProps>;
  color?: 'success' | 'error' | 'warning' | 'info' | 'primary';
}

/**
 * OverviewCard - displays a single KPI metric in a card layout.
 *
 * Shows:
 * - Title label (e.g. "Total Income")
 * - Formatted value (e.g. "$5,000.00")
 * - Optional delta with trend arrow (green up / red down / neutral flat)
 * - Optional icon on the right side for visual distinction
 */
export default function OverviewCard({ title, value, delta, icon: IconComponent, color = 'primary' }: OverviewCardProps) {
  // Determine trend direction for delta indicator
  const trendDirection = delta === undefined || delta === null
    ? 'neutral'
    : delta > 0
      ? 'up'
      : delta < 0
        ? 'down'
        : 'neutral';

  const trendColor = trendDirection === 'up'
    ? 'success.main'
    : trendDirection === 'down'
      ? 'error.main'
      : 'text.secondary';

  const TrendIcon = trendDirection === 'up'
    ? TrendingUp
    : trendDirection === 'down'
      ? TrendingDown
      : TrendingFlat;

  return (
    <Card
      sx={{
        height: '100%',
        borderTop: 3,
        borderColor: `${color}.main`,
      }}
      data-testid="overview-card"
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            {/* Metric label */}
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>

            {/* Metric value */}
            <Typography variant="h5" component="div" fontWeight="bold">
              {value}
            </Typography>

            {/* Delta indicator - only shown when delta is provided */}
            {delta !== undefined && delta !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendIcon sx={{ fontSize: 18, color: trendColor, mr: 0.5 }} />
                <Typography variant="body2" sx={{ color: trendColor }}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                </Typography>
              </Box>
            )}
          </Box>

          {/* Optional icon on the right side */}
          {IconComponent && (
            <Box
              sx={{
                bgcolor: `${color}.light`,
                borderRadius: 2,
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconComponent sx={{ fontSize: 32, color: `${color}.main` }} />
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
