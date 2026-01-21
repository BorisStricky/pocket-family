import React from 'react';
import TextField, { TextFieldProps } from '@mui/material/TextField';

export type InputProps = TextFieldProps & {
  label?: string;
  hint?: string;
};

export const Input: React.FC<InputProps> = ({ label, hint, ...rest }) => {
  return <TextField label={label} helperText={hint} fullWidth {...rest} />;
};

export default Input;
