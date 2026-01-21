import React from 'react';
import { FormControl, InputLabel, Select as MuiSelect, MenuItem, SelectProps as MuiSelectProps } from '@mui/material';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends Omit<MuiSelectProps, 'onChange' | 'value'> {
  label?: string;
  value?: string | number;
  options: SelectOption[];
  onChange?: (value: string | number) => void;
}

export const Select: React.FC<SelectProps> = ({ label, options, value, onChange, ...rest }) => {
  return (
    <FormControl fullWidth>
      {label && <InputLabel id={`select-${label}`}>{label}</InputLabel>}
      <MuiSelect
        labelId={label ? `select-${label}` : undefined}
        value={value ?? ''}
        label={label}
        onChange={(e) => onChange?.(e.target.value as string | number)}
        {...rest}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </MuiSelect>
    </FormControl>
  );
};

export default Select;
