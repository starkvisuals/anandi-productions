'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTheme } from '@/lib/theme';

/**
 * Branded, promise-based confirmation dialog — replaces the native, unbranded
 * window.confirm() for destructive actions.
 *
 *   const askConfirm = useConfirm();
 *   if (!(await askConfirm({ title: 'Delete project?', message: '…', danger: true }))) return;
 *
 * Resolves true on confirm, false on cancel / backdrop / Escape.
 */
const ConfirmContext = createContext(null);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const { t } = useTheme();
  const [state, setState] = useState(null);

  const askConfirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setState({
          title: opts.title || 'Are you sure?',
          message: opts.message || '',
          confirmLabel: opts.confirmLabel || (opts.danger === false ? 'Confirm' : 'Delete'),
          cancelLabel: opts.cancelLabel || 'Cancel',
          danger: opts.danger !== false, // most confirms here are destructive
          resolve,
        });
      }),
    []
  );

  const close = useCallback((val) => {
    setState((s) => {
      if (s) s.resolve(val);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={askConfirm}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 4000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-content"
            style={{
              width: '100%', maxWidth: 420,
              background: t.bgCard, border: `1px solid ${t.border}`,
              borderRadius: 16, padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
                background: state.danger ? 'rgba(239,68,68,0.12)' : 'rgba(250,204,21,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: state.danger ? '#ef4444' : '#FACC15', fontSize: 20, fontWeight: 700, lineHeight: 1,
              }}>!</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>{state.title}</h3>
                {state.message && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: t.textSecondary, whiteSpace: 'pre-wrap' }}>{state.message}</p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
              <button
                className="ap-btn"
                onClick={() => close(false)}
                style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, cursor: 'pointer' }}
              >
                {state.cancelLabel}
              </button>
              <button
                className="ap-btn"
                autoFocus
                onClick={() => close(true)}
                style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, background: state.danger ? '#ef4444' : t.text, color: state.danger ? '#fff' : (t.bg || '#0A0A0A'), border: 'none', cursor: 'pointer' }}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
