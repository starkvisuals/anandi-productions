'use client';
// components/ui/Button.js — the ONE Button.
//
// Design intent:
//   - Primary is confident + editorial (solid black on light, near-white on dark)
//   - Accent (brand yellow) is used for FOCUS RING, not button fill (WCAG contrast)
//   - Danger is red — obvious. Ghost/secondary for subordinate actions.
//   - Press feedback is a subtle scale (0.97) + opacity — feels tactile, no jitter
//   - Loading state disables + shows a spinner; button width doesn't jump
//   - Icon slot on either side; icon-only buttons enforce aria-label
//
// Props:
//   variant     : 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
//   size        : 'sm' | 'md' | 'lg'
//   loading     : boolean — disables + spinner
//   disabled    : boolean
//   iconLeft    : ReactNode (SVG/Icon)
//   iconRight   : ReactNode
//   fullWidth   : boolean
//   type        : 'button' (default) | 'submit' | 'reset'
//   ariaLabel   : REQUIRED when button has no children (icon-only)
//   children    : ReactNode
//   ...rest     : passed to the underlying <button>

import { forwardRef, useState } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT, TOUCH_MIN } from '@/lib/theme';
import { MOTION, useReducedMotion } from '@/lib/motion';

const SIZE_CONFIG = {
  sm: { height: 32, padX: 12, fontSize: 12, iconSize: 14, gap: 6 },
  md: { height: 40, padX: 16, fontSize: 14, iconSize: 16, gap: 8 },
  lg: { height: 48, padX: 20, fontSize: 15, iconSize: 18, gap: 10 },
};

function variantStyles(t, variant) {
  switch (variant) {
    case 'secondary':
      return {
        background: 'transparent',
        color: t.text,
        border: `1px solid ${t.borderStrong}`,
        hoverBg: t.surfaceHover,
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: t.text,
        border: '1px solid transparent',
        hoverBg: t.surfaceHover,
      };
    case 'danger':
      return {
        background: t.danger,
        color: t.onDanger,
        border: `1px solid ${t.danger}`,
        hoverBg: t.danger,
      };
    case 'accent':
      // Accent uses brand yellow — reserved for "call attention" moments
      return {
        background: t.accent,
        color: t.onAccent,
        border: `1px solid ${t.accent}`,
        hoverBg: t.accent,
      };
    case 'primary':
    default:
      return {
        background: t.primary,
        color: t.onPrimary,
        border: `1px solid ${t.primary}`,
        hoverBg: t.primary,
      };
  }
}

const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  type = 'button',
  ariaLabel,
  children,
  onClick,
  style,
  ...rest
}, ref) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);

  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const v = variantStyles(t, variant);
  const isDisabled = disabled || loading;
  const iconOnly = !children && (iconLeft || iconRight);

  if (iconOnly && !ariaLabel && !rest['aria-label']) {
    console.warn('Button: icon-only buttons must have an ariaLabel prop.');
  }

  const height = Math.max(cfg.height, size === 'md' ? cfg.height : cfg.height);
  const minTouch = TOUCH_MIN; // ensure 44×44 tap zone via padding trick if needed

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={ariaLabel || rest['aria-label']}
      aria-busy={loading || undefined}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={isDisabled ? undefined : onClick}
      style={{
        // Layout
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: cfg.gap,
        width: fullWidth ? '100%' : undefined,
        height,
        minHeight: minTouch, // touch target — outer hitbox, padding balances centering
        padding: `0 ${cfg.padX}px`,
        // Typography
        fontFamily: 'inherit',
        fontSize: cfg.fontSize,
        fontWeight: WEIGHT.semibold,
        lineHeight: 1,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        // Surface
        background: v.background,
        color: v.color,
        border: v.border,
        borderRadius: RADIUS.md,
        boxShadow: variant === 'primary' || variant === 'danger' ? t.shadowSm : 'none',
        // Interaction
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transform: !reduced && pressed && !isDisabled ? MOTION.press.scale : 'scale(1)',
        transition: reduced ? 'none' : MOTION.transition.press,
        userSelect: 'none',
        // Reset browser defaults
        appearance: 'none',
        WebkitAppearance: 'none',
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <Spinner size={cfg.iconSize} color={v.color} />
      ) : (
        <>
          {iconLeft && (
            <span style={{ display: 'inline-flex', width: cfg.iconSize, height: cfg.iconSize, flexShrink: 0 }}>
              {iconLeft}
            </span>
          )}
          {children}
          {iconRight && (
            <span style={{ display: 'inline-flex', width: cfg.iconSize, height: cfg.iconSize, flexShrink: 0 }}>
              {iconRight}
            </span>
          )}
        </>
      )}
    </button>
  );
});

// Small inline spinner — a real Spinner component lands in Chunk 1.2.
function Spinner({ size, color }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        width: size,
        height: size,
        // Individual border properties (not shorthand) to avoid React's
        // "mixing shorthand + non-shorthand" rerender warning.
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: color,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'ap-btn-spin 0.7s linear infinite',
      }}
    >
      <style>{`
        @keyframes ap-btn-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}

export default Button;
