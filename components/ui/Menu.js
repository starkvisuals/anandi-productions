'use client';
// components/ui/Menu.js — the ONE dropdown / context menu.
//
// Per Harnesh: the asset right-click menu (and every other menu) should be
// clean and consistent — grouped items, icons, a danger action visually set
// apart, keyboard navigation, closes on Esc / outside-click / selection.
//
// Two entry points:
//   1. <Menu trigger={<Button>Actions</Button>} items={[...]} />        (click)
//   2. useContextMenu(items) → { onContextMenu, menu }                  (right-click)
//
// Item shape:
//   { label, icon?, onClick, danger?, disabled?, hint?, submenu? }
//   { divider: true }   — a separator between groups

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';
import Z from '@/lib/z';
import { MOTION, useReducedMotion } from '@/lib/motion';

// ─── The menu panel (positioned by caller) ───────────────────────────────────

function MenuPanel({ items, x, y, onClose, anchorRef }) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu inside the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - rect.height - 8);
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y, items]);

  // Close on outside click / Esc
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose, anchorRef]);

  // Keyboard nav within the menu
  const onKeyDown = (e) => {
    const buttons = Array.from(ref.current?.querySelectorAll('button:not([disabled])') || []);
    const idx = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(idx + 1) % buttons.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(idx - 1 + buttons.length) % buttons.length]?.focus(); }
  };

  return (
    <div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: Z.popover,
        minWidth: 220,
        maxWidth: 300,
        padding: SPACE['1'],
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: RADIUS.lg,
        boxShadow: t.shadowLg,
        animation: reduced ? 'none' : `ap-menu-in ${MOTION.duration.sm}ms ${MOTION.easing.out}`,
      }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={`d${i}`} role="separator" style={{ height: 1, background: t.border, margin: `${SPACE['1']} 6px` }} />;
        }
        const color = item.danger ? t.danger : t.text;
        return (
          <button
            key={item.label + i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { onClose(); item.onClick?.(); } }}
            style={{
              display: 'flex', alignItems: 'center', gap: SPACE['3'],
              width: '100%', padding: `${SPACE['2']} ${SPACE['3']}`,
              background: 'transparent', border: 'none', borderRadius: RADIUS.md,
              color: item.disabled ? t.textDisabled : color,
              fontSize: 13, fontWeight: WEIGHT.medium, fontFamily: 'inherit',
              textAlign: 'left', cursor: item.disabled ? 'not-allowed' : 'pointer',
              transition: reduced ? 'none' : MOTION.transition.fast,
            }}
            onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = item.danger ? `${t.danger}18` : t.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {item.icon != null && (
              <span aria-hidden="true" style={{ flexShrink: 0, width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: item.disabled ? t.textDisabled : (item.danger ? t.danger : t.textMuted) }}>
                {item.icon}
              </span>
            )}
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            {item.hint && <span style={{ fontSize: 11, color: t.textDisabled, flexShrink: 0 }}>{item.hint}</span>}
            {item.submenu && <span aria-hidden="true" style={{ color: t.textMuted, flexShrink: 0 }}>›</span>}
          </button>
        );
      })}
      <style>{`@keyframes ap-menu-in { from { opacity: 0; transform: scale(0.96) translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

// ─── Click-triggered menu ────────────────────────────────────────────────────

export default function Menu({ trigger, items, align = 'start' }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const openMenu = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setCoords({ x: align === 'end' ? r.right - 220 : r.left, y: r.bottom + 4 });
    setOpen(true);
  };

  return (
    <>
      <span ref={anchorRef} onClick={openMenu} style={{ display: 'inline-flex' }}>
        {trigger}
      </span>
      {open && <MenuPanel items={items} x={coords.x} y={coords.y} anchorRef={anchorRef} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Right-click context menu hook ───────────────────────────────────────────
// Usage:
//   const { onContextMenu, menu } = useContextMenu(items);
//   <div onContextMenu={onContextMenu}>…</div>
//   {menu}

export function useContextMenu(items) {
  const [state, setState] = useState({ open: false, x: 0, y: 0 });

  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    setState({ open: true, x: e.clientX, y: e.clientY });
  }, []);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const menu = state.open ? (
    <MenuPanel items={items} x={state.x} y={state.y} onClose={close} />
  ) : null;

  return { onContextMenu, menu, close };
}
