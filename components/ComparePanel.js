'use client';
import { useState } from 'react';

const COLOR_LABEL_COLORS = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#22c55e',
};

function CompareTile({ asset, t, onRate, onSelect, onColorLabel, onOpenLightbox, tileCount }) {
  const [localAsset, setLocalAsset] = useState(asset);

  const handleRate = (star) => {
    const newRating = localAsset.rating === star ? 0 : star;
    setLocalAsset(prev => ({ ...prev, rating: newRating }));
    onRate(asset.id, newRating);
  };

  const handleSelect = () => {
    const newSelected = !localAsset.isSelected;
    setLocalAsset(prev => ({ ...prev, isSelected: newSelected }));
    onSelect(asset.id);
  };

  const handleLabel = (label) => {
    const newLabel = localAsset.colorLabel === label ? null : label;
    setLocalAsset(prev => ({ ...prev, colorLabel: newLabel }));
    onColorLabel(asset.id, label);
  };

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: t.bgCard,
      borderRadius: '12px',
      overflow: 'hidden',
      border: `1px solid ${t.border}`,
      position: 'relative',
    }}>
      {/* Image / Video area */}
      <div
        onClick={() => onOpenLightbox(asset)}
        style={{
          flex: 1,
          minHeight: 0,
          background: '#000',
          cursor: 'pointer',
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
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No preview</div>
        )}

        {/* Color label stripe */}
        {localAsset.colorLabel && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: COLOR_LABEL_COLORS[localAsset.colorLabel],
            zIndex: 5,
          }} />
        )}

        {/* Open in lightbox hint */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.7)',
          opacity: 0,
          transition: 'opacity 0.2s',
        }}
          className="open-hint"
        >
          ⛶ Expand
        </div>
      </div>

      {/* Controls bar */}
      <div style={{
        padding: '10px 12px',
        background: t.bgSecondary,
        borderTop: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
      }}>
        {/* Asset name */}
        <div style={{
          fontSize: '11px',
          fontWeight: '600',
          color: t.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }} title={asset.name}>
          {asset.name}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {/* Star rating */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <span
                key={star}
                onClick={() => handleRate(star)}
                style={{
                  cursor: 'pointer',
                  fontSize: tileCount > 3 ? '14px' : '16px',
                  color: star <= (localAsset.rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.25)',
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
              padding: '4px 10px',
              background: localAsset.isSelected ? '#22c55e' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${localAsset.isSelected ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '6px',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {localAsset.isSelected ? '✓ Selected' : '+ Select'}
          </button>
        </div>

        {/* Color label swatches */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Label:</span>
          {[
            { key: 'red', label: 'Pick' },
            { key: 'yellow', label: 'Maybe' },
            { key: 'green', label: 'Alt' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleLabel(key)}
              title={label}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: COLOR_LABEL_COLORS[key],
                border: localAsset.colorLabel === key
                  ? '2px solid #fff'
                  : '2px solid transparent',
                cursor: 'pointer',
                opacity: localAsset.colorLabel && localAsset.colorLabel !== key ? 0.35 : 1,
                transition: 'all 0.15s',
                boxShadow: localAsset.colorLabel === key
                  ? `0 0 8px ${COLOR_LABEL_COLORS[key]}`
                  : 'none',
                flexShrink: 0,
                outline: 'none',
              }}
            />
          ))}
          {localAsset.colorLabel && (
            <button
              onClick={() => handleLabel(localAsset.colorLabel)}
              style={{
                background: 'transparent',
                border: 'none',
                color: t.textMuted,
                fontSize: '11px',
                cursor: 'pointer',
                padding: '0 2px',
                lineHeight: 1,
              }}
              title="Clear label"
            >✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComparePanel({ assets, t, theme, onRate, onSelect, onColorLabel, onOpenLightbox, onClose }) {
  const count = assets.length;

  // Layout: 2 → side by side, 3 → three columns, 4 → 2×2
  const is2x2 = count === 4;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.95)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
      }}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      tabIndex={-1}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: t.bgSecondary,
        borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: t.text }}>
            ⊞ Comparing {count} {count === 1 ? 'image' : 'images'}
          </span>
          <span style={{ fontSize: '11px', color: t.textMuted }}>
            Click any image to open in lightbox
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: t.textMuted }}>P=pick · M=maybe · G=alt</span>
          <button
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >✕</button>
        </div>
      </div>

      {/* Tiles area */}
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: '16px',
        display: is2x2 ? 'grid' : 'flex',
        gridTemplateColumns: is2x2 ? '1fr 1fr' : undefined,
        gridTemplateRows: is2x2 ? '1fr 1fr' : undefined,
        flexDirection: is2x2 ? undefined : 'row',
        gap: '12px',
        overflow: 'hidden',
      }}>
        {assets.map(asset => (
          <CompareTile
            key={asset.id}
            asset={asset}
            t={t}
            theme={theme}
            tileCount={count}
            onRate={onRate}
            onSelect={onSelect}
            onColorLabel={onColorLabel}
            onOpenLightbox={onOpenLightbox}
          />
        ))}
      </div>

      <style>{`
        .open-hint { pointer-events: none; }
        div:hover > div > div > .open-hint { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
