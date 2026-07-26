'use client';
// components/ui/Toast.js — global toast system.
//
// GOAL (per Harnesh): every completed action shows a confirmation toast.
// One provider mounted at the root; any component calls useToast() and does
// toast.success('Saved') / toast.error('Failed') / toast.info(...) etc.
//
// Accessibility: the live region is aria-live="polite" so screen readers
// announce toasts without stealing focus. Auto-dismiss 3.5s (errors 6s).
//
// Usage:
//   const toast = useToast();
//   toast.success('Employee added');
//   toast.error('Could not save', { title: 'Save failed' });
//   toast.promise(saveThing(), { loading: 'Saving…', success: 'Saved', error: 'Failed' });

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';
import Z from '@/lib/z';
import { MOTION } from '@/lib/motion';

const ToastCtx = createContext(null);

const DEFAULT_DURATION = { success: 3500, info: 3500, warning: 4500, error: 6000, loading: 60000 };

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const push = useCallback((variant, message, opts = {}) => {
    const id = ++idSeq;
    const duration = opts.duration ?? DEFAULT_DURATION[variant] ?? 3500;
    setToasts((list) => [...list, { id, variant, message, title: opts.title }]);
    if (duration > 0 && variant !== 'loading') {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const update = useCallback((id, variant, message, opts = {}) => {
    setToasts((list) => list.map((t) => t.id === id ? { ...t, variant, message, title: opts.title } : t));
    const duration = opts.duration ?? DEFAULT_DURATION[variant] ?? 3500;
    if (duration > 0 && variant !== 'loading') {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const api = {
    show: push,
    success: (msg, opts) => push('success', msg, opts),
    error:   (msg, opts) => push('error', msg, opts),
    info:    (msg, opts) => push('info', msg, opts),
    warning: (msg, opts) => push('warning', msg, opts),
    loading: (msg, opts) => push('loading', msg, opts),
    dismiss,
    // Promise helper: shows loading, then success/error automatically
    promise: async (promise, { loading = 'Working…', success = 'Done', error = 'Something went wrong' } = {}) => {
      const id = push('loading', loading);
      try {
        const result = await promise;
        update(id, 'success', typeof success === 'function' ? success(result) : success);
        return result;
      } catch (e) {
        update(id, 'error', typeof error === 'function' ? error(e) : error);
        throw e;
      }
    },
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

/**
 * useToast() — returns the toast API. Safe to call outside a provider (returns
 * no-op functions) so legacy code migrating over never crashes.
 */
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (ctx) return ctx;
  const noop = () => {};
  return { show: noop, success: noop, error: noop, info: noop, warning: noop, loading: noop, dismiss: noop, promise: (p) => p };
}

// ─── Viewport (bottom-right stack) ───────────────────────────────────────────

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: SPACE['4'],
        right: SPACE['4'],
        zIndex: Z.toast,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE['2'],
        maxWidth: 'min(92vw, 380px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const VARIANT_ICON = {
  success: (c) => <path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  error:   (c) => <><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" fill="none" /><path d="M12 8v4M12 16h.01" stroke={c} strokeWidth="2" strokeLinecap="round" /></>,
  warning: (c) => <><path d="M12 3l9 16H3L12 3z" stroke={c} strokeWidth="2" strokeLinejoin="round" fill="none" /><path d="M12 10v3M12 16h.01" stroke={c} strokeWidth="2" strokeLinecap="round" /></>,
  info:    (c) => <><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" fill="none" /><path d="M12 11v5M12 8h.01" stroke={c} strokeWidth="2" strokeLinecap="round" /></>,
  loading: (c) => <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" strokeDasharray="40 20" fill="none" style={{ transformOrigin: 'center', animation: 'ap-toast-spin 0.8s linear infinite' }} />,
};

function ToastItem({ toast, onDismiss }) {
  const { t } = useTheme();
  const color = {
    success: t.success, error: t.danger, warning: t.warning, info: t.info, loading: t.textMuted,
  }[toast.variant] || t.info;

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACE['3'],
        padding: `${SPACE['3']} ${SPACE['4']}`,
        background: t.surface,
        color: t.text,
        border: `1px solid ${t.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: RADIUS.md,
        boxShadow: t.shadowLg,
        animation: `ap-toast-in ${MOTION.duration.md}ms ${MOTION.easing.out}`,
        minWidth: 240,
      }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="18" height="18" viewBox="0 0 24 24">{VARIANT_ICON[toast.variant]?.(color)}</svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontSize: 13, fontWeight: WEIGHT.semibold, marginBottom: 2 }}>{toast.title}</div>
        )}
        <div style={{ fontSize: 13, color: toast.title ? t.textSecondary : t.text, lineHeight: 1.4 }}>
          {toast.message}
        </div>
      </div>
      {toast.variant !== 'loading' && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
            color: t.textMuted, padding: 2, lineHeight: 0, borderRadius: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
      <style>{`
        @keyframes ap-toast-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes ap-toast-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
