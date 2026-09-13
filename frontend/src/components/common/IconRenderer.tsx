import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, className = '', size = 18 }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Wrench;
  return <IconComponent className={className} size={size} />;
};
