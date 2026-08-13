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
  const iconImg = (
    <img
      src="/logo.png"
      alt="Epsync Logo"
      width={size}
      height={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        flexShrink: 0,
        filter: 'drop-shadow(0 2px 8px rgba(124, 92, 255, 0.45))',
        display: 'block'
      }}
      onError={(e) => {
        // Fallback to inline SVG if image is loading or unavailable
        (e.currentTarget as HTMLElement).style.display = 'none';
      }}
    />
  );

  if (variant === 'icon') {
    return (
      <div className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        {iconImg}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.max(6, Math.round(size * 0.25))}px`,
        userSelect: 'none',
        ...style
      }}
    >
      {iconImg}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: `${Math.round(size * 0.72)}px`,
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
