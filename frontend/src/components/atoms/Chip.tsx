import React from 'react';
import MuiChip, { ChipProps as MuiChipProps } from '@mui/material/Chip';

export interface ChipProps extends MuiChipProps {
  label: string;
  colorHex?: string;
}

export const Chip: React.FC<ChipProps> = ({ label, colorHex, ...rest }) => {
  const sx = colorHex ? { backgroundColor: colorHex, color: '#fff' } : undefined;
  return <MuiChip label={label} sx={sx} {...rest} />;
};

export default Chip;
