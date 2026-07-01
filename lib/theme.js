// lib/theme.js — single source of truth for design tokens.
//
// Contract for the component library (components/ui/**):
//   1. NEVER hardcode a color, spacing, radius, or motion value.
//   2. Read them from `useTheme()`.
//   3. If the token you need doesn't exist yet, ADD IT HERE — don't inline it.
//
// Legacy code (MainApp.js) still defines its own THEMES object locally for
// backwards compat until Phase 2 migration. The tokens here are the future.

'use client';

import { createContext, useContext, useState, useEffect } from 'react';

// ─── Tokens (Anandi Productions brand) ───────────────────────────────────────
// Every dark token has a light counterpart. Brand yellow is identical in
// both modes (it's the brand, not the mode).

export const TOKENS = {
  dark: {
    // Surfaces
    bg:            '#0A0A0A',
    surface:       '#141414',
    surfaceElev:   '#1C1C1C',
    surfaceHover:  '#242424',
    // Text
    text:          '#FAFAFA',
    textSecondary: 'rgba(250,250,250,0.72)',
    textMuted:     'rgba(250,250,250,0.48)',
    textDisabled:  'rgba(250,250,250,0.32)',
    // Lines
    border:        '#2A2A2A',
    borderStrong:  '#3A3A3A',
    // Brand
    primary:       '#FAFAFA',       // primary button fill (near-white on dark)
    onPrimary:     '#0A0A0A',       // text on primary button
    accent:        '#FACC15',       // brand yellow — highlights, active state, badges
    onAccent:      '#0A0A0A',       // black on yellow (10.4:1 contrast)
    ring:          '#FACC15',       // focus ring — brand yellow (signature)
    // Semantic
    success:       '#22C55E',
    warning:       '#F59E0B',
    danger:        '#EF4444',
    onDanger:      '#FFFFFF',
    info:          '#38BDF8',
    // Overlay
    scrim:         'rgba(0,0,0,0.6)',
    // Shadow
    shadowSm:      '0 1px 2px rgba(0,0,0,0.4)',
    shadowMd:      '0 4px 12px rgba(0,0,0,0.5)',
    shadowLg:      '0 12px 32px rgba(0,0,0,0.6)',
  },
  light: {
    bg:            '#FAFAFA',
    surface:       '#FFFFFF',
    surfaceElev:   '#F4F4F5',
    surfaceHover:  '#EDEDEF',
    text:          '#0A0A0A',
    textSecondary: 'rgba(10,10,10,0.72)',
    textMuted:     'rgba(10,10,10,0.52)',
    textDisabled:  'rgba(10,10,10,0.32)',
    border:        '#E5E5E5',
    borderStrong:  '#D4D4D4',
    primary:       '#0A0A0A',       // black button on light
    onPrimary:     '#FAFAFA',
    accent:        '#FACC15',       // yellow is brand — same in both modes
    onAccent:      '#0A0A0A',
    ring:          '#FACC15',
    success:       '#15803D',
    warning:       '#B45309',
    danger:        '#DC2626',
    onDanger:      '#FFFFFF',
    info:          '#0284C7',
    scrim:         'rgba(0,0,0,0.5)',
    shadowSm:      '0 1px 2px rgba(0,0,0,0.06)',
    shadowMd:      '0 4px 12px rgba(0,0,0,0.08)',
    shadowLg:      '0 12px 32px rgba(0,0,0,0.12)',
  },
};

// ─── Spacing, radius, typography (mode-invariant) ────────────────────────────

export const SPACE = {
  '0':   '0',
  '1':   '4px',
  '2':   '8px',
  '3':   '12px',
  '4':   '16px',
  '5':   '20px',
  '6':   '24px',
  '8':   '32px',
  '10':  '40px',
  '12':  '48px',
  '16':  '64px',
};

export const RADIUS = {
  none: '0',
  sm:   '4px',   // chips
  md:   '8px',   // inputs, buttons
  lg:   '12px',  // cards
  xl:   '16px',  // modals
  full: '9999px',
};

export const FONT = {
  ui:     'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  serif:  '"Playfair Display", Georgia, serif',   // editorial accents only
  mono:   '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const SIZE = {
  '12': '12px', '14': '14px', '16': '16px', '18': '18px',
  '24': '24px', '32': '32px', '48': '48px', '64': '64px',
};

export const WEIGHT = { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 };

// Touch-target minimum (Apple HIG 44, Material 48 — pick 44 for parity with iOS)
export const TOUCH_MIN = 44;

// ─── Theme context ───────────────────────────────────────────────────────────
// Reads persisted preference; falls back to system. Exposes a setter for the
// theme toggle in Settings / topbar.

const ThemeCtx = createContext(null);

export function ThemeProvider({ children, initial = 'dark', sync = true }) {
  const [mode, setMode] = useState(initial);

  // On mount, sync from localStorage or system preference.
  // Set sync={false} for previews / side-by-side comparisons where you want
  // the `initial` prop to be authoritative and NOT get overridden.
  useEffect(() => {
    if (!sync || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('ap-theme');
      if (stored === 'dark' || stored === 'light') {
        setMode(stored);
        return;
      }
      const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      setMode(sysDark ? 'dark' : 'light');
    } catch { /* ignore */ }
  }, [sync]);

  const setTheme = (next) => {
    setMode(next);
    try { window.localStorage.setItem('ap-theme', next); } catch { /* ignore */ }
  };

  const value = {
    mode,
    setTheme,
    toggle: () => setTheme(mode === 'dark' ? 'light' : 'dark'),
    t: TOKENS[mode],
    space: SPACE,
    radius: RADIUS,
    font: FONT,
    size: SIZE,
    weight: WEIGHT,
  };

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/**
 * Access the theme + tokens. Works even outside <ThemeProvider> for
 * backwards-compat during the phased migration: falls back to dark.
 */
export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (ctx) return ctx;
  return {
    mode: 'dark',
    setTheme: () => {},
    toggle: () => {},
    t: TOKENS.dark,
    space: SPACE,
    radius: RADIUS,
    font: FONT,
    size: SIZE,
    weight: WEIGHT,
  };
}
