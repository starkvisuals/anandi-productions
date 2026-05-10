'use client';
import { useState, useEffect, useRef } from 'react';
import { DEFAULT_COLOR_LABELS } from '@/lib/workflow/constants';

// Keyboard shortcut → color key map (mirrors MainApp lightbox shortcuts)
const KEY_MAP = { p: 'red', m: 'yellow', g: 'green', b: 'blue', v: 'purple', o: 'orange', k: 'gray', u: null };
const COLOR_LABEL_COLORS = Object.fromEntries(DEFAULT_COLOR_LABELS.map(l => [l.key, l.hex]));

// ─── Single compare tile ──────────────────────────────────────────────────────
function CompareTile({ asset, t, onRate, onSelect, onColorLabel, onRemove, isFocused, onClick, count }) {
  const [localRating, setLocalRating] = useState(asset.rating || 0);
  const [localLabel, setLocalLabel] = useState(asset.colorLabel || null);
  const [localSelected, setLocalSelected] = useState(asset.isSelected || false);

  // Sync on asset change (e.g. after external update)
  useEffect(() => { setLocalRating(asset.rating || 0); }, [asset.rating]);
  useEffect(() => { setLocalLabel(asset.colorLabel || null); }, [asset.colorLabel]);
  useEffect(() => { setLocalSelected(asset.isSelected || false); }, [asset.isSelected]);

  const handleRate = (star) => {
    const newRating = localRating === star ? 0 : star;
    setLocalRating(newRating);
    onRate(asset.id, newRating);
  };

  const handleLabel = (key) => {
    const newLabel = localLabel === key ? null : key;
    setLocalLabel(newLabel);
    onColorLabel(asset.id, newLabel);
  };

  const handleSelect = () => {
    const next = !localSelected;
    setLocalSelected(next);
    onSelect(asset.id);
  };

  const smallControls = count >= 4;

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        borderRadius: '10px',
        overflow: 'hidden',
        border: isFocused ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isFocused ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Remove button — top-right X */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
        title="Remove from compare"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          lineHeight: 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.8)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
      >✕</button>

      {/* Focused indicator */}
      {isFocused && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          background: '#6366f1',
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '9px',
          fontWeight: '700',
          color: '#fff',
          zIndex: 20,
          letterSpacing: '0.05em',
        }}>FOCUS</div>
      )}

      {/* Image / Video area — takes all available height */}
      <div
        className="compare-img-area"
        style={{
          flex: 1,
          minHeight: 0,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {asset.type === 'video' ? (
          <video
            src={asset.url}
            poster={asset.thumbnail}
            controls
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
        ) : asset.type === 'image' && (asset.url || asset.thumbnail) ? (
          <img
            src={asset.url || asset.thumbnail}
            alt={asset.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No preview</div>
        )}

        {/* Color label stripe at bottom of image */}
        {localLabel && (
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '4px',
            background: COLOR_LABEL_COLORS[localLabel],
            zIndex: 5,
          }} />
        )}
      </div>

      {/* Controls bar */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          padding: smallControls ? '8px 10px' : '10px 12px',
          background: 'rgba(255,255,255,0.04)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        {/* Asset name */}
        <div style={{
          fontSize: '10px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.9)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }} title={asset.name}>
          {asset.name}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          {/* Star rating */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <span
                key={star}
                onClick={() => handleRate(star)}
                style={{
                  cursor: 'pointer',
                  fontSize: smallControls ? '13px' : '15px',
                  color: star <= localRating ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                  transition: 'transform 0.1s',
                  lineHeight: 1,
                }}
                onMouseEnter={e => e.target.style.transform = 'scale(1.3)'}
                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
              >★</span>
            ))}
          </div>

          {/* Select toggle */}
          <button
            onClick={handleSelect}
            style={{
              padding: '3px 8px',
              background: localSelected ? '#22c55e' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${localSelected ? '#22c55e' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '5px',
              color: '#fff',
              fontSize: '9px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {localSelected ? '✓ Sel' : '+ Sel'}
          </button>
        </div>

        {/* Color label swatches */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
          {DEFAULT_COLOR_LABELS.map(({ key, hex }) => (
            <button
              key={key}
              onClick={() => handleLabel(key)}
              title={key}
              style={{
                width: smallControls ? '12px' : '14px',
                height: smallControls ? '12px' : '14px',
                borderRadius: '50%',
                background: hex,
                border: localLabel === key ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
                opacity: localLabel && localLabel !== key ? 0.25 : 1,
                transition: 'all 0.15s',
                boxShadow: localLabel === key ? `0 0 5px ${hex}` : 'none',
                flexShrink: 0,
                outline: 'none',
              }}
            />
          ))}
          {localLabel && (
            <button
              onClick={() => handleLabel(localLabel)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '10px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
              title="Clear label"
            >✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compare strip thumbnail ──────────────────────────────────────────────────
function StripThumb({ asset, onRemove, onClick, isActive, t }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: '64px',
        height: '48px',
        borderRadius: '6px',
        overflow: 'hidden',
        border: isActive ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.12)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'border-color 0.15s',
      }}
    >
      {(asset.thumbnail || asset.url) ? (
        <img
          src={asset.thumbnail || asset.url}
          alt={asset.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
          {asset.type === 'video' ? '🎬' : '📄'}
        </div>
      )}
      {/* Color label dot */}
      {asset.colorLabel && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '3px',
          background: COLOR_LABEL_COLORS[asset.colorLabel],
        }} />
      )}
      {/* Remove X */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
        style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.75)',
          border: 'none',
          color: '#fff',
          fontSize: '9px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.9)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.75)'}
      >✕</button>
    </div>
  );
}

// ─── Main ComparePanel (embedded — not a fixed overlay) ──────────────────────
export default function ComparePanel({
  assets,            // array of asset objects in compare set
  t,                 // theme tokens
  theme,
  onRate,
  onSelect,
  onColorLabel,
  onRemove,          // (assetId) → remove one from compare
  onClose,           // () → clear all, exit compare
  onAddMore,         // () → hint to Cmd+click more images in grid
}) {
  const count = assets.length;
  const [focusIdx, setFocusIdx] = useState(0);

  // Keep focusIdx in range if assets removed
  useEffect(() => {
    if (focusIdx >= assets.length && assets.length > 0) {
      setFocusIdx(assets.length - 1);
    }
  }, [assets.length, focusIdx]);

  // Keyboard shortcuts: arrows switch focus, labels, rating, select, Esc=close
  useEffect(() => {
    const handler = (e) => {
      // Don't steal from inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { onClose(); return; }
      const asset = assets[focusIdx];
      if (!asset) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowleft') { setFocusIdx(i => Math.max(0, i - 1)); return; }
      if (key === 'arrowright') { setFocusIdx(i => Math.min(assets.length - 1, i + 1)); return; }
      if (key === 's') { onSelect(asset.id); return; }
      if (key in KEY_MAP) {
        onColorLabel(asset.id, KEY_MAP[key]);
        return;
      }
      const starNum = parseInt(key);
      if (starNum >= 1 && starNum <= 5) { onRate(asset.id, starNum); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusIdx, assets, onClose, onRate, onSelect, onColorLabel]);

  // Layout logic
  const is2x2 = count === 4;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      background: '#080808',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
            ⊞ Compare — {count} {count === 1 ? 'image' : 'images'}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '20px' }}>
            ←→ switch · P=pick · M=maybe · G=alt · 1–5=stars · S=select
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onAddMore && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
              ⌘+click to add more
            </span>
          )}
          <button
            onClick={onClose}
            title="Exit compare (Esc)"
            style={{
              padding: '5px 10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ✕ Exit Compare
          </button>
        </div>
      </div>

      {/* ── Compare tiles area ─────────────────────────────────── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: '12px',
        display: is2x2 ? 'grid' : 'flex',
        gridTemplateColumns: is2x2 ? '1fr 1fr' : undefined,
        gridTemplateRows: is2x2 ? '1fr 1fr' : undefined,
        flexDirection: is2x2 ? undefined : 'row',
        gap: '10px',
        overflow: 'hidden',
      }}>
        {assets.map((asset, idx) => (
          <CompareTile
            key={asset.id}
            asset={asset}
            t={t}
            count={count}
            isFocused={idx === focusIdx}
            onClick={() => setFocusIdx(idx)}
            onRate={onRate}
            onSelect={onSelect}
            onColorLabel={onColorLabel}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* ── Bottom filmstrip strip ─────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>In compare:</span>
        {assets.map((asset, idx) => (
          <StripThumb
            key={asset.id}
            asset={asset}
            isActive={idx === focusIdx}
            onClick={() => setFocusIdx(idx)}
            onRemove={onRemove}
            t={t}
          />
        ))}
        {assets.length < 4 && (
          <div style={{
            width: '64px',
            height: '48px',
            borderRadius: '6px',
            border: '2px dashed rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '9px',
            color: 'rgba(255,255,255,0.25)',
            textAlign: 'center',
            lineHeight: 1.3,
            padding: '4px',
          }}>⌘+click to add</div>
        )}
      </div>

      <style>{`
        .compare-img-area:hover { opacity: 0.97; }
      `}</style>
    </div>
  );
}
