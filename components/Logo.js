'use client';

import { useState, useEffect, useId } from 'react';

export default function Logo({
  size = 40,
  variant = 'full',
  theme = 'dark',
  animated = false,
  className = '',
}) {
  const uniqueId = useId();
  const [visible, setVisible] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  const gradientId = `logo-grad-${uniqueId}`;
  const gradientIdText = `logo-grad-text-${uniqueId}`;

  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111111';
  const subtextColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  const animationStyles = animated
    ? {
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
        transform: visible ? 'scale(1)' : 'scale(0.7)',
        opacity: visible ? 1 : 0,
      }
    : {};

  const markSize = size;
  const fontSize = size * 0.4;
  const subFontSize = size * 0.22;

  // Film-frame inspired logo mark with sprocket notches and AP monogram
  const LogoMark = () => (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={animationStyles}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect x="8" y="8" width="84" height="84" rx="18" ry="18" fill={`url(#${gradientId})`} />

      {/* Film sprocket notches - top */}
      <rect x="24" y="4" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="46" y="4" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="68" y="4" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />

      {/* Film sprocket notches - bottom */}
      <rect x="24" y="88" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="46" y="88" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="68" y="88" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />

      {/* Film sprocket notches - left */}
      <rect x="4" y="24" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="4" y="46" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="4" y="68" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />

      {/* Film sprocket notches - right */}
      <rect x="88" y="24" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="88" y="46" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />
      <rect x="88" y="68" width="8" height="8" rx="2" fill={`url(#${gradientId})`} />

      {/* Inner frame border */}
      <rect
        x="16"
        y="16"
        width="68"
        height="68"
        rx="12"
        ry="12"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />

      {/* AP monogram */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="34"
        fill="white"
        letterSpacing="1"
      >
        AP
      </text>
    </svg>
  );

  const Wordmark = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        lineHeight: 1.1,
        ...animationStyles,
      }}
    >
      <svg width={size * 2.2} height={size * 0.75} viewBox="0 0 220 75" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradientIdText} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <text
          x="0"
          y="35"
          fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
          fontWeight="800"
          fontSize={fontSize}
          fill={`url(#${gradientIdText})`}
          letterSpacing="6"
        >
          ANANDI
        </text>
        <text
          x="1"
          y="58"
          fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
          fontWeight="400"
          fontSize={subFontSize}
          fill={subtextColor}
          letterSpacing="3"
        >
          Productions
        </text>
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <LogoMark />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <div className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Wordmark />
      </div>
    );
  }

  // variant === 'full'
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.25,
      }}
    >
      <LogoMark />
      <Wordmark />
    </div>
  );
}
