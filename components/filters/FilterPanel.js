'use client';
/**
 * FilterPanel — Capture One-style filter sidebar.
 *
 * Self-contained, purely presentational. No Firebase, no MainApp coupling.
 * Parent passes `assets` (any array of objects with `rating` and `colorLabel`
 * fields) and `value` / `onChange` for the active filter.
 *
 * Visual goal:
 *   ▼ Rating
 *      None       320
 *      ★          0
 *      ★★         0
 *      ...
 *   ▼ Color Tag
 *      [□] None   320
 *      [■] Red    0
 *      ...
 *
 * Filter shape:
 *   { rating: number | null, colorLabel: string | null, search: string }
 *
 * Mobile: collapses each section. Touch-friendly 36px row height.
 */

import { useMemo, useState, useCallback } from 'react';

// Match your existing DEFAULT_COLOR_LABELS palette (Capture One default 7)
const COLOR_TAGS = [
  { key: 'red',    label: 'Red',    hex: '#dc2626' },
  { key: 'orange', label: 'Orange', hex: '#ea580c' },
  { key: 'yellow', label: 'Yellow', hex: '#eab308' },
  { key: 'green',  label: 'Green',  hex: '#16a34a' },
  { key: 'blue',   label: 'Blue',   hex: '#2563eb' },
  { key: 'purple', label: 'Pink',   hex: '#db2777' }, // mapped: your 'purple' → Pink dot per Capture One UX
  { key: 'gray',   label: 'Purple', hex: '#7c3aed' }, // optional, repurpose 'gray' slot
];

const RATINGS = [1, 2, 3, 4, 5];

const EMPTY = { rating: null, colorLabel: null, search: '' };

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SectionHeader({ label, open, onToggle, action }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 4px', cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{
        display: 'inline-block',
        transition: 'transform 0.15s',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        fontSize: '10px', color: 'rgba(255,255,255,0.5)',
      }}>▼</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
      {action && <div style={{ marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>{action}</div>}
    </div>
  );
}

function FilterRow({ active, leading, label, count, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '6px 8px', borderRadius: '6px',
        cursor: 'pointer',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        transition: 'background 0.12s',
        minHeight: '32px',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {leading && <div style={{ flexShrink: 0, width: '20px', display: 'flex', justifyContent: 'center' }}>{leading}</div>}
      <span style={{
        flex: 1,
        fontSize: '12px',
        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
        fontWeight: active ? 600 : 400,
      }}>{label}</span>
      <span style={{
        fontSize: '11px',
        padding: '1px 8px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.06)',
        color: count > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
        fontFeatureSettings: '"tnum"',
        minWidth: '32px',
        textAlign: 'center',
      }}>{count}</span>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function FilterPanel({
  assets = [],
  value = EMPTY,
  onChange,
  width = 260,
}) {
  const [openRating, setOpenRating] = useState(true);
  const [openColor, setOpenColor] = useState(true);
  const [search, setSearch] = useState(value.search || '');

  // Live counts — recomputed only when assets change
  const counts = useMemo(() => {
    const ratingCounts = { none: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const colorCounts = { none: 0 };
    COLOR_TAGS.forEach(t => { colorCounts[t.key] = 0; });

    for (const a of assets) {
      const r = Number(a?.rating) || 0;
      if (r === 0) ratingCounts.none++;
      else if (ratingCounts[r] !== undefined) ratingCounts[r]++;

      const c = a?.colorLabel;
      if (!c) colorCounts.none++;
      else if (colorCounts[c] !== undefined) colorCounts[c]++;
    }
    return { ratingCounts, colorCounts };
  }, [assets]);

  const setFilter = useCallback((patch) => {
    if (onChange) onChange({ ...value, ...patch });
  }, [onChange, value]);

  const hasActiveFilter = value.rating !== null || value.colorLabel !== null || (value.search || '').length > 0;

  return (
    <div style={{
      width: typeof width === 'number' ? `${width}px` : width,
      flexShrink: 0,
      height: '100%',
      background: '#0f0f10',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      color: '#fff',
      overflow: 'hidden',
    }}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>▼</span>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>Filters</span>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {hasActiveFilter && (
            <button
              onClick={() => { setSearch(''); if (onChange) onChange(EMPTY); }}
              title="Clear all filters"
              style={{
                padding: '3px 8px', borderRadius: '5px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', fontSize: '10px', cursor: 'pointer',
              }}
            >Clear</button>
          )}
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilter({ search: e.target.value }); }}
            placeholder="Search"
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: '12px',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setFilter({ search: '' }); }}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ── Scrollable section list ──────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px' }}>

        {/* Rating ----------------------------------------------- */}
        <SectionHeader label="Rating" open={openRating} onToggle={() => setOpenRating(o => !o)} />
        {openRating && (
          <div style={{ paddingLeft: '4px' }}>
            <FilterRow
              active={value.rating === 0}
              leading={<span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>—</span>}
              label="None"
              count={counts.ratingCounts.none}
              onClick={() => setFilter({ rating: value.rating === 0 ? null : 0 })}
            />
            {RATINGS.map(r => (
              <FilterRow
                key={r}
                active={value.rating === r}
                leading={
                  <span style={{ display: 'inline-flex', gap: '1px' }}>
                    {Array.from({ length: r }).map((_, i) => (
                      <span key={i} style={{ color: '#fbbf24', fontSize: '11px', lineHeight: 1 }}>★</span>
                    ))}
                  </span>
                }
                label=""
                count={counts.ratingCounts[r]}
                onClick={() => setFilter({ rating: value.rating === r ? null : r })}
              />
            ))}
          </div>
        )}

        {/* Color Tag -------------------------------------------- */}
        <SectionHeader label="Color Tag" open={openColor} onToggle={() => setOpenColor(o => !o)} />
        {openColor && (
          <div style={{ paddingLeft: '4px' }}>
            <FilterRow
              active={value.colorLabel === ''}
              leading={
                <span style={{
                  display: 'inline-block', width: '12px', height: '12px',
                  border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '3px',
                }} />
              }
              label="None"
              count={counts.colorCounts.none}
              onClick={() => setFilter({ colorLabel: value.colorLabel === '' ? null : '' })}
            />
            {COLOR_TAGS.map(tag => (
              <FilterRow
                key={tag.key}
                active={value.colorLabel === tag.key}
                leading={
                  <span style={{
                    display: 'inline-block', width: '12px', height: '12px',
                    borderRadius: '3px', background: tag.hex,
                    border: '1px solid rgba(0,0,0,0.3)',
                  }} />
                }
                label={tag.label}
                count={counts.colorCounts[tag.key] || 0}
                onClick={() => setFilter({ colorLabel: value.colorLabel === tag.key ? null : tag.key })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper: apply filter to an asset list ───────────────────────────────────
// Keep filter logic next to the panel so callers don't reinvent it.
export function applyAssetFilter(assets, filter) {
  if (!filter) return assets;
  const q = (filter.search || '').trim().toLowerCase();
  return assets.filter(a => {
    if (filter.rating !== null && filter.rating !== undefined) {
      const r = Number(a.rating) || 0;
      if (filter.rating === 0) { if (r !== 0) return false; }
      else if (r !== filter.rating) return false;
    }
    if (filter.colorLabel !== null && filter.colorLabel !== undefined) {
      if (filter.colorLabel === '') { if (a.colorLabel) return false; }
      else if (a.colorLabel !== filter.colorLabel) return false;
    }
    if (q && !(a.name || '').toLowerCase().includes(q)) return false;
    return true;
  });
}
