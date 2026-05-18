'use client';
/**
 * Standalone test page for FilterPanel.
 * Visit:  /test/filters
 */

import { useState, useMemo } from 'react';
import FilterPanel, { applyAssetFilter } from '@/components/filters/FilterPanel';

// Mock dataset — 50 fake assets with varied ratings + colorLabels
const MOCK_ASSETS = Array.from({ length: 50 }).map((_, i) => {
  const ratings = [0, 0, 0, 1, 2, 3, 4, 5];
  const colors = [null, null, null, 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];
  return {
    id: `mock-${i}`,
    name: `IMG_${1000 + i}.jpg`,
    rating: ratings[i % ratings.length],
    colorLabel: colors[i % colors.length],
    thumbnail: `https://picsum.photos/seed/${i}/200/150`,
  };
});

export default function TestFiltersPage() {
  const [filter, setFilter] = useState({ rating: null, colorLabel: null, search: '' });
  const filtered = useMemo(() => applyAssetFilter(MOCK_ASSETS, filter), [filter]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      display: 'flex',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <FilterPanel
        assets={MOCK_ASSETS}
        value={filter}
        onChange={setFilter}
        width={260}
      />

      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '18px' }}>🧪 FilterPanel Test Bench</h1>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '16px' }}>
          {filtered.length} of {MOCK_ASSETS.length} assets shown
          {filter.rating !== null && <span> · rating={filter.rating}</span>}
          {filter.colorLabel !== null && <span> · color={filter.colorLabel || 'none'}</span>}
          {filter.search && <span> · search="{filter.search}"</span>}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '10px',
        }}>
          {filtered.map(a => (
            <div key={a.id} style={{
              borderRadius: '8px', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              background: '#111',
            }}>
              <img src={a.thumbnail} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '8px 10px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{a.name}</span>
                  <span style={{ color: '#fbbf24' }}>{'★'.repeat(a.rating)}</span>
                </div>
                {a.colorLabel && (
                  <div style={{
                    display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                    fontSize: '9px', background: 'rgba(255,255,255,0.1)',
                  }}>{a.colorLabel}</div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
              No assets match the active filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
