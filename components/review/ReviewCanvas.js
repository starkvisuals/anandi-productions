'use client';
// components/review/ReviewCanvas.js — the unified review canvas (A1.1).
//
// One engine for BOTH image and video review, Frame.io-style. Ported from the
// proven %-coordinate logic in components/AnnotationCanvas.js and extended with:
//   - a PIN tool (drop a comment marker at a point — the primary review gesture)
//   - video mode: transparent overlay ON TOP of the <video> (never draws on the
//     video element), auto-pauses on draw, tags new items with the current
//     timestamp, and shows only items whose videoTimestamp is near currentTime
//     (or whose comment is selected).
//
// Coordinates are stored as PERCENTAGES of the frame → resolution-independent,
// survive responsive resize + different playback sizes (see docs/PLAYBOOK.md).
//
// MUST be a module-level component (not nested in a parent) so its identity is
// stable across parent re-renders — otherwise in-progress drawing is wiped
// (PLAYBOOK T5).
//
// Controlled component:
//   items        : array of review items to render
//                  { id, type:'pin'|'rect'|'circle'|'arrow'|'freehand'|'text',
//                    x, y, width?, height?, path?, color, text?, videoTimestamp? }
//   onAddItem    : (item) => void      — a new drawing/pin was created
//   onUpdateItem : (id, patch) => void — drag/resize moved an item
//   onDeleteItem : (id) => void
//   selectedId   : currently highlighted item id (from the comment sidebar)
//   onSelect     : (id|null) => void
//   media        : { type:'image'|'video', src, poster? }
//   videoRef     : optional external ref to control the <video> from the parent
//   onTimeUpdate : (seconds) => void   — video time changed (for the sidebar)
//   activeTimeWindow : seconds; video items within ±window of currentTime show

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';
import { useReducedMotion } from '@/lib/motion';

// Brand-forward review palette (kept distinct from semantic tokens — these are
// user-chosen annotation colors, brand yellow first).
const DRAW_COLORS = ['#FACC15', '#EF4444', '#22C55E', '#3B82F6', '#A855F7', '#F97316', '#FFFFFF'];

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const ICON = {
  pin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  rect: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/></svg>,
  circle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>,
  freehand: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c3-4 5-6 7-6s3 3 5 3 4-3 6-6"/></svg>,
  text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>,
};
const TOOLS = ['pin', 'rect', 'circle', 'arrow', 'freehand', 'text'];

