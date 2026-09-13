import React from 'react';

interface VelyxoraLogoProps {
  variant?: 'full' | 'isotype' | 'monochrome' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
}

export const VelyxoraLogo: React.FC<VelyxoraLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showTagline = false
}) => {
  // Dimensions
  const iconSizes = {
    sm: 22,
    md: 28,
    lg: 36,
    xl: 48
  };

  const currentIconSize = iconSizes[size];

  // The Abstract "V" Isotype:
  // Left path (Input trajectory): descends with an angular entry arrow head
  // Center node: Transformation nexus
  // Right path (Output trajectory): ascends with an upward velocity arrow
  // Dynamic gradient accents: Electric Indigo (#6366F1) -> Neon Violet (#8B5CF6) -> Electric Sky (#38BDF8)
  const isMonochrome = variant === 'monochrome';

  const IsotypeSVG = (
    <svg
      width={currentIconSize}
      height={currentIconSize}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200"
      aria-label="VELYXORA Icon"
    >
      <defs>
        <linearGradient id="vx-primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isMonochrome ? '#FFFFFF' : '#818CF8'} />
          <stop offset="60%" stopColor={isMonochrome ? '#FFFFFF' : '#6366F1'} />
          <stop offset="100%" stopColor={isMonochrome ? '#D4D4D8' : '#4F46E5'} />
        </linearGradient>
        <linearGradient id="vx-output-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isMonochrome ? '#E4E4E7' : '#38BDF8'} />
          <stop offset="100%" stopColor={isMonochrome ? '#FFFFFF' : '#A855F7'} />
        </linearGradient>
      </defs>

      {/* Input vector: upper-left to bottom apex */}
      <path
        d="M6 7 L17.5 32 C18.2 33.5 20.2 33.7 21.2 32.3 L25.5 25 L16.8 14.5 L22 8 L6 7 Z"
        fill="url(#vx-primary-grad)"
      />

      {/* Transformation nexus & output vector: bottom-center to top-right exit */}
      <path
        d="M34 8 L22 28.5 L17.8 23.2 L24.6 13.5 L19.2 13.5 L24 7 L34 8 Z"
        fill="url(#vx-output-grad)"
      />

      {/* Center transformation data quantum */}
      <circle
        cx="20"
        cy="20"
        r="2.2"
        fill={isMonochrome ? '#FFFFFF' : '#38BDF8'}
      />
    </svg>
  );

  if (variant === 'isotype') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {IsotypeSVG}
      </div>
    );
  }

  const textSizes = {
    sm: 'text-base font-bold tracking-tight',
    md: 'text-lg font-bold tracking-wider',
    lg: 'text-xl font-black tracking-wider',
    xl: 'text-2xl font-black tracking-widest'
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {IsotypeSVG}
      <div className="flex flex-col">
        <div className="flex items-center">
          <span className={`${textSizes[size]} text-white font-sans uppercase`}>
            VELY<span className="text-indigo-400">X</span>ORA
          </span>
          <span className="ml-1.5 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase tracking-widest bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded">
            Toolkit
          </span>
        </div>
        {showTagline && (
          <span className="text-[10px] font-medium text-slate-400 tracking-wider">
            Convert • Process • Download
          </span>
        )}
      </div>
    </div>
  );
};
