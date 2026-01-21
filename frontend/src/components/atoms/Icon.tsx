import React from 'react';
import type { LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';

export type IconName = keyof typeof Icons;

export interface IconProps extends React.HTMLAttributes<SVGElement> {
  name: IconName;
  size?: number;
  title?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 16, title, ...rest }) => {
  const IconComponent = (Icons as any)[name] as React.ComponentType<any>;
  if (!IconComponent) return null;
  return <IconComponent size={size} aria-hidden={title ? undefined : true} aria-label={title} {...rest} />;
};

export default Icon;