export default function ReviewCanvas({
  media,
  items = [],
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  selectedId = null,
  onSelect,
  videoRef: externalVideoRef,
  onTimeUpdate,
  activeTimeWindow = 0.75,
  showToolbar = true,
  pendingColor,
}) {
  const { t } = useTheme();
  const reduced = useReducedMotion();

  const isVideo = media?.type === 'video';

  const [tool, setTool] = useState('pin');
  const [color, setColor] = useState(pendingColor || DRAW_COLORS[0]);
  const [zoom, setZoom] = useState(100);
  const [imageLoaded, setImageLoaded] = useState(!isVideo ? false : true);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawEnd, setDrawEnd] = useState(null);
  const [path, setPath] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);

  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPaused, setVideoPaused] = useState(true);

  const frameRef = useRef(null);        // the media box we measure against
  const imgRef = useRef(null);
  const localVideoRef = useRef(null);
  const videoRef = externalVideoRef || localVideoRef;

  // A cached / data-URI image can finish loading BEFORE React attaches onLoad,
  // so the event never fires and imageLoaded stays false forever (a real trap —
  // see docs/PLAYBOOK.md). Check .complete on mount + when the src changes.
  useEffect(() => {
    if (isVideo) return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setImageLoaded(true);
  }, [isVideo, media?.src]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { if (pendingColor) setColor(pendingColor); }, [pendingColor]);

  // ── Video time sync (throttled via native timeupdate) ──────────────────────
  useEffect(() => {
    if (!isVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => { setVideoTime(v.currentTime); onTimeUpdate?.(v.currentTime); };
    const onMeta = () => setVideoDuration(v.duration || 0);
    const onPlay = () => setVideoPaused(false);
    const onPause = () => setVideoPaused(true);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [isVideo, videoRef, onTimeUpdate]);

  // Which items to render right now.
  // Image: all. Video: those with no timestamp, OR near currentTime, OR selected.
  const visibleItems = isVideo
    ? items.filter(it =>
        it.videoTimestamp == null ||
        it.id === selectedId ||
        Math.abs(it.videoTimestamp - videoTime) <= activeTimeWindow)
    : items;

  // ── Coordinate helper: client → % of frame ─────────────────────────────────
  const getPos = useCallback((e) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    const cx = e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? e.clientY;
    return {
      x: Math.max(0, Math.min(100, ((cx - box.left) / box.width) * 100)),
      y: Math.max(0, Math.min(100, ((cy - box.top) / box.height) * 100)),
    };
  }, []);

  // ── Drawing lifecycle ───────────────────────────────────────────────────────
  const beginDraw = (e) => {
    if (dragging || resizing) return;
    if (e.cancelable) e.preventDefault();
    const pos = getPos(e);
    onSelect?.(null);

    // Pin + text are single-click gestures — create immediately on down.
    if (tool === 'pin') { commitItem({ type: 'pin', x: pos.x, y: pos.y }); return; }

    setIsDrawing(true);
    setDrawStart(pos);
    setDrawEnd(pos);
    if (tool === 'freehand') setPath([pos]);
  };

  const moveDraw = (e) => {
    if (dragging) {
      if (e.cancelable) e.preventDefault();
      const pos = getPos(e);
      const it = itemsRef.current.find(i => i.id === dragging);
      if (it) onUpdateItem?.(dragging, {
        x: Math.max(0, Math.min(100 - (it.width || 4), pos.x - (it.width || 4) / 2)),
        y: Math.max(0, Math.min(100 - (it.height || 4), pos.y - (it.height || 4) / 2)),
      });
      return;
    }
    if (resizing) {
      if (e.cancelable) e.preventDefault();
      const pos = getPos(e);
      const it = itemsRef.current.find(i => i.id === resizing);
      if (it) onUpdateItem?.(resizing, { width: Math.max(3, pos.x - it.x), height: Math.max(3, pos.y - it.y) });
      return;
    }
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const pos = getPos(e);
    setDrawEnd(pos);
    if (tool === 'freehand') setPath(prev => {
      // Sample: skip points closer than ~0.6% to keep the stored path coarse (PLAYBOOK: Firestore size).
      const last = prev[prev.length - 1];
      if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < 0.6) return prev;
      return [...prev, pos];
    });
  };

  const endDraw = () => {
    if (dragging) { setDragging(null); return; }
    if (resizing) { setResizing(null); return; }
    if (!isDrawing || !drawStart) return;

    const end = drawEnd || drawStart;
    if (tool === 'text') {
      commitItem({ type: 'text', x: drawStart.x, y: drawStart.y, text: 'Note' });
    } else if (tool === 'freehand' && path.length > 2) {
      commitItem({ type: 'freehand', path });
    } else {
      const w = Math.abs(end.x - drawStart.x);
      const h = Math.abs(end.y - drawStart.y);
      if (w > 1.5 || h > 1.5) {
        commitItem({ type: tool, x: Math.min(end.x, drawStart.x), y: Math.min(end.y, drawStart.y), width: Math.max(w, 4), height: Math.max(h, 4) });
      }
    }
    setIsDrawing(false); setDrawStart(null); setDrawEnd(null); setPath([]);
  };

  // Create an item, tagging with the current video timestamp + auto-pausing.
  const commitItem = (partial) => {
    let videoTimestamp = null;
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoTimestamp = videoRef.current.currentTime;
    }
    const item = { id: genId(), color, createdAt: new Date().toISOString(), videoTimestamp, ...partial };
    onAddItem?.(item);
    onSelect?.(item.id);
  };

  // Touch: single-finger draws; two-finger ignored (let the browser pinch page).
  const touchStart = (e) => { if (e.touches.length === 1) beginDraw(e); };
  const touchMove = (e) => { if (e.touches.length === 1) moveDraw(e); };
  const touchEnd = () => endDraw();

  // ── Renderers ──────────────────────────────────────────────────────────────
  const renderItem = (a) => {
    const sel = a.id === selectedId;
    const stop = (e) => e.stopPropagation();
    const selectMe = (e) => { stop(e); onSelect?.(a.id); };
    const startDrag = (e) => { stop(e); setDragging(a.id); };
    const delBtn = sel ? (
      <button onClick={(e) => { stop(e); onDeleteItem?.(a.id); }} aria-label="Delete annotation"
        style={{ position: 'absolute', top: -9, right: -9, width: 20, height: 20, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}`, color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1, zIndex: 12 }}>×</button>
    ) : null;
    const resizeH = sel && a.width != null ? (
      <div onMouseDown={(e) => { stop(e); setResizing(a.id); }} onTouchStart={(e) => { stop(e); setResizing(a.id); }}
        style={{ position: 'absolute', bottom: -5, right: -5, width: 11, height: 11, background: t.surface, border: `2px solid ${a.color}`, borderRadius: 2, cursor: 'se-resize', zIndex: 12 }} />
    ) : null;

    if (a.type === 'pin') {
      const idx = items.filter(i => i.type === 'pin').findIndex(i => i.id === a.id) + 1;
      return (
        <button key={a.id} onClick={selectMe} onMouseDown={startDrag} onTouchStart={startDrag} aria-label={`Comment pin ${idx}`}
          style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%,-100%)', zIndex: sel ? 13 : 10, cursor: 'grab', background: 'none', border: 'none', padding: 0 }}>
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50% 50% 50% 2px', background: a.color, color: '#0A0A0A', fontSize: 12, fontWeight: WEIGHT.bold, boxShadow: sel ? `0 0 0 3px ${t.surface}, 0 0 0 5px ${a.color}` : '0 2px 6px rgba(0,0,0,0.4)', transform: 'rotate(-45deg)' }}>
            <span style={{ transform: 'rotate(45deg)' }}>{idx}</span>
          </span>
        </button>
      );
    }

    if (a.type === 'freehand' && a.path) {
      const d = a.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return (
        <div key={a.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            <path d={d} stroke={a.color} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: sel ? 4 : 3, pointerEvents: 'stroke', cursor: 'pointer', filter: sel ? `drop-shadow(0 0 3px ${a.color})` : 'none' }} onClick={selectMe} />
          </svg>
        </div>
      );
    }

    if (a.type === 'text') {
      return (
        <div key={a.id} onClick={selectMe} onMouseDown={startDrag} onTouchStart={startDrag}
          style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, background: a.color, color: '#0A0A0A', fontSize: 12, fontWeight: WEIGHT.semibold, padding: '3px 8px', borderRadius: RADIUS.sm, cursor: 'grab', zIndex: sel ? 13 : 10, maxWidth: 200, boxShadow: sel ? `0 0 0 2px ${t.surface}, 0 0 0 4px ${a.color}` : '0 2px 6px rgba(0,0,0,0.35)' }}>
          {a.text || 'Note'}{delBtn}
        </div>
      );
    }

    if (a.type === 'arrow') {
      return (
        <div key={a.id} onClick={selectMe} onMouseDown={startDrag} onTouchStart={startDrag}
          style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, cursor: 'grab', zIndex: sel ? 13 : 10 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs><marker id={`ar-${a.id}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs>
            <line x1="0" y1="0" x2="100" y2="100" stroke={a.color} strokeWidth={sel ? 4 : 3} markerEnd={`url(#ar-${a.id})`} vectorEffect="non-scaling-stroke" />
          </svg>
          {resizeH}{delBtn}
        </div>
      );
    }

    // rect + circle
    const round = a.type === 'circle';
    return (
      <div key={a.id} onClick={selectMe} onMouseDown={startDrag} onTouchStart={startDrag}
        style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: round ? '50%' : RADIUS.sm, background: `${a.color}1f`, cursor: 'grab', boxSizing: 'border-box', zIndex: sel ? 13 : 10, boxShadow: sel ? `0 0 0 2px ${t.surface}, 0 0 0 4px ${a.color}` : 'none' }}>
        {resizeH}{delBtn}
      </div>
    );
  };

  const renderGhost = () => {
    if (!isDrawing || !drawStart || !drawEnd || tool === 'pin' || tool === 'text') return null;
    if (tool === 'freehand' && path.length > 1) {
      const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}><path d={d} stroke={color} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3, opacity: 0.75 }} /></svg>;
    }
    const x = Math.min(drawStart.x, drawEnd.x), y = Math.min(drawStart.y, drawEnd.y);
    const w = Math.abs(drawEnd.x - drawStart.x), h = Math.abs(drawEnd.y - drawStart.y);
    if (w < 1 && h < 1) return null;
    return <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, border: `2px dashed ${color}`, borderRadius: tool === 'circle' ? '50%' : RADIUS.sm, background: `${color}12`, pointerEvents: 'none' }} />;
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: t.bg }}>
      {showToolbar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE['2'], padding: `${SPACE['2']} ${SPACE['3']}`, background: t.surface, borderBottom: `1px solid ${t.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, background: t.surfaceElev, borderRadius: RADIUS.md, padding: 3 }}>
            {TOOLS.map(tl => (
              <button key={tl} onClick={() => setTool(tl)} title={tl} aria-label={tl} aria-pressed={tool === tl}
                style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, border: 'none', cursor: 'pointer', background: tool === tl ? t.accent : 'transparent', color: tool === tl ? t.onAccent : t.textSecondary, transition: reduced ? 'none' : 'background 150ms' }}>
                {ICON[tl]}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: t.border }} />
          <div style={{ display: 'flex', gap: 3 }}>
            {DRAW_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} aria-label={`color ${c}`}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', borderWidth: 2, borderStyle: 'solid', borderColor: color === c ? t.text : 'transparent', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none' }} />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {!isVideo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: t.surfaceElev, borderRadius: RADIUS.md, padding: 3 }}>
              <button onClick={() => setZoom(z => Math.max(50, z - 25))} aria-label="Zoom out" style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontSize: 16 }}>−</button>
              <button onClick={() => setZoom(100)} style={{ padding: '0 6px', border: 'none', background: 'transparent', color: t.textMuted, cursor: 'pointer', fontSize: 11, minWidth: 38 }}>{zoom}%</button>
              <button onClick={() => setZoom(z => Math.min(300, z + 25))} aria-label="Zoom in" style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontSize: 16 }}>+</button>
            </div>
          )}
        </div>
      )}

      {/* Media + overlay */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: (!isVideo && zoom > 100) ? 'auto' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
        <div style={{ position: 'relative', width: (!isVideo && zoom > 100) ? `${zoom}%` : 'auto', maxWidth: (!isVideo && zoom > 100) ? 'none' : '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {/* frameRef wraps ONLY the media box so % coords map to the media, not letterboxing */}
          <div
            ref={frameRef}
            onMouseDown={beginDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={touchStart}
            onTouchMove={touchMove}
            onTouchEnd={touchEnd}
            style={{ position: 'relative', lineHeight: 0, cursor: tool === 'pin' ? 'copy' : 'crosshair', touchAction: 'none', userSelect: 'none', maxWidth: '100%', maxHeight: '100%' }}
          >
            {isVideo ? (
              <video
                ref={videoRef}
                src={media.src}
                poster={media.poster}
                controls
                playsInline
                style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 220px)', objectFit: 'contain', background: '#000' }}
              />
            ) : (
              <img
                ref={imgRef}
                src={media?.src}
                alt=""
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
                style={{ display: 'block', width: zoom > 100 ? '100%' : 'auto', maxWidth: zoom <= 100 ? '100%' : 'none', maxHeight: zoom <= 100 ? 'calc(100vh - 220px)' : 'none', objectFit: 'contain', opacity: imageLoaded ? 1 : 0, transition: reduced ? 'none' : 'opacity 200ms' }}
              />
            )}

            {/* Annotation layer (video: below the native controls area via pointer math; fine for MVP) */}
            {(imageLoaded || isVideo) && visibleItems.map(renderItem)}
            {(imageLoaded || isVideo) && renderGhost()}
          </div>
        </div>

        {!imageLoaded && !isVideo && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, fontSize: 12 }}>Loading…</div>
        )}
      </div>

      {/* Video status strip (timeline lives in A1.3) */}
      {isVideo && (
        <div style={{ flexShrink: 0, padding: `${SPACE['1']} ${SPACE['3']}`, background: t.surface, borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: SPACE['2'], fontSize: 11, color: t.textMuted, fontFamily: 'ui-monospace, monospace' }}>
          <span>{fmt(videoTime)} / {fmt(videoDuration)}</span>
          <span style={{ color: t.textDisabled }}>·</span>
          <span>{visibleItems.length} shown / {items.length} total</span>
          {!videoPaused && <span style={{ color: t.accent }}>▶ pause to annotate</span>}
        </div>
      )}
    </div>
  );
}

function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
