import React from 'react';
import MuiAvatar from '@mui/material/Avatar';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 40 }) => {
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
    : undefined;

  return <MuiAvatar src={src ?? undefined} sx={{ width: size, height: size }}>{!src ? initials : null}</MuiAvatar>;
};

export default Avatar;
