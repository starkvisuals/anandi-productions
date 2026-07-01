'use client';
// components/ui/Textarea.js — multiline text input with the shared Field wrapper.
//
// Usage:
//   <Textarea label="Reason" helper="Optional" rows={3} value={r} onChange={e=>setR(e.target.value)} />

import { forwardRef, useState } from 'react';
import Field from './Field';
import { useTheme, RADIUS } from '@/lib/theme';
import { MOTION, useReducedMotion } from '@/lib/motion';

const Textarea = forwardRef(function Textarea({
  label,
  helper,
  error,
  required,
  hideLabel,
  disabled = false,
  fullWidth = true,
  rows = 3,
  resize = 'vertical',
  style,
  ...rest
}, ref) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);

  return (
    <Field label={label} helper={helper} error={error} required={required} disabled={disabled} hideLabel={hideLabel}>
      {({ id, describedBy }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={{
            width: fullWidth ? '100%' : undefined,
            minHeight: 40 + (rows - 1) * 20,
            padding: '10px 12px',
            background: disabled ? t.surface : t.surfaceElev,
            color: disabled ? t.textDisabled : t.text,
            border: `1px solid ${error ? t.danger : (focused ? t.ring : t.border)}`,
            borderRadius: RADIUS.md,
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.5,
            outline: 'none',
            boxShadow: focused && !error ? `0 0 0 2px ${t.ring}44` : 'none',
            transition: reduced ? 'none' : MOTION.transition.fast,
            appearance: 'none',
            WebkitAppearance: 'none',
            resize,
            ...style,
          }}
          {...rest}
        />
      )}
    </Field>
  );
});

export default Textarea;
