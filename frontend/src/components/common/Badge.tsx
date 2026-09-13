import React from 'react';
import { Lock, Cloud, Sparkles, Layers, Zap } from 'lucide-react';
import { ProcessingMode } from '../../types';

interface BadgeProps {
  mode?: ProcessingMode;
  variant?: 'local' | 'server' | 'hybrid' | 'batch' | 'fast' | 'neutral';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const CapabilityBadge: React.FC<BadgeProps> = ({
  mode,
  variant,
  label,
  size = 'sm',
  className = ''
}) => {
  const resolvedVariant = variant || (mode === 'CLIENT_SIDE' ? 'local' : mode === 'SERVER_SIDE' ? 'server' : mode === 'HYBRID' ? 'hybrid' : 'neutral');

  const configs = {
    local: {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <Lock className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />,
      defaultLabel: 'LOCAL'
    },
    server: {
      bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      icon: <Cloud className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />,
      defaultLabel: 'SERVER'
    },
    hybrid: {
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      icon: <Sparkles className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />,
      defaultLabel: 'HYBRID'
    },
    batch: {
      bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: <Layers className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />,
      defaultLabel: 'BATCH'
    },
    fast: {
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: <Zap className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />,
      defaultLabel: 'FAST'
    },
    neutral: {
      bg: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
      icon: null,
      defaultLabel: 'TOOL'
    }
  };

  const config = configs[resolvedVariant];
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium uppercase tracking-wider rounded-md border ${config.bg} ${padding} ${className}`}
    >
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </span>
  );
};
