// lib/motion.js — durations, easings, and prefers-reduced-motion support.
//
// Contract:
//   1. NO raw millisecond values in components. Use MOTION.duration.md, etc.
//   2. All animations must be wrapped with useReducedMotion() — if the user
//      opted into reduced motion, snap to end-state (duration 0).
//   3. Exit < Enter (~60% of enter duration) so dismissals feel responsive.

'use client';

import { useState, useEffect } from 'react';

// ─── Duration tokens (milliseconds) ──────────────────────────────────────────

export const DURATION = {
  instant: 0,
  xs:      100,   // press feedback (button scale, opacity)
  sm:      150,   // hover, small state changes
  md:      200,   // modal enter, most micro-interactions
  lg:      250,   // page/screen transitions
  xl:      400,   // rare — hero reveal, first-visit onboarding
};

// Exit variants — always shorter than enter
export const EXIT_DURATION = {
  xs: 60,
  sm: 100,
  md: 130,
  lg: 160,
  xl: 240,
};

// ─── Easing tokens ───────────────────────────────────────────────────────────
// One consistent set — Material Design 3 emphasized set, which pairs well
// with the editorial brand.

export const EASING = {
  // Ease-out — for entering / expanding (feels fast to start, gentle to land)
  out:      'cubic-bezier(0.2, 0, 0, 1)',
  // Ease-in — for exiting / collapsing
  in:       'cubic-bezier(0.4, 0, 1, 1)',
  // Standard / smooth — for content changes
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Emphasized — for larger transitions (page changes)
  emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  // Overshoot — playful, only for accent moments (never critical UI)
  overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ─── Pre-composed transitions ────────────────────────────────────────────────
// Ready-to-drop CSS `transition` values so components don't reconstruct them.

export const TRANSITION = {
  fast:  `all ${DURATION.sm}ms ${EASING.out}`,
  base:  `all ${DURATION.md}ms ${EASING.standard}`,
  slow:  `all ${DURATION.lg}ms ${EASING.emphasized}`,
  fade:  `opacity ${DURATION.md}ms ${EASING.standard}`,
  press: `transform ${DURATION.xs}ms ${EASING.out}, opacity ${DURATION.xs}ms ${EASING.out}`,
};

// ─── Motion budget helpers ───────────────────────────────────────────────────

export const MOTION = {
  duration: DURATION,
  exit: EXIT_DURATION,
  easing: EASING,
  transition: TRANSITION,
  // Press feedback values used by Button, Card interactive, etc.
  press: {
    scale: 'scale(0.97)',
    opacity: 0.92,
  },
};

// ─── prefers-reduced-motion hook ─────────────────────────────────────────────
// Returns `true` when the user has requested reduced motion. Components must
// zero out durations / skip transforms in this case (keep only opacity fades
// at very short durations, or skip animation entirely).

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/**
 * Utility that returns a transition string honoring reduced-motion.
 * Usage:  const trans = useMotion(TRANSITION.base);
 */
export function useMotion(transition) {
  const reduced = useReducedMotion();
  return reduced ? 'none' : transition;
}

export default MOTION;
