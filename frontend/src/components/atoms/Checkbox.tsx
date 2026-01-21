import React from 'react';
import MuiCheckbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

export interface CheckboxProps {
  checked: boolean;
  label?: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, label, onChange, disabled }) => {
  return (
    <FormControlLabel
      control={<MuiCheckbox checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />}
      label={label}
    />
  );
};

export default Checkbox;
