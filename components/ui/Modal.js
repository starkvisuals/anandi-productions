'use client';
// components/ui/Modal.js — the ONE modal.
//
// Replaces 13 ad-hoc fixed-position modals with one wrapper that gets:
//   - z-index from lib/z (no more 1000/1100/1200/2100/2200 chaos)
//   - focus trap + return-focus-to-trigger on close
//   - Esc to close, click-scrim to close (both optional)
//   - scrim 60%, scale-in animation (respects reduced motion)
//   - body scroll lock while open
//   - sizes sm/md/lg/xl, optional header with title + close button
//
// Usage:
//   <Modal open={open} onClose={close} title="Add Employee" size="lg">
//     …body…
//     <Modal.Footer>
//       <Button variant="ghost" onClick={close}>Cancel</Button>
//       <Button onClick={save}>Save</Button>
//     </Modal.Footer>
//   </Modal>

import { useEffect, useRef, useCallback } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';
import Z from '@/lib/z';
import { MOTION, useReducedMotion } from '@/lib/motion';

const SIZE_MAX = { sm: 420, md: 560, lg: 720, xl: 960, full: '96vw' };

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnScrim = true,
  closeOnEsc = true,
  showClose = true,
  fixedHeight,          // e.g. '85vh' — for tabbed modals so they don't resize
  children,
  ...rest
}) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  // Capture the element that had focus before opening, restore on close.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      // Move focus into the dialog
      requestAnimationFrame(() => {
        const first = dialogRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        (first || dialogRef.current)?.focus?.();
      });
      // Lock body scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
        triggerRef.current?.focus?.();
      };
    }
  }, [open]);

  // Esc + focus trap
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEsc) {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }, [closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (closeOnScrim && e.target === e.currentTarget) onClose?.(); }}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.modal,
        background: t.scrim,
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACE['4'],
        animation: reduced ? 'none' : `ap-modal-scrim ${MOTION.duration.md}ms ${MOTION.easing.out}`,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: SIZE_MAX[size] || SIZE_MAX.md,
          maxHeight: '92vh',
          height: fixedHeight,
          background: t.surface,
          color: t.text,
          border: `1px solid ${t.border}`,
          borderRadius: RADIUS.xl,
          boxShadow: t.shadowLg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          animation: reduced ? 'none' : `ap-modal-in ${MOTION.duration.md}ms ${MOTION.easing.out}`,
          ...rest.style,
        }}
      >
        {(title || showClose) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: SPACE['3'], padding: `${SPACE['4']} ${SPACE['5']}`,
            borderBottom: `1px solid ${t.border}`, flexShrink: 0,
          }}>
            <div style={{ minWidth: 0 }}>
              {title && <h2 style={{ margin: 0, fontSize: 16, fontWeight: WEIGHT.bold, letterSpacing: '-0.01em' }}>{title}</h2>}
              {description && <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{description}</p>}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: RADIUS.md,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: t.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: SPACE['5'] }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes ap-modal-scrim { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ap-modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

// Sticky footer for action buttons — sits at the bottom of the modal body.
Modal.Footer = function ModalFooter({ children, align = 'right' }) {
  const { t } = useTheme();
  return (
    <div style={{
      display: 'flex',
      justifyContent: align === 'right' ? 'flex-end' : align === 'between' ? 'space-between' : 'flex-start',
      alignItems: 'center',
      gap: SPACE['2'],
      marginTop: SPACE['5'],
      paddingTop: SPACE['4'],
      borderTop: `1px solid ${t.border}`,
    }}>
      {children}
    </div>
  );
};
