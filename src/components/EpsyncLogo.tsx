import React from 'react';

interface EpsyncLogoProps {
  size?: number;
  variant?: 'full' | 'icon';
  className?: string;
  style?: React.CSSProperties;
}

export const EpsyncLogo: React.FC<EpsyncLogoProps> = ({
  size = 28,
  variant = 'full',
  className,
  style
}) => {
  const iconWidth = size;
  const iconHeight = size;

  const iconSvg = (
    <svg
      width={iconWidth}
      height={iconHeight}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="epsync-grad-primary" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#FF7A59" />
        </linearGradient>
        <linearGradient id="epsync-grad-accent" x1="12" y1="8" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F5F5F7" />
        </linearGradient>
      </defs>

      {/* Rounded squircle container with soft border & gradient glow */}
      <rect width="40" height="40" rx="10" fill="url(#epsync-grad-primary)" />
      
      {/* Sleek inner stylized 'E' + Sync Play curves */}
      {/* Top bar with curved sync arrow motif */}
      <path
        d="M12 13C12 11.8954 12.8954 11 14 11H27C27.5523 11 28 11.4477 28 12C28 12.5523 27.5523 13 27 13H15V17.5H23.5C24.0523 17.5 24.5 17.9477 24.5 18.5C24.5 19.0523 24.0523 19.5 23.5 19.5H15V27H27C27.5523 27 28 27.4477 28 28C28 28.5523 27.5523 29 27 29H14C12.8954 29 12 28.1046 12 27V13Z"
        fill="url(#epsync-grad-accent)"
      />

      {/* Play/Sync indicator accent */}
      <path
        d="M23 22.5L28.5 20L23 17.5V22.5Z"
        fill="#FFD278"
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={className} style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
        {iconSvg}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        userSelect: 'none',
        ...style
      }}
    >
      {iconSvg}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: `${Math.round(size * 0.65)}px`,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          lineHeight: 1
        }}
      >
        Epsync
      </span>
    </div>
  );
};
