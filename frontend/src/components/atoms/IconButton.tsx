import React from 'react';
import MuiIconButton, { IconButtonProps as MuiIconButtonProps } from '@mui/material/IconButton';
import Icon from './Icon';

export interface AppIconButtonProps extends MuiIconButtonProps {
  icon: string;
  title?: string;
}

export const IconButton: React.FC<AppIconButtonProps> = ({ icon, title, ...rest }) => {
  return (
    <MuiIconButton {...rest} aria-label={title}>
      <Icon name={icon as any} title={title} />
    </MuiIconButton>
  );
};

export default IconButton;
