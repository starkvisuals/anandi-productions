// components/workflow/blocks/SelectionRoundView.js
// E2: Desktop selection-round view. Client (or producer) reviews project assets,
// marks picks via color labels + stars + select toggle, then submits a snapshot.
import { useState, useCallback, useEffect, useRef } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_COLOR_LABELS } from '../../../lib/workflow/constants';

// Keyboard shortcut → color label key (same mapping as MainApp.js)
const COLOR_SHORTCUT_MAP = {
  red: 'P', yellow: 'M', green: 'G', blue: 'B', purple: 'V', orange: 'O', gray: 'K',
};
// Reverse: keyCode char → label key
const SHORTCUT_TO_COLOR = Object.fromEntries(
  Object.entries(COLOR_SHORTCUT_MAP).map(([color, key]) => [key, color])
);

// ── Star rating row ────────────────────────────────────────────────────────────
function StarRow({ rating = 0, onRate, size = 16, color = '#f59e0b', muteColor = 'rgba(255,255,255,0.25)' }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={e => { e.stopPropagation(); onRate(n === rating ? 0 : n); }}
          style={{
            fontSize: size,
            color: n <= (hovered || rating) ? color : muteColor,
            cursor: 'pointer',
            lineHeight: 1,
            transition: 'color 0.1s',
            userSelect: 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ── Color label swatch row ─────────────────────────────────────────────────────
function ColorSwatches({ currentLabel, onLabel, size = 14 }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {DEFAULT_COLOR_LABELS.map(({ key, label, hex }) => (
        <button
          key={key}
          title={`${label} (${COLOR_SHORTCUT_MAP[key]})`}
          onClick={e => { e.stopPropagation(); onLabel(currentLabel === key ? null : key); }}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: hex,
            border: currentLabel === key ? '2px solid #fff' : '2px solid transparent',
            cursor: 'pointer',
            padding: 0,
            outline: 'none',
            boxShadow: currentLabel === key ? `0 0 6px ${hex}` : 'none',
            opacity: currentLabel && currentLabel !== key ? 0.4 : 1,
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

// ── Lightbox ───────────────────────────────────────────────────────────────────
function Lightbox({ assets, initialIndex, onClose, onRate, onColorLabel, onToggleSelect, t, readonly = false }) {
  const [idx, setIdx] = useState(initialIndex);
  const asset = assets[idx];

  const prev = useCallback(() => setIdx(i => (i - 1 + assets.length) % assets.length), [assets.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % assets.length), [assets.length]);

  const colorLabel = asset?.colorLabel || null;
  const labelInfo = colorLabel ? DEFAULT_COLOR_LABELS.find(c => c.key === colorLabel) : null;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') { prev(); return; }
      if (e.key === 'ArrowRight') { next(); return; }
      if (!readonly) {
        if (e.key === 's' || e.key === 'S') { onToggleSelect(asset.id); return; }
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) { onRate(asset.id, num === asset.rating ? 0 : num); return; }
        const upper = e.key.toUpperCase();
        if (SHORTCUT_TO_COLOR[upper]) {
          const colorKey = SHORTCUT_TO_COLOR[upper];
          onColorLabel(asset.id, colorKey === colorLabel ? null : colorKey);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [asset, colorLabel, prev, next, onClose, onRate, onColorLabel, onToggleSelect]);

  if (!asset) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Image */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', maxWidth: '90vw', maxHeight: '75vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <img
          src={asset.previewUrl}
          alt={asset.name}
          style={{
            maxWidth: '90vw', maxHeight: '75vh',
            objectFit: 'contain', borderRadius: 6,
            boxShadow: '0 8px 48px rgba(0,0,0,0.7)',
          }}
        />

        {/* Selected badge */}
        {asset.isSelected && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: t.success, color: '#fff',
            borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700,
          }}>
            SELECTED
          </div>
        )}

        {/* Color label strip on bottom of image */}
        {labelInfo && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 5,
            background: labelInfo.hex, borderRadius: '0 0 6px 6px',
          }} />
        )}
      </div>

      {/* Controls panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          marginTop: 18, background: 'rgba(20,20,28,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: '16px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
          minWidth: 360, maxWidth: '90vw',
        }}
      >
        {/* Name + version */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{asset.name}</div>
            {asset.currentVersion && (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
                v{asset.currentVersion}
              </div>
            )}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'right' }}>
            {idx + 1} / {assets.length}
          </div>
        </div>

        {/* Star rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, width: 70 }}>Rating</span>
          {!readonly ? (
            <StarRow
              rating={asset.rating || 0}
              onRate={r => onRate(asset.id, r)}
              size={20}
            />
          ) : (
            <StarRow
              rating={asset.rating || 0}
              onRate={() => {}}
              size={20}
              muteColor="rgba(255,255,255,0.15)"
            />
          )}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>1–5</span>
        </div>

        {/* Color labels */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, width: 70 }}>Label</span>
          {!readonly ? (
            <ColorSwatches
              currentLabel={colorLabel}
              onLabel={key => onColorLabel(asset.id, key)}
              size={18}
            />
          ) : (
            labelInfo ? (
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                background: labelInfo.hex, display: 'inline-block',
                border: '2px solid rgba(255,255,255,0.5)',
              }} />
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>None</span>
            )
          )}
          {labelInfo && (
            <span style={{ color: labelInfo.hex, fontSize: 12, fontWeight: 600 }}>{labelInfo.label}</span>
          )}
        </div>

        {/* Select toggle */}
        {!readonly && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
            <button
              onClick={() => onToggleSelect(asset.id)}
              style={{
                flex: 1, padding: '9px 0',
                background: asset.isSelected ? t.success : 'rgba(255,255,255,0.07)',
                border: `1px solid ${asset.isSelected ? t.success : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              {asset.isSelected ? '✓ Selected' : 'Pick this'}
            </button>
          </div>
        )}

        {/* Keyboard hints */}
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 1.5 }}>
          {readonly
            ? '← → navigate &nbsp;·&nbsp; Esc close'
            : <>← → navigate &nbsp;·&nbsp; 1–5 rate &nbsp;·&nbsp; S select &nbsp;·&nbsp;
              {DEFAULT_COLOR_LABELS.map(c => `${COLOR_SHORTCUT_MAP[c.key]}=${c.label}`).join(' ')} &nbsp;·&nbsp; Esc close</>
          }
        </div>
      </div>

      {/* Prev / Next arrows */}
      {assets.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev(); }}
            style={{
              position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%', width: 44, height: 44,
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <button
            onClick={e => { e.stopPropagation(); next(); }}
            style={{
              position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%', width: 44, height: 44,
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: 16, right: 16,
          background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%', width: 36, height: 36,
          color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Asset card ─────────────────────────────────────────────────────────────────
function AssetCard({ asset, onOpen, onRate, onColorLabel, onToggleSelect, t, readonly = false }) {
  const [hovering, setHovering] = useState(false);
  const labelInfo = asset.colorLabel
    ? DEFAULT_COLOR_LABELS.find(c => c.key === asset.colorLabel)
    : null;

  return (
    <div
      onClick={() => onOpen(asset)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: t.bgCard,
        border: `1px solid ${asset.isSelected ? t.success : t.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: asset.isSelected
          ? '0 0 0 2px #22c55e40'
          : hovering ? '0 4px 20px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '3/2', overflow: 'hidden', background: '#111' }}>
        <img
          src={asset.previewUrl}
          alt={asset.name}
          loading="lazy"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform 0.2s',
            transform: hovering ? 'scale(1.03)' : 'scale(1)',
          }}
        />

        {/* Selected badge — top right */}
        {asset.isSelected && (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: t.success, color: '#fff',
            borderRadius: 5, padding: '2px 7px',
            fontSize: 11, fontWeight: 700, lineHeight: 1.4,
          }}>
            ✓
          </div>
        )}

        {/* Color label dot — bottom left */}
        {labelInfo && (
          <div style={{
            position: 'absolute', bottom: 7, left: 7,
            width: 10, height: 10, borderRadius: '50%',
            background: labelInfo.hex,
            border: '1.5px solid rgba(255,255,255,0.5)',
          }} />
        )}

        {/* Color label strip — very bottom */}
        {labelInfo && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 4, background: labelInfo.hex,
          }} />
        )}

        {/* Star rating overlay — bottom of image, shown on hover */}
        {!readonly && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            padding: '18px 8px 8px',
            display: 'flex', alignItems: 'center', gap: 4,
            opacity: hovering || asset.rating ? 1 : 0,
            transition: 'opacity 0.15s',
            pointerEvents: hovering ? 'auto' : 'none',
          }}>
            <StarRow
              rating={asset.rating || 0}
              onRate={r => onRate(asset.id, r)}
              size={14}
            />
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{ padding: '8px 10px', background: t.bgCard }}>
        <div style={{
          fontSize: 12, color: t.text, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {asset.name}
        </div>
        {asset.currentVersion && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>v{asset.currentVersion}</div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SelectionRoundView({
  project,
  block,
  actorId,
  isProducer,
  t,
  theme,
  onBlockAdvance,
  onRate,
  onColorLabel,
  onToggleSelect,
}) {
  const [lightboxAsset, setLightboxAsset] = useState(null);
  const [filterStar, setFilterStar] = useState(null);   // null | 3 | 4 | 5
  const [filterColor, setFilterColor] = useState(null); // null | color key
  const [sortBy, setSortBy] = useState('default');      // 'default' | 'rating' | 'name' | 'selected'
  const [submitting, setSubmitting] = useState(false);

  const assets = project?.assets || [];
  const selectionGoal = block?.config?.selectionGoal || null;

  // Derived stats
  const selectedCount = assets.filter(a => a.isSelected).length;
  const labeledCount = assets.filter(a => a.colorLabel).length;

  // Picks = isSelected OR colorLabel === 'red'
  const picks = assets.filter(a => a.isSelected || a.colorLabel === 'red');

  // Filtered + sorted visible assets
  const visible = assets
    .filter(a => {
      if (filterStar && (a.rating || 0) < filterStar) return false;
      if (filterColor && a.colorLabel !== filterColor) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'selected') return (b.isSelected ? 1 : 0) - (a.isSelected ? 1 : 0);
      return 0;
    });

  // Lightbox index within *visible* list so arrows navigate filtered set
  const lightboxIndex = lightboxAsset
    ? visible.findIndex(a => a.id === lightboxAsset.id)
    : -1;

  const openLightbox = useCallback((asset) => {
    setLightboxAsset(asset);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxAsset(null);
  }, []);

  // Keep lightbox asset data in sync when props update (rating/label/select changes)
  useEffect(() => {
    setLightboxAsset(prev => prev ? (assets.find(a => a.id === prev.id) ?? prev) : null);
  }, [assets]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const snapRef = await addDoc(
        collection(db, 'projects', project.id, 'selectionSnapshots'),
        {
          blockId: block.id,
          submittedBy: actorId,
          submittedAt: serverTimestamp(),
          pickCount: picks.length,
          assets: picks.map(a => ({
            id: a.id,
            name: a.name,
            colorLabel: a.colorLabel,
            rating: a.rating,
            isSelected: a.isSelected,
          })),
        }
      );
      onBlockAdvance(snapRef.id, picks.length);
    } catch (err) {
      console.error('[SelectionRoundView] submit error:', err);
    }
    setSubmitting(false);
  }, [project.id, block.id, actorId, picks, onBlockAdvance]);

  // Force-submit (producer — submits whatever state exists, even 0 picks)
  const handleForceSubmit = useCallback(async () => {
    if (!confirm('Force submit the current selection state? This will advance the workflow without waiting for the client to submit.')) return;
    setSubmitting(true);
    try {
      const allSelected = assets.filter(a => a.isSelected || a.colorLabel === 'red');
      const forceRef = await addDoc(
        collection(db, 'projects', project.id, 'selectionSnapshots'),
        {
          blockId: block.id,
          submittedBy: actorId,
          submittedAt: serverTimestamp(),
          pickCount: allSelected.length,
          forced: true,
          assets: allSelected.map(a => ({
            id: a.id,
            name: a.name,
            colorLabel: a.colorLabel,
            rating: a.rating,
            isSelected: a.isSelected,
          })),
        }
      );
      onBlockAdvance(forceRef.id, allSelected.length);
    } catch (err) {
      console.error('[SelectionRoundView] force-submit error:', err);
    }
    setSubmitting(false);
  }, [assets, project.id, block.id, actorId, onBlockAdvance]);

  // Safe-wrapped callbacks — lightbox survives if a handler throws
  const safeRate = useCallback(async (id, r) => {
    try { await onRate(id, r); } catch (e) { console.error('[SelectionRound] onRate error', e); }
  }, [onRate]);

  const safeColorLabel = useCallback(async (id, label) => {
    try { await onColorLabel(id, label); } catch (e) { console.error('[SelectionRound] onColorLabel error', e); }
  }, [onColorLabel]);

  const safeToggleSelect = useCallback(async (id) => {
    try { await onToggleSelect(id); } catch (e) { console.error('[SelectionRound] onToggleSelect error', e); }
  }, [onToggleSelect]);

  // Active filter pill style helper
  const pillStyle = (active) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? t.primary : t.bgCard,
    color: active ? '#fff' : t.textMuted,
    border: `1px solid ${active ? t.primary : t.border}`,
    cursor: 'pointer', outline: 'none', transition: 'all 0.13s',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: t.bg || t.bgCard, color: t.text,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '20px 24px 14px',
        borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>
              {block?.label || 'Select Images'}
            </h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              <StatBadge label="Selected" value={selectedCount} color={t.success} t={t} />
              <StatBadge label="Labeled" value={labeledCount} color={t.primary} t={t} />
              <StatBadge label="Total" value={assets.length} color={t.textMuted} t={t} />
              {selectionGoal && (
                <StatBadge
                  label="Goal"
                  value={`${picks.length} / ${selectionGoal}`}
                  color={picks.length >= selectionGoal ? t.success : t.warning}
                  t={t}
                />
              )}
            </div>
          </div>
          {assets.length === 0 && (
            <div style={{ color: t.textMuted, fontSize: 13 }}>No assets to review yet.</div>
          )}
        </div>

        {isProducer && (
          <div style={{
            margin: '12px 0 0',
            padding: '8px 16px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 8,
            fontSize: 12,
            color: t.warning,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            🔒 Producer view — read-only. The client's selections are shown below. Use <strong>Force Submit</strong> to advance the project without waiting.
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        padding: '10px 24px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        flexShrink: 0,
        background: t.bgCard,
      }}>
        {/* Star filters */}
        <button style={pillStyle(!filterStar && !filterColor)} onClick={() => { setFilterStar(null); setFilterColor(null); }}>
          All
        </button>
        {[3, 4, 5].map(n => (
          <button key={n} style={pillStyle(filterStar === n)} onClick={() => setFilterStar(filterStar === n ? null : n)}>
            {'★'.repeat(n)}+
          </button>
        ))}

        {/* Color filters */}
        {DEFAULT_COLOR_LABELS.map(({ key, label, hex }) => (
          <button
            key={key}
            style={{
              ...pillStyle(filterColor === key),
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            onClick={() => setFilterColor(filterColor === key ? null : key)}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </button>
        ))}

        {/* Sort dropdown */}
        <div style={{ marginLeft: 'auto' }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '5px 10px', fontSize: 13,
              background: t.bgCard, color: t.text,
              border: `1px solid ${t.border}`, borderRadius: 8,
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="default">Default order</option>
            <option value="rating">Rating ↓</option>
            <option value="selected">Selected first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* ── Asset grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 100px' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted, fontSize: 14 }}>
            {assets.length === 0
              ? 'No assets available for selection.'
              : 'No assets match the current filters.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14,
          }}>
            {visible.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onOpen={openLightbox}
                onRate={safeRate}
                onColorLabel={safeColorLabel}
                onToggleSelect={safeToggleSelect}
                t={t}
                readonly={isProducer}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        position: 'sticky', bottom: 0,
        borderTop: `1px solid ${t.border}`,
        background: t.bgCard,
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
        zIndex: 10,
      }}>
        {!isProducer && (
          <button
            onClick={handleSubmit}
            disabled={submitting || picks.length === 0}
            style={{
              padding: '10px 28px', borderRadius: 9, fontWeight: 700, fontSize: 15,
              background: picks.length > 0 ? t.success : 'rgba(34,197,94,0.3)',
              color: picks.length > 0 ? '#fff' : 'rgba(255,255,255,0.5)',
              border: 'none', cursor: picks.length > 0 && !submitting ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting…' : `Submit Selection (${picks.length} pick${picks.length !== 1 ? 's' : ''})`}
          </button>
        )}

        {isProducer && (
          <button
            onClick={handleForceSubmit}
            disabled={submitting}
            style={{
              padding: '10px 20px', borderRadius: 9, fontWeight: 600, fontSize: 14,
              background: 'transparent',
              color: submitting ? t.textMuted : t.warning,
              border: `1px solid ${submitting ? t.border : t.warning}`,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Force Submit
          </button>
        )}

        <div style={{ marginLeft: 'auto', color: t.textMuted, fontSize: 13 }}>
          {visible.length} of {assets.length} shown
          {selectionGoal && picks.length >= selectionGoal && (
            <span style={{ marginLeft: 10, color: t.success, fontWeight: 600 }}>
              Goal reached
            </span>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxAsset && lightboxIndex !== -1 && (
        <Lightbox
          assets={visible}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
          onRate={safeRate}
          onColorLabel={safeColorLabel}
          onToggleSelect={safeToggleSelect}
          t={t}
          readonly={isProducer}
        />
      )}
    </div>
  );
}

// ── Small helper sub-component (no separate file needed) ─────────────────────
function StatBadge({ label, value, color, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color, fontWeight: 700, fontSize: 15 }}>{value}</span>
      <span style={{ color: t ? t.textMuted : 'rgba(128,128,128,0.8)', fontSize: 12 }}>{label}</span>
    </div>
  );
}
