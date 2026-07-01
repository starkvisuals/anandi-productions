'use client';
// components/ui/Select.js — native <select> wrapped in the shared Field pattern.
//
// Native was the right call at Anandi's scale: it inherits system keyboard
// support, mobile picker UX, and screen-reader semantics for free. A custom
// dropdown lands later only if a real design need forces it.
//
// Usage:
//   <Select label="Department" value={dept} onChange={setDept}>
//     <option value="">Select…</option>
//     <option value="hr">HR</option>
//   </Select>

import { forwardRef, useState } from 'react';
import Field from './Field';
import { useTheme, RADIUS } from '@/lib/theme';
import { MOTION, useReducedMotion } from '@/lib/motion';

const Select = forwardRef(function Select({
  label,
  helper,
  error,
  required,
  hideLabel,
  disabled = false,
  fullWidth = true,
  size: sizeProp = 'md',
  value,
  onChange,
  children,
  style,
  ...rest
}, ref) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);

  const height = sizeProp === 'sm' ? 32 : sizeProp === 'lg' ? 48 : 40;
  const padX = 12;

  // Simple chevron indicator — pure CSS, no icon dep
  const chevron = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='${encodeURIComponent(t.textMuted)}'><path d='M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z'/></svg>")`;

  // onChange contract: we forward the raw event so callers can access
  // event.target.value — same shape as native <select>.
  const handleChange = (e) => {
    if (typeof onChange === 'function') onChange(e);
  };

  return (
    <Field label={label} helper={helper} error={error} required={required} disabled={disabled} hideLabel={hideLabel}>
      {({ id, describedBy }) => (
        <select
          ref={ref}
          id={id}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={{
            width: fullWidth ? '100%' : undefined,
            height,
            padding: `0 ${padX + 20}px 0 ${padX}px`, // extra right pad for chevron
            background: `${disabled ? t.surface : t.surfaceElev} ${chevron} no-repeat right ${padX}px center / 16px`,
            color: disabled ? t.textDisabled : t.text,
            border: `1px solid ${error ? t.danger : (focused ? t.ring : t.border)}`,
            borderRadius: RADIUS.md,
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1,
            outline: 'none',
            boxShadow: focused && !error ? `0 0 0 2px ${t.ring}44` : 'none',
            transition: reduced ? 'none' : MOTION.transition.fast,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            ...style,
          }}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
});

export default Select;
