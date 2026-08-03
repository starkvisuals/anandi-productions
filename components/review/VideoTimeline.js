'use client';
// components/review/VideoTimeline.js — the scrubber with comment markers (A1.3).
//
// A controlled, presentational timeline for video review. It does NOT own the
// <video>; the parent passes duration + currentTime and handles the seek. Comment
// markers sit on the track at videoTimestamp / duration; clicking a marker seeks
// to that moment AND selects the comment (opening its thread in the sidebar).
// Clicking or dragging the track scrubs. Keyboard: ←/→ ±5s, Home/End jump.
//
// Marker math mirrors the legacy timeline in MainApp (ts / duration * 100%) and
// the pin numbering matches ReviewCanvas + CommentSidebar (order among pins).
//
// Controlled:
//   duration    : total seconds (0 / NaN → track renders disabled with a hint)
//   currentTime : playhead position in seconds
//   comments    : items array (markers = those with a videoTimestamp)
//   selectedId  : highlighted comment id
//   onSeek      : (seconds) => void
//   onSelect    : (id | null) => void

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';

function fmtTimecode(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function VideoTimeline({
  duration = 0,
  currentTime = 0,
  comments = [],
  selectedId = null,
  onSeek,
  onSelect,
}) {
  const { t } = useTheme();
  const trackRef = useRef(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverFrac, setHoverFrac] = useState(null); // 0..1 | null

  const hasDuration = duration > 0 && Number.isFinite(duration);
  const pct = hasDuration ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

  // Pin numbering consistent with the sidebar (order among type==='pin').
  const pinIndex = useMemo(() => {
    const map = {};
    comments.filter(c => c.type === 'pin').forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [comments]);

  // Markers = comments pinned to a moment.
  const markers = useMemo(
    () => comments.filter(c => c.videoTimestamp != null && Number.isFinite(c.videoTimestamp)),
    [comments]
  );

  const fracFromClientX = useCallback((clientX) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
  }, []);

  const clientXOf = (e) => e.touches?.[0]?.clientX ?? e.clientX;
  const seekToClientX = useCallback((clientX) => {
    if (hasDuration) onSeek?.(fracFromClientX(clientX) * duration);
  }, [hasDuration, duration, onSeek, fracFromClientX]);

  // Drag-scrub: track pointer at the window level so releasing off-track still ends it.
  useEffect(() => {
    if (!scrubbing) return;
    const move = (e) => { setHoverFrac(fracFromClientX(clientXOf(e))); seekToClientX(clientXOf(e)); };
    const up = () => setScrubbing(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [scrubbing, fracFromClientX, seekToClientX]);

  const onTrackDown = (e) => {
    if (!hasDuration) return;
    if (e.cancelable) e.preventDefault();
    setScrubbing(true);
    seekToClientX(clientXOf(e));
  };
  const onTrackHover = (e) => { if (hasDuration) setHoverFrac(fracFromClientX(clientXOf(e))); };
  const onTrackLeave = () => { if (!scrubbing) setHoverFrac(null); };

  const onKey = (e) => {
    if (!hasDuration) return;
    let next = null;
    if (e.key === 'ArrowLeft') next = currentTime - 5;
    else if (e.key === 'ArrowRight') next = currentTime + 5;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = duration;
    if (next != null) { e.preventDefault(); onSeek?.(Math.max(0, Math.min(duration, next))); }
  };

  return (
    <div style={{ flexShrink: 0, padding: `10px ${SPACE['4']}`, background: t.surface, borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: SPACE['3'] }}>
      <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: t.textSecondary, minWidth: 34, textAlign: 'right', flexShrink: 0 }}>{fmtTimecode(currentTime)}</span>

      {/* Track (hit area) */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Seek video"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration) || 0}
        aria-valuenow={Math.floor(currentTime) || 0}
        aria-valuetext={fmtTimecode(currentTime)}
        tabIndex={hasDuration ? 0 : -1}
        onMouseDown={onTrackDown}
        onTouchStart={onTrackDown}
        onMouseMove={onTrackHover}
        onMouseLeave={onTrackLeave}
        onKeyDown={onKey}
        style={{ position: 'relative', flex: 1, height: 30, display: 'flex', alignItems: 'center', cursor: hasDuration ? 'pointer' : 'default', touchAction: 'none', outline: 'none' }}
      >
        {/* Base track */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: RADIUS.full, background: t.surfaceElev, border: `1px solid ${t.border}`, boxSizing: 'border-box' }} />
        {/* Progress fill */}
        {hasDuration && (
          <div style={{ position: 'absolute', left: 0, width: `${pct}%`, top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: RADIUS.full, background: t.accent }} />
        )}

        {/* Hover time bubble */}
        {hasDuration && hoverFrac != null && (
          <div style={{ position: 'absolute', left: `${hoverFrac * 100}%`, top: -22, transform: 'translateX(-50%)', pointerEvents: 'none', fontSize: 10, fontFamily: 'ui-monospace, monospace', fontWeight: WEIGHT.semibold, color: t.text, background: t.surfaceElev, border: `1px solid ${t.border}`, borderRadius: RADIUS.sm, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            {fmtTimecode(hoverFrac * duration)}
          </div>
        )}

        {/* Comment markers */}
        {hasDuration && markers.map(c => {
          const left = Math.max(0, Math.min(100, (c.videoTimestamp / duration) * 100));
          const sel = c.id === selectedId;
          const no = pinIndex[c.id];
          const size = sel ? 20 : 16;
          return (
            <button
              key={c.id}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onSeek?.(c.videoTimestamp); onSelect?.(c.id); }}
              title={`${fmtTimecode(c.videoTimestamp)}${c.text ? ` — ${c.text}` : ''}`}
              aria-label={`Comment at ${fmtTimecode(c.videoTimestamp)}${c.text ? `: ${c.text}` : ''}`}
              style={{
                position: 'absolute', left: `${left}%`, top: '50%',
                transform: 'translate(-50%,-50%)', zIndex: sel ? 6 : 4,
                width: size, height: size, borderRadius: '50%',
                background: c.color || t.accent,
                border: `2px solid ${t.surface}`,
                boxShadow: sel ? `0 0 0 2px ${c.color || t.accent}` : '0 1px 3px rgba(0,0,0,0.4)',
                color: '#0A0A0A', fontSize: 10, fontWeight: WEIGHT.bold, lineHeight: 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
                opacity: c.resolved ? 0.45 : 1,
              }}
            >
              {no != null ? no : ''}
            </button>
          );
        })}

        {/* Playhead */}
        {hasDuration && (
          <div style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 2, flex: 1, background: t.text, opacity: 0.85 }} />
            <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, borderRadius: '50%', background: t.text, border: `2px solid ${t.surface}`, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>
        )}

        {!hasDuration && (
          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>
            Timeline appears once the video loads
          </span>
        )}
      </div>

      <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: t.textMuted, minWidth: 34, flexShrink: 0 }}>{fmtTimecode(duration)}</span>
    </div>
  );
}
