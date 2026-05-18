'use client';
/**
 * Standalone test page for MarkerAnnotator.
 * Visit:  /test/annotate
 *
 * Purpose: verify the annotation editor works in isolation BEFORE wiring
 * it into MainApp.js. No Firebase, no MainApp, no other state.
 *
 * Use the test image URL field at the top to point at any image (paste any
 * URL from your project's Firebase Storage or any public image).
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';

const MarkerAnnotator = dynamic(
  () => import('@/components/annotation/MarkerAnnotator'),
  { ssr: false, loading: () => <div style={{ padding: 40, color: '#888' }}>Loading editor…</div> }
);

const MarkerViewer = dynamic(
  () => import('@/components/annotation/MarkerViewer'),
  { ssr: false }
);

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600';

export default function TestAnnotatePage() {
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMG);
  const [draftUrl, setDraftUrl] = useState(DEFAULT_IMG);
  const [savedState, setSavedState] = useState(null);
  const [mode, setMode] = useState('edit'); // 'edit' | 'view'
  const [lastChangeAt, setLastChangeAt] = useState(null);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
          🧪 MarkerAnnotator Test Bench
        </h1>
        <span style={{ fontSize: '11px', color: '#888' }}>
          Isolated test — does not touch your real assets
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setMode('edit')}
            style={{
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
              background: mode === 'edit' ? '#6366f1' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: '12px', fontWeight: 600,
            }}
          >✎ Edit</button>
          <button
            onClick={() => setMode('view')}
            disabled={!savedState}
            style={{
              padding: '6px 14px', borderRadius: '6px',
              cursor: savedState ? 'pointer' : 'not-allowed',
              background: mode === 'view' ? '#6366f1' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: '12px', fontWeight: 600,
              opacity: savedState ? 1 : 0.4,
            }}
          >👁 View (read-only)</button>
        </div>
      </div>

      {/* Image URL switcher */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#888' }}>Image URL:</span>
        <input
          type="text"
          value={draftUrl}
          onChange={e => setDraftUrl(e.target.value)}
          placeholder="Paste any image URL…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', fontSize: '12px', outline: 'none',
          }}
        />
        <button
          onClick={() => { setImageUrl(draftUrl); setSavedState(null); setMode('edit'); }}
          style={{
            padding: '8px 16px', borderRadius: '6px',
            background: '#6366f1', border: 'none',
            color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >Load</button>
      </div>

      {/* Editor / Viewer */}
      <div style={{ height: '70vh', minHeight: '500px' }}>
        {mode === 'edit' ? (
          <MarkerAnnotator
            key={imageUrl}
            imageUrl={imageUrl}
            initialState={savedState}
            onChange={(state) => { setSavedState(state); setLastChangeAt(Date.now()); }}
            onClose={() => setMode('view')}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#000', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
            <MarkerViewer imageUrl={imageUrl} state={savedState} />
          </div>
        )}
      </div>

      {/* Live state debug panel */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        fontSize: '11px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <strong>Saved state</strong>
          <span style={{ color: '#888' }}>
            {savedState ? `${savedState.markers?.length || 0} markers` : 'empty'}
          </span>
          {lastChangeAt && (
            <span style={{ color: '#22c55e', fontSize: '10px' }}>
              ✓ updated {new Date(lastChangeAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { setSavedState(null); setLastChangeAt(null); }}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px', borderRadius: '5px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: '10px', cursor: 'pointer',
            }}
          >Clear saved state</button>
        </div>
        <pre style={{
          margin: 0,
          maxHeight: '160px',
          overflow: 'auto',
          padding: '8px',
          background: '#000',
          borderRadius: '5px',
          color: '#9ca3af',
          fontSize: '10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {savedState ? JSON.stringify(savedState, null, 2) : '// no markers yet — try drawing one in Edit mode'}
        </pre>
      </div>

      <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>
        Sanity checks: (1) image does NOT reload when you draw, (2) marker stays where drawn,
        (3) refresh page → click View mode → markers persist via state JSON (in real app this
        JSON will be saved to the asset doc).
      </p>
    </div>
  );
}
