'use client';
// components/media/LazyImage.js — progressive, blur-up image (A2.1).
//
// The reusable, token-aware successor to MainApp's inline LazyImage. Three
// improvements over the original:
//   1. TRUE blur-up — the tiny `thumbnail` shows immediately (blurred to hide
//      compression), the full-res `src` fades in ON TOP once decoded. No flash,
//      no pop from empty → full.
//   2. No layout shift — the box reserves space via `aspectRatio` (CLS = 0).
//   3. Cached-image safe — a cached/data-URI image can finish loading BEFORE
//      React attaches onLoad, so the event never fires (PLAYBOOK T18). We check
//      `.complete && naturalWidth > 0` on mount + src change, and treat onError
//      as "done" so a broken image never blurs forever.
//
// Off-screen images defer their network fetch via IntersectionObserver
// (rootMargin so they're ready just before scrolling in); pass `eager` to skip.
//
// Props:
//   src         : full-resolution image URL
//   thumbnail   : tiny/low-res placeholder (optional; falls back to src)
//   alt         : alt text
//   aspectRatio : e.g. '16 / 9', '1', or a number (reserves space; optional)
//   objectFit   : 'cover' (default) | 'contain'
//   radius      : border radius token key or CSS value (optional)
//   eager       : skip IntersectionObserver, load immediately
//   onClick     : click handler
//   style       : extra styles merged onto the wrapper

import { useEffect, useRef, useState } from 'react';
import { useTheme, RADIUS } from '@/lib/theme';
import { useReducedMotion } from '@/lib/motion';

export default function LazyImage({
  src,
  thumbnail,
  alt = '',
  aspectRatio,
  objectFit = 'cover',
  radius,
  eager = false,
  onClick,
  style = {},
}) {
  const { t } = useTheme();
  const reduced = useReducedMotion();

  const [inView, setInView] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const wrapRef = useRef(null);
  const imgRef = useRef(null);

  const full = src || thumbnail;
  const hasThumb = thumbnail && thumbnail !== src;
  const radiusVal = radius != null ? (RADIUS[radius] || radius) : undefined;

  // Defer the network fetch until near the viewport.
  useEffect(() => {
    if (eager || inView) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, inView]);

  // Reset load state whenever the source changes.
  useEffect(() => { setLoaded(false); setErrored(false); }, [full]);

  // Cached / data-URI images can be `.complete` before onLoad attaches (T18).
  useEffect(() => {
    if (!inView) return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [inView, full]);

  return (
    <div
      ref={wrapRef}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: t.surfaceElev,
        borderRadius: radiusVal,
        ...(aspectRatio != null ? { aspectRatio: String(aspectRatio) } : {}),
        ...style,
      }}
    >
      {/* Shimmer until the first pixels arrive */}
      {!loaded && !errored && !hasThumb && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${t.surfaceElev} 25%, ${t.surfaceHover} 50%, ${t.surfaceElev} 75%)`, backgroundSize: '200% 100%', animation: reduced ? 'none' : 'ap-shimmer 1.4s linear infinite' }} />
      )}

      {/* Blurred placeholder — instant, hides compression, covers the box */}
      {hasThumb && !errored && (
        <img
          src={thumbnail}
          alt=""
          aria-hidden
          decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit, filter: 'blur(12px)', transform: 'scale(1.06)', opacity: loaded ? 0 : 1, transition: reduced ? 'none' : 'opacity 260ms ease-out' }}
        />
      )}

      {/* Full-resolution image, fades in on top */}
      {inView && !errored && (
        <img
          ref={imgRef}
          src={full}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => { setErrored(true); setLoaded(true); }}
          style={{ position: 'relative', width: '100%', height: '100%', objectFit, opacity: loaded ? 1 : 0, transition: reduced ? 'none' : 'opacity 260ms ease-out' }}
        />
      )}

      {/* Broken-image fallback */}
      {errored && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
      )}

      <style>{`@keyframes ap-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`}</style>
    </div>
  );
}
