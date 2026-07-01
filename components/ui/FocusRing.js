'use client';
// components/ui/FocusRing.js — global :focus-visible handler.
//
// Injects a single style block that gives every keyboard-focused element a
// brand-yellow ring. Kills the entire class of "outline: 'none' with no
// replacement" bugs.
//
// Why :focus-visible (not :focus): Chrome/Safari/Firefox only paint it when
// the focus was triggered by keyboard, so mouse clicks don't get the ring
// (a common UX complaint about default browser outlines).
//
// Mount ONCE at the app root (in app/layout.js). It's a pure style component
// and returns null.

import { useEffect } from 'react';
import { useTheme } from '@/lib/theme';

export default function FocusRing() {
  const { t } = useTheme();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'ap-focus-ring';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    // Use CSS custom properties so the ring color follows the current theme
    // without needing to re-inject on every mode change.
    el.textContent = `
      :root { --ap-ring: ${t.ring}; }

      /* Every focusable element gets a subtle 2px ring in brand yellow.
         :focus-visible ensures mouse clicks don't get it. */
      *:focus-visible {
        outline: 2px solid var(--ap-ring);
        outline-offset: 2px;
        border-radius: 4px;
      }
      /* Inputs already draw a boxShadow-based ring themselves; hide the
         outer outline to avoid a double ring. */
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible {
        outline: none;
      }
      /* Skip-links and other visually-hidden elements shouldn't paint the ring
         until they're focused into visibility. Handled by their own styles. */
    `;
  }, [t.ring]);

  return null;
}
