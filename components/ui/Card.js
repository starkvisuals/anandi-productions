'use client';
// components/ui/Card.js — the ONE Card.
//
// Surface with a 1px border and radius-12. No shadow at rest (editorial /
// calm). Optional hover elevation for interactive cards.
//
// Usage:
//   <Card>Content</Card>
//   <Card padding="lg" interactive onClick={openThing}>Click me</Card>
//   <Card as="section" style={{marginTop: 16}}>…</Card>

import { forwardRef, useState } from 'react';
import { useTheme, RADIUS, SPACE } from '@/lib/theme';
import { MOTION, useReducedMotion } from '@/lib/motion';

const PAD = { none: 0, sm: SPACE['3'], md: SPACE['4'], lg: SPACE['6'], xl: SPACE['8'] };

const Card = forwardRef(function Card({
  padding = 'md',
  interactive = false,
  elevated = false,       // adds shadow at rest
  bordered = true,        // set false for surfaces that don't need a hairline
  onClick,
  as: Component = 'div',
  style,
  children,
  ...rest
}, ref) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);

  const clickable = interactive || typeof onClick === 'function';

  return (
    <Component
      ref={ref}
      onClick={onClick}
      onMouseEnter={clickable ? () => setHover(true) : undefined}
      onMouseLeave={clickable ? () => setHover(false) : undefined}
      role={clickable && Component === 'div' ? 'button' : undefined}
      tabIndex={clickable && Component === 'div' ? 0 : undefined}
      onKeyDown={
        clickable && Component === 'div'
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.(e);
              }
            }
          : undefined
      }
      style={{
        background: t.surface,
        color: t.text,
        border: bordered ? `1px solid ${t.border}` : '1px solid transparent',
        borderRadius: RADIUS.lg,
        padding: PAD[padding] || PAD.md,
        boxShadow: elevated ? t.shadowMd : (hover && clickable ? t.shadowSm : 'none'),
        cursor: clickable ? 'pointer' : undefined,
        transition: reduced ? 'none' : MOTION.transition.fast,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default Card;
