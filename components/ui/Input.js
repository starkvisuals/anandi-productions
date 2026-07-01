'use client';
// components/ui/Input.js — text-like inputs with the shared Field wrapper.
//
// Usage:
//   <Input label="Email" type="email" value={x} onChange={e => setX(e.target.value)} />
//   <Input label="Amount" required error="Must be a number" />
//   <Input hideLabel label="Search" iconLeft={<SearchIcon />} placeholder="Search…" />

import { forwardRef, useState } from 'react';
import Field from './Field';
import { useTheme, RADIUS, SPACE } from '@/lib/theme';
import { MOTION, useReducedMotion } from '@/lib/motion';

const Input = forwardRef(function Input({
  // Field props
  label,
  helper,
  error,
  required,
  hideLabel,
  // Input specifics
  type = 'text',
  iconLeft,
  iconRight,
  disabled = false,
  fullWidth = true,
  size: sizeProp = 'md',
  style,
  wrapperStyle,
  ...rest
}, ref) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);

  const height = sizeProp === 'sm' ? 32 : sizeProp === 'lg' ? 48 : 40;
  const iconSize = sizeProp === 'sm' ? 14 : sizeProp === 'lg' ? 18 : 16;
  const padY = 0;
  const padXBase = 12;
  const padLeft = iconLeft ? padXBase * 2 + iconSize : padXBase;
  const padRight = iconRight ? padXBase * 2 + iconSize : padXBase;

  return (
    <Field label={label} helper={helper} error={error} required={required} disabled={disabled} hideLabel={hideLabel}>
      {({ id, describedBy }) => (
        <div style={{ position: 'relative', width: fullWidth ? '100%' : undefined, ...wrapperStyle }}>
          {iconLeft && (
            <span aria-hidden="true" style={{
              position: 'absolute', left: padXBase, top: '50%', transform: 'translateY(-50%)',
              width: iconSize, height: iconSize, color: t.textMuted, pointerEvents: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{iconLeft}</span>
          )}
          <input
            ref={ref}
            id={id}
            type={type}
            disabled={disabled}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            style={{
              width: '100%',
              height,
              padding: `${padY}px ${padRight}px ${padY}px ${padLeft}px`,
              background: disabled ? t.surface : t.surfaceElev,
              color: disabled ? t.textDisabled : t.text,
              border: `1px solid ${error ? t.danger : (focused ? t.ring : t.border)}`,
              borderRadius: RADIUS.md,
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1,
              outline: 'none', // FocusRing is drawn via border + boxShadow below
              boxShadow: focused && !error ? `0 0 0 2px ${t.ring}44` : 'none',
              transition: reduced ? 'none' : MOTION.transition.fast,
              appearance: 'none',
              WebkitAppearance: 'none',
              ...style,
            }}
            {...rest}
          />
          {iconRight && (
            <span aria-hidden="true" style={{
              position: 'absolute', right: padXBase, top: '50%', transform: 'translateY(-50%)',
              width: iconSize, height: iconSize, color: t.textMuted, pointerEvents: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{iconRight}</span>
          )}
        </div>
      )}
    </Field>
  );
});

export default Input;
