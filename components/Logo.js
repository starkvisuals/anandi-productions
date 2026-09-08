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

  // The REAL Anandi Productions mark (AP monogram + yellow play triangle),
  // exported from the brand kit. White version on dark surfaces, black on light.
  // The yellow accent is baked into the artwork. Tightly cropped (~1.9:1).
  const iconSrc = isDark ? '/brand/ap-icon-white.png' : '/brand/ap-icon-black.png';
  const LogoMark = () => (
    <img
      src={iconSrc}
      alt="Anandi Productions"
      style={{ height: size, width: 'auto', display: 'block', ...animationStyles }}
    />
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
