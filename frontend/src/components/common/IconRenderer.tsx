import React from 'react';
import { resolveIcon } from './iconMap';

interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, className = '', size = 18 }) => {
  const IconComponent = resolveIcon(name);
  return <IconComponent className={className} size={size} />;
};
