import React from 'react';
import MuiTypography, { TypographyProps as MuiTypographyProps } from '@mui/material/Typography';

export type Variant = 'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'caption';

export interface TypographyProps extends Omit<MuiTypographyProps, 'variant'> {
  variant?: Variant;
  children: React.ReactNode;
}

const variantMap: Record<Variant, MuiTypographyProps['variant']> = {
  h1: 'h3',
  h2: 'h4',
  h3: 'h5',
  subtitle: 'subtitle1',
  body: 'body1',
  caption: 'caption',
};

export const Typography: React.FC<TypographyProps> = ({ variant = 'body', children, ...rest }) => {
  return (
    <MuiTypography variant={variantMap[variant]} {...rest}>
      {children}
    </MuiTypography>
  );
};

export default Typography;
