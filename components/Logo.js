'use client';

import { useState, useEffect, useId } from 'react';

/**
 * Anandi Productions logo.
 *
 *   <Logo />                       → mark + wordmark (default)
 *   <Logo variant="icon" />        → mark only (bold AP + yellow triangle)
 *   <Logo variant="wordmark" />    → wordmark only
 *   <Logo size={48} theme="dark" />
 *
 * Brand: solid black + brand yellow accent triangle (play / motion).
 * No gradients, no purple. Designed to be readable on light or dark surfaces.
 *
 * If a pixel-perfect SVG asset exists at /public/logo.svg, drop it there and
 * swap the LogoMark for an <Image src="/logo.svg" /> — this in-component
 * version is the system fallback.
 */
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
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [animated]);

  const isDark = theme === 'dark';
  const inkColor = isDark ? '#FAFAFA' : '#0A0A0A';
  const subColor = isDark ? 'rgba(250,250,250,0.55)' : 'rgba(10,10,10,0.55)';
  const brandYellow = '#FACC15';

  const animationStyles = animated
    ? {
        transition: 'transform 0.4s cubic-bezier(0.2,0,0,1), opacity 0.3s ease',
        transform: visible ? 'scale(1)' : 'scale(0.85)',
        opacity: visible ? 1 : 0,
      }
    : {};

  // Bold "AP" mark with a yellow play-triangle accent.
  // viewBox is generous to allow the triangle to extend right of the "P".
  const LogoMark = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Anandi Productions"
      role="img"
      style={animationStyles}
    >
      {/* A — solid black/white triangle silhouette */}
      <path
        d="M5 95 L35 5 L65 95 L52 95 L47 80 L23 80 L18 95 Z"
        fill={inkColor}
      />
      {/* A crossbar negative space already handled by closed path */}

      {/* P — stem */}
      <rect x="70" y="5" width="14" height="90" fill={inkColor} />
      {/* P — bowl as a clipped half-circle (a 'D' shape) */}
      <path
        d="M84 5 H92 a26 26 0 0 1 0 52 H84 Z"
        fill={inkColor}
      />

      {/* Yellow play-triangle accent — protrudes from the P's bowl */}
      <path
        d="M96 16 L116 31 L96 46 Z"
        fill={brandYellow}
      />
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
      <span
        style={{
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
          fontWeight: 800,
          fontSize: size * 0.45,
          color: inkColor,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        Anandi
      </span>
      <span
        style={{
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
          fontWeight: 400,
          fontSize: size * 0.22,
          color: subColor,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          marginTop: size * 0.08,
        }}
      >
        Productions
      </span>
    </div>
  );

  if (variant === 'icon') {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <LogoMark />
      </span>
    );
  }
  if (variant === 'wordmark') {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Wordmark />
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.22 }}
    >
      <LogoMark />
      <Wordmark />
    </span>
  );
}
