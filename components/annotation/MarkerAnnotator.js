'use client';
/**
 * MarkerAnnotator — thin React wrapper around marker.js v3 (MarkerArea editor).
 *
 * Goals (per Harnesh):
 *  - Small, focused file. ZERO logic dumped into MainApp.js.
 *  - Image never reloads / re-aligns on interaction (image element is stable).
 *  - All annotation state managed by the library, not us.
 *  - Save = JSON state stored on the asset doc; restore = pass `initialState`.
 *
 * API:
 *   <MarkerAnnotator
 *     imageUrl="https://..."
 *     initialState={savedJson}        // optional, marker.js state object
 *     onChange={(state) => save(state)}
 *     onClose={() => ...}             // optional X button handler
 *   />
 *
 * The component is dynamic-import-only (marker.js needs window/document).
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Marker types exposed in the toolbar. Add more from marker.js v3 as needed.
const TOOLS = [
  { id: 'FrameMarker',        label: 'Rect',      icon: '▢', hotkey: 'r' },
  { id: 'EllipseFrameMarker', label: 'Circle',    icon: '◯', hotkey: 'o' },
  { id: 'ArrowMarker',        label: 'Arrow',     icon: '➜', hotkey: 'a' },
  { id: 'FreehandMarker',     label: 'Draw',      icon: '✎', hotkey: 'd' },
  { id: 'HighlightMarker',    label: 'Highlight', icon: '▮', hotkey: 'h' },
  { id: 'TextMarker',         label: 'Text',      icon: 'T', hotkey: 't' },
  { id: 'CalloutMarker',      label: 'Callout',   icon: '💬', hotkey: 'c' },
];

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

export default function MarkerAnnotator({ imageUrl, initialState, onChange, onClose }) {
  const editorContainerRef = useRef(null);
  const imgRef = useRef(null);
  const markerAreaRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [markerCount, setMarkerCount] = useState(0);

  // Initialise MarkerArea once when image loads. Image element stays the same
  // — no reload on interaction.
  useEffect(() => {
    if (!editorContainerRef.current || !imgRef.current) return;

    let markerArea;
    let cancelled = false;

    (async () => {
      // Dynamic import — marker.js needs window
      const { MarkerArea } = await import('@markerjs/markerjs3');
      if (cancelled) return;

      markerArea = new MarkerArea();
      markerArea.targetImage = imgRef.current;
      markerArea.style.display = 'block';
      markerArea.style.width = '100%';
      markerArea.style.height = '100%';
      // Clear any prior child nodes safely (no innerHTML)
      const host = editorContainerRef.current;
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(markerArea);
      markerAreaRef.current = markerArea;

      // Restore saved state
      if (initialState) {
        try { markerArea.restoreState(initialState); } catch (e) { console.warn('[MarkerAnnotator] restoreState failed', e); }
      }

      const handleChange = () => {
        try {
          const state = markerArea.getState();
          setMarkerCount(state?.markers?.length || 0);
          if (onChange) onChange(state);
        } catch (e) { /* ignore */ }
      };

      markerArea.addEventListener('markercreate', handleChange);
      markerArea.addEventListener('markerchange', handleChange);
      markerArea.addEventListener('markerdelete', handleChange);

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (markerArea && markerArea.parentNode) {
        markerArea.parentNode.removeChild(markerArea);
      }
      markerAreaRef.current = null;
    };
    // intentionally only on imageUrl — initialState changes during editing
    // would reset state. Pass a new key from parent if you want full reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const createMarker = useCallback((markerType) => {
    if (!markerAreaRef.current) return;
    try {
      markerAreaRef.current.createMarker(markerType);
    } catch (e) {
      console.warn('[MarkerAnnotator] createMarker failed', markerType, e);
    }
  }, []);

  const clearAll = useCallback(() => {
    if (!markerAreaRef.current) return;
    try {
      markerAreaRef.current.state = {
        version: 3,
        width: imgRef.current?.naturalWidth || 0,
        height: imgRef.current?.naturalHeight || 0,
        markers: [],
      };
      setMarkerCount(0);
      if (onChange) onChange(markerAreaRef.current.getState());
    } catch (e) { console.warn(e); }
  }, [onChange]);

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const tool = TOOLS.find(t => t.hotkey === e.key.toLowerCase());
      if (tool) { e.preventDefault(); createMarker(tool.id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createMarker]);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', borderRadius: '10px', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => createMarker(tool.id)}
            title={`${tool.label} (${tool.hotkey.toUpperCase()})`}
            disabled={!ready}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 10px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff', fontSize: '12px', cursor: ready ? 'pointer' : 'wait',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <span style={{ fontSize: '14px' }}>{tool.icon}</span>
            <span>{tool.label}</span>
            <span style={{ fontSize: '9px', opacity: 0.5, marginLeft: '2px' }}>{tool.hotkey.toUpperCase()}</span>
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Color swatches */}
        {COLORS.map(color => (
          <button
            key={color}
            onClick={() => setActiveColor(color)}
            title={color}
            style={{
              width: '20px', height: '20px',
              borderRadius: '50%', background: color,
              border: activeColor === color ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: activeColor === color ? `0 0 6px ${color}` : 'none',
            }}
          />
        ))}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          {markerCount} marker{markerCount === 1 ? '' : 's'}
        </span>

        <button
          onClick={clearAll}
          disabled={!ready || markerCount === 0}
          style={{
            padding: '6px 10px', borderRadius: '6px',
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: '11px',
            cursor: ready && markerCount > 0 ? 'pointer' : 'not-allowed',
            opacity: ready && markerCount > 0 ? 1 : 0.4,
          }}
        >Clear all</button>

        {onClose && (
          <button
            onClick={onClose}
            title="Done annotating"
            style={{
              padding: '6px 14px', borderRadius: '6px',
              background: '#22c55e', border: 'none',
              color: '#fff', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer',
            }}
          >Done</button>
        )}
      </div>

      {/* ── Editor canvas area ───────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Hidden source image — MarkerArea uses this as its target */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{ display: 'none' }}
        />
        {/* MarkerArea custom element is appended here */}
        <div
          ref={editorContainerRef}
          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
        {!ready && (
          <div style={{ position: 'absolute', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            Loading editor…
          </div>
        )}
      </div>
    </div>
  );
}
