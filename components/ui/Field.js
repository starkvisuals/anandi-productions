'use client';
// components/ui/Field.js — the label/helper/error wrapper shared by Input,
// Select, Textarea. One place for the label-above / helper-below / error-inline
// pattern so every form field looks and behaves the same.

import { useId } from 'react';
import { useTheme, SPACE, WEIGHT } from '@/lib/theme';

/**
 * <Field label helper error required>{children => <input id={children.id} …/>}</Field>
 *
 * children is a render prop that receives { id, describedBy } so the actual
 * input control can wire up label htmlFor / aria-describedby correctly.
 */
export default function Field({
  label,
  helper,
  error,
  required = false,
  disabled = false,
  htmlFor,           // optional override for a stable id
  hideLabel = false, // for icon-only inputs — keeps label for a11y but visually hidden
  children,
}) {
  const { t } = useTheme();
  const genId = useId();
  const id = htmlFor || `f-${genId}`;
  const helperId = helper || error ? `${id}-help` : undefined;

  const labelColor = disabled ? t.textDisabled : t.textSecondary;
  const helperColor = error ? t.danger : t.textMuted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE['1'], width: '100%' }}>
      {label && (
        <label
          htmlFor={id}
          style={
            hideLabel
              ? {
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0,0,0,0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }
              : {
                  fontSize: 11,
                  fontWeight: WEIGHT.medium,
                  color: labelColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  userSelect: 'none',
                }
          }
        >
          {label}
          {required && <span aria-hidden="true" style={{ color: t.danger, marginLeft: 4 }}>*</span>}
        </label>
      )}

      {typeof children === 'function' ? children({ id, describedBy: helperId }) : children}

      {(helper || error) && (
        <div
          id={helperId}
          role={error ? 'alert' : undefined}
          aria-live={error ? 'polite' : undefined}
          style={{
            fontSize: 11,
            color: helperColor,
            lineHeight: 1.4,
          }}
        >
          {error || helper}
        </div>
      )}
    </div>
  );
}
