// components/workflow/blocks/SelectionMobile.js
// E3: Mobile-first swipe card interface for SelectionRound.
// Pointer-event driven card swipe with auto-advance, quick color/star/select
// actions, and a completion screen.
import { useState, useCallback, useRef, useEffect } from 'react';
import { DEFAULT_COLOR_LABELS } from '../../../lib/workflow/constants';

const SWIPE_THRESHOLD = 80; // px
const TILT_FACTOR = 0.05;   // deg/px

// Top 3 quick-pick color labels shown in action row
const QUICK_LABELS = DEFAULT_COLOR_LABELS.slice(0, 3); // red, yellow, green

// ── Star rating row ────────────────────────────────────────────────────────────
function StarRow({ rating = 0, onRate, size = 22, color = '#f59e0b', muteColor = 'rgba(255,255,255,0.25)' }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onPointerDown={e => { e.stopPropagation(); onRate(n === rating ? 0 : n); }}
          style={{
            fontSize: size,
            color: n <= rating ? color : muteColor,
            cursor: 'pointer',
            lineHeight: 1,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ── Completion screen ──────────────────────────────────────────────────────────
function CompletionScreen({ assets, onDone, t }) {
  const selectedCount = assets.filter(a => a.isSelected).length;
  const labeledCount = assets.filter(a => a.colorLabel).length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '40px 24px', textAlign: 'center',
      background: t.bg || t.bgCard, color: t.text,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(34,197,94,0.15)',
        border: '2px solid #22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20,
      }}>
        ✓
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginBottom: 8 }}>
        All images reviewed
      </div>
      <div style={{ fontSize: 15, color: t.textMuted, marginBottom: 32 }}>
        {selectedCount} selected · {labeledCount} labeled
      </div>
      <button
        onPointerDown={onDone}
        style={{
          padding: '14px 40px', borderRadius: 12, fontWeight: 700, fontSize: 16,
          background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        Done
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SelectionMobile({
  assets,
  t,
  onRate,
  onColorLabel,
  onToggleSelect,
  onDone,
}) {
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false); // animating card out

  const pointerStartX = useRef(null);
  const pointerStartY = useRef(null);
  const cardRef = useRef(null);
  const autoAdvanceTimer = useRef(null);

  const safeRate = useCallback(async (assetId, rating) => {
    try { await onRate(assetId, rating); } catch (e) { console.error('[SelectionMobile] onRate error', e); }
  }, [onRate]);

  const safeColorLabel = useCallback(async (assetId, label) => {
    try { await onColorLabel(assetId, label); } catch (e) { console.error('[SelectionMobile] onColorLabel error', e); }
  }, [onColorLabel]);

  const safeToggleSelect = useCallback(async (assetId) => {
    try { await onToggleSelect(assetId); } catch (e) { console.error('[SelectionMobile] onToggleSelect error', e); }
  }, [onToggleSelect]);

  const safeDone = useCallback(() => {
    try { onDone(); } catch (e) { console.error('[SelectionMobile] onDone error', e); }
  }, [onDone]);

  const advance = useCallback(() => {
    setIdx(prev => Math.min(prev + 1, assets.length));
  }, [assets.length]);

  const autoAdvance = useCallback(() => {
    clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => setIdx(prev => Math.min(prev + 1, assets.length - 1)), 300);
  }, [assets.length]);

  useEffect(() => () => clearTimeout(autoAdvanceTimer.current), []);

  // ── Pointer event handlers ───────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (exiting) return;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    setDragging(true);
    setDragX(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [exiting]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging || pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    setDragX(dx);
  }, [dragging]);

  const handlePointerUp = useCallback(async (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!dragging || pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;
    setDragging(false);

    const isHorizontalSwipe = Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dy) < 60;

    if (isHorizontalSwipe) {
      const asset = assets[idx];
      setExiting(true);
      if (dx >= SWIPE_THRESHOLD && asset) {
        // Swipe right → select (only if not already selected)
        if (!asset.isSelected) await safeToggleSelect(asset.id);
      }
      // Either direction: advance after animation
      setTimeout(() => {
        setDragX(0);
        setExiting(false);
        advance();
      }, 250);
    } else {
      // Snap back
      setDragX(0);
    }

    pointerStartX.current = null;
    pointerStartY.current = null;
  }, [dragging, idx, assets, safeToggleSelect, advance]);

  const handlePointerCancel = useCallback((e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setExiting(false);
    setDragX(0);
    setDragging(false);
    pointerStartX.current = null;
    pointerStartY.current = null;
  }, []);

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (!assets || assets.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: t.textMuted, fontSize: 15,
        background: t.bg || t.bgCard,
      }}>
        No images to review.
      </div>
    );
  }

  if (idx >= assets.length) {
    return <CompletionScreen assets={assets} onDone={onDone} t={t} />;
  }

  const asset = assets[idx];
  const labelInfo = asset.colorLabel
    ? DEFAULT_COLOR_LABELS.find(c => c.key === asset.colorLabel)
    : null;

  // Card transform during drag
  const tiltDeg = dragX * TILT_FACTOR;
  const cardTransform = dragging || exiting
    ? `rotate(${tiltDeg}deg) translateX(${dragX}px)`
    : 'rotate(0deg) translateX(0px)';
  const cardTransition = dragging ? 'none' : 'transform 0.25s ease';

  // Overlay state
  const showPickOverlay = dragX > 40;
  const showSkipOverlay = dragX < -40;

  // Progress percent
  const progressPct = ((idx + 1) / assets.length) * 100;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: t.bg || t.bgCard, color: t.text,
      overflow: 'hidden',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Progress bar ── */}
      <div style={{
        height: 4, background: 'rgba(255,255,255,0.1)', flexShrink: 0,
      }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: t.primary || '#6366f1',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* ── Progress label ── */}
      <div style={{
        padding: '10px 20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: t.textMuted }}>
          {idx + 1} / {assets.length}
        </span>
        <span style={{ fontSize: 13, color: t.textMuted }}>
          {assets.filter(a => a.isSelected).length} picked
        </span>
      </div>

      {/* ── Card area ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 20px', overflow: 'hidden',
      }}>
        <div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            position: 'relative',
            transform: cardTransform,
            transition: cardTransition,
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            background: '#111',
          }}
        >
          {/* Image */}
          <div style={{ aspectRatio: '3/2', position: 'relative', overflow: 'hidden' }}>
            <img
              src={asset.previewUrl}
              alt={asset.name}
              draggable={false}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
                pointerEvents: 'none',
              }}
            />

            {/* Pick overlay (swipe right) */}
            {showPickOverlay && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(34,197,94,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 36, fontWeight: 800, color: '#fff',
                  textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  letterSpacing: 2,
                }}>
                  ✓ PICK
                </span>
              </div>
            )}

            {/* Skip overlay (swipe left) */}
            {showSkipOverlay && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(100,100,100,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 36, fontWeight: 800, color: '#fff',
                  textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  letterSpacing: 2,
                }}>
                  SKIP
                </span>
              </div>
            )}

            {/* Selected badge */}
            {asset.isSelected && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: '#22c55e', color: '#fff',
                borderRadius: 6, padding: '3px 9px',
                fontSize: 12, fontWeight: 700,
              }}>
                ✓ PICKED
              </div>
            )}

            {/* Color label strip */}
            {labelInfo && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 5, background: labelInfo.hex,
              }} />
            )}
          </div>

          {/* Card footer — name + version */}
          <div style={{
            padding: '10px 14px 12px',
            background: 'rgba(0,0,0,0.85)',
          }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {asset.name}
            </div>
            {asset.currentVersion && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                v{asset.currentVersion}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Swipe hint ── */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)',
        paddingBottom: 6, flexShrink: 0,
      }}>
        ← skip &nbsp;·&nbsp; swipe to pick →
      </div>

      {/* ── Action row ── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px',
        borderTop: `1px solid ${t.border}`,
        background: t.bgCard || 'rgba(20,20,28,0.97)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Star rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: t.textMuted, width: 52, flexShrink: 0 }}>Rating</span>
          <StarRow
            rating={asset.rating || 0}
            onRate={async (r) => {
              await safeRate(asset.id, r);
              autoAdvance();
            }}
            size={24}
          />
        </div>

        {/* Quick color labels */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: t.textMuted, width: 52, flexShrink: 0 }}>Label</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {QUICK_LABELS.map(({ key, label, hex }) => {
              const isActive = asset.colorLabel === key;
              return (
                <button
                  key={key}
                  onPointerDown={async (e) => {
                    e.stopPropagation();
                    await safeColorLabel(asset.id, isActive ? null : key);
                    autoAdvance();
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: isActive ? 700 : 500,
                    background: isActive ? hex : 'rgba(255,255,255,0.07)',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                    border: `1.5px solid ${isActive ? hex : 'rgba(255,255,255,0.12)'}`,
                    cursor: 'pointer', outline: 'none',
                    transition: 'all 0.15s',
                    touchAction: 'manipulation',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isActive ? '#fff' : hex,
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Select toggle */}
        <button
          onPointerDown={async (e) => {
            e.stopPropagation();
            await safeToggleSelect(asset.id);
            autoAdvance();
          }}
          style={{
            width: '100%', padding: '11px 0',
            background: asset.isSelected ? '#22c55e' : 'rgba(255,255,255,0.07)',
            border: `1.5px solid ${asset.isSelected ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
            touchAction: 'manipulation',
          }}
        >
          {asset.isSelected ? '✓ Picked' : '✓ Pick this'}
        </button>
      </div>

      {/* ── Nav footer ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', gap: 10, padding: '10px 16px 14px',
        borderTop: `1px solid ${t.border}`,
        background: t.bgCard || 'rgba(20,20,28,0.97)',
      }}>
        <button
          onPointerDown={() => setIdx(prev => Math.max(prev - 1, 0))}
          disabled={idx === 0}
          style={{
            flex: 1, padding: '11px 0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, color: idx === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
            fontWeight: 600, fontSize: 14, cursor: idx === 0 ? 'not-allowed' : 'pointer',
            touchAction: 'manipulation',
          }}
        >
          ← Prev
        </button>

        <button
          onPointerDown={() => {
            if (idx >= assets.length - 1) {
              safeDone();
            } else {
              advance();
            }
          }}
          style={{
            flex: 1, padding: '11px 0',
            background: idx >= assets.length - 1 ? (t.primary || '#6366f1') : 'rgba(255,255,255,0.06)',
            border: `1px solid ${idx >= assets.length - 1 ? (t.primary || '#6366f1') : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 10, color: '#fff',
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {idx >= assets.length - 1 ? 'Done →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
