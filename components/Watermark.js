'use client';
import { useRef, useEffect } from 'react';

/**
 * Watermark overlay component for asset previews.
 * Renders a subtle text watermark on a canvas overlay.
 *
 * Props:
 *   text - watermark text (default: "ANANDI PRODUCTIONS")
 *   enabled - whether watermark is visible
 *   opacity - 0-1, default 0.15 (very subtle)
 *   position - 'bottom-right' | 'center' | 'diagonal'
 */
export default function Watermark({
  text = 'ANANDI PRODUCTIONS',
  enabled = false,
  opacity = 0.15,
  position = 'bottom-right',
  width = '100%',
  height = '100%'
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Configure text
    const fontSize = Math.max(12, Math.min(rect.width * 0.025, 24));
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.textAlign = position === 'center' || position === 'diagonal' ? 'center' : 'right';
    ctx.textBaseline = 'middle';

    if (position === 'bottom-right') {
      ctx.fillText(text, rect.width - 16, rect.height - 20);
    } else if (position === 'center') {
      ctx.fillText(text, rect.width / 2, rect.height / 2);
    } else if (position === 'diagonal') {
      ctx.save();
      ctx.translate(rect.width / 2, rect.height / 2);
      ctx.rotate(-Math.PI / 6); // -30 degrees
      ctx.globalAlpha = opacity;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }, [enabled, text, opacity, position, width, height]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
}
