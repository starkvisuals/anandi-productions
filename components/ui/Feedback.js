'use client';
// components/ui/Feedback.js — Skeleton, Spinner, EmptyState.
//
// These kill two anti-patterns found in the audit:
//   - plain "Loading..." text  → use <Skeleton/> or <Spinner/>
//   - bare em-dash "—" as empty → use <EmptyState/>

import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';

// ─── Skeleton ────────────────────────────────────────────────────────────────
// Shimmer placeholder. variant: 'line' | 'block' | 'circle'.

export function Skeleton({ variant = 'line', width, height, count = 1, style }) {
  const { t } = useTheme();
  const base = {
    background: `linear-gradient(90deg, ${t.surfaceElev} 25%, ${t.surfaceHover} 37%, ${t.surfaceElev} 63%)`,
    backgroundSize: '400% 100%',
    animation: 'ap-shimmer 1.4s ease infinite',
    borderRadius: variant === 'circle' ? '50%' : variant === 'line' ? RADIUS.sm : RADIUS.md,
  };
  const dims =
    variant === 'circle'
      ? { width: width || 40, height: height || width || 40 }
      : variant === 'line'
      ? { width: width || '100%', height: height || 12 }
      : { width: width || '100%', height: height || 80 };

  const items = Array.from({ length: count });
  return (
    <>
      {items.map((_, i) => (
        <div key={i} aria-hidden="true" style={{ ...base, ...dims, marginBottom: count > 1 && variant === 'line' ? SPACE['2'] : 0, ...style }} />
      ))}
      <style>{`@keyframes ap-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }`}</style>
    </>
  );
}

/** A ready-made skeleton for a list of rows (e.g. tables loading). */
export function SkeletonRows({ rows = 5, style }) {
  const { t } = useTheme();
  return (
    <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: SPACE['3'], ...style }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: SPACE['3'] }}>
          <Skeleton variant="circle" width={36} />
          <div style={{ flex: 1 }}>
            <Skeleton variant="line" width="40%" height={12} />
            <div style={{ height: 6 }} />
            <Skeleton variant="line" width="70%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ size = 20, color, label = 'Loading' }) {
  const { t } = useTheme();
  const c = color || t.accent;
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 10)),
        borderStyle: 'solid',
        borderColor: `${c}33`,
        borderTopColor: c,
        borderRadius: '50%',
        animation: 'ap-spinner 0.7s linear infinite',
      }}
    >
      <style>{`@keyframes ap-spinner { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

/** Centered spinner for a whole panel while loading. */
export function LoadingPanel({ label = 'Loading…', minHeight = 160 }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SPACE['3'], minHeight, color: t.textMuted }}>
      <Spinner size={24} />
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
// icon + title + description + optional action. Replaces the bare "—".

export function EmptyState({ icon, title, description, action, compact = false, style }) {
  const { t } = useTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: SPACE['2'],
      padding: compact ? SPACE['4'] : `${SPACE['10']} ${SPACE['5']}`,
      color: t.textMuted,
      ...style,
    }}>
      {icon && (
        <div style={{
          width: compact ? 32 : 44, height: compact ? 32 : 44, borderRadius: RADIUS.lg,
          background: t.surfaceElev, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.textMuted, marginBottom: SPACE['1'],
        }}>{icon}</div>
      )}
      {title && <div style={{ fontSize: compact ? 13 : 15, fontWeight: WEIGHT.semibold, color: t.text }}>{title}</div>}
      {description && <div style={{ fontSize: 12, color: t.textMuted, maxWidth: 320, lineHeight: 1.5 }}>{description}</div>}
      {action && <div style={{ marginTop: SPACE['2'] }}>{action}</div>}
    </div>
  );
}

/**
 * Inline empty value — use in tables/rows where a full EmptyState is too big.
 * Renders subtle placeholder text instead of a raw "—".
 *   <EmptyValue>Not set</EmptyValue>
 */
export function EmptyValue({ children = 'Not set' }) {
  const { t } = useTheme();
  return <span style={{ color: t.textDisabled, fontStyle: 'italic', fontSize: 'inherit' }}>{children}</span>;
}
