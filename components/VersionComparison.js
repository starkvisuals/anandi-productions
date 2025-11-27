'use client';
import { useState, useRef, useEffect } from 'react';

const MODES = {
  sideBySide: { icon: '◫', label: 'Side by Side' },
  slider: { icon: '↔', label: 'Slider' },
  toggle: { icon: '⇄', label: 'Toggle' },
};

export default function VersionComparison({ versions = [], currentVersion = 1 }) {
  const [mode, setMode] = useState('sideBySide');
  const [compareV1, setCompareV1] = useState(1);
  const [compareV2, setCompareV2] = useState(currentVersion);
  const [sliderPos, setSliderPos] = useState(50);
  const [toggleShow, setToggleShow] = useState('v2');
  const sliderRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const v1 = versions.find(v => v.version === compareV1);
  const v2 = versions.find(v => v.version === compareV2);

  if (!versions.length || versions.length < 2) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', background: '#0d0d14', borderRadius: '10px' }}>
        <div style={{ fontSize: '30px', marginBottom: '10px' }}>📊</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Need at least 2 versions to compare</div>
      </div>
    );
  }

  const handleSliderMove = (e) => {
    if (!dragging || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pos = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  };

  const handleMouseDown = () => setDragging(true);
  const handleMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleSliderMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleSliderMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging]);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '2px', background: '#1e1e2e', borderRadius: '6px', padding: '3px' }}>
          {Object.entries(MODES).map(([key, { icon, label }]) => (
            <button key={key} onClick={() => setMode(key)} title={label} style={{ padding: '6px 12px', background: mode === key ? '#6366f1' : 'transparent', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{icon} {label}</button>
          ))}
        </div>

        {/* Version Selectors */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
          <select value={compareV1} onChange={e => setCompareV1(Number(e.target.value))} style={{ padding: '6px 10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '5px', color: '#fff', fontSize: '11px' }}>
            {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>vs</span>
          <select value={compareV2} onChange={e => setCompareV2(Number(e.target.value))} style={{ padding: '6px 10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '5px', color: '#fff', fontSize: '11px' }}>
            {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
        </div>
      </div>

      {/* Comparison View */}
      <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Side by Side */}
        {mode === 'sideBySide' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
            <div style={{ position: 'relative' }}>
              <img src={v1?.url} alt="Version 1" style={{ width: '100%', height: '300px', objectFit: 'contain', background: '#000' }} />
              <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px' }}>v{compareV1}</div>
            </div>
            <div style={{ position: 'relative' }}>
              <img src={v2?.url} alt="Version 2" style={{ width: '100%', height: '300px', objectFit: 'contain', background: '#000' }} />
              <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px' }}>v{compareV2}</div>
            </div>
          </div>
        )}

        {/* Slider Overlay */}
        {mode === 'slider' && (
          <div ref={sliderRef} style={{ position: 'relative', height: '400px', cursor: 'ew-resize', userSelect: 'none' }} onMouseDown={handleMouseDown}>
            {/* Bottom layer (v2) */}
            <img src={v2?.url} alt="Version 2" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            
            {/* Top layer (v1) with clip */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: `${sliderPos}%`, height: '100%', overflow: 'hidden' }}>
              <img src={v1?.url} alt="Version 1" style={{ width: sliderRef.current?.clientWidth || '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            
            {/* Slider Handle */}
            <div style={{ position: 'absolute', top: 0, left: `${sliderPos}%`, width: '3px', height: '100%', background: '#fff', transform: 'translateX(-50%)', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '36px', height: '36px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                <span style={{ color: '#000', fontSize: '14px' }}>↔</span>
              </div>
            </div>

            {/* Labels */}
            <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px' }}>v{compareV1}</div>
            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px' }}>v{compareV2}</div>
          </div>
        )}

        {/* Toggle */}
        {mode === 'toggle' && (
          <div style={{ position: 'relative' }}>
            <img src={toggleShow === 'v1' ? v1?.url : v2?.url} alt="Version" style={{ width: '100%', height: '400px', objectFit: 'contain' }} />
            
            {/* Toggle Buttons */}
            <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.7)', borderRadius: '20px', padding: '4px' }}>
              <button onClick={() => setToggleShow('v1')} style={{ padding: '6px 16px', background: toggleShow === 'v1' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>v{compareV1}</button>
              <button onClick={() => setToggleShow('v2')} style={{ padding: '6px 16px', background: toggleShow === 'v2' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>v{compareV2}</button>
            </div>

            {/* Current Label */}
            <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px' }}>
              {toggleShow === 'v1' ? `v${compareV1}` : `v${compareV2}`}
            </div>
          </div>
        )}
      </div>

      {/* Version Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', padding: '8px', background: '#1e1e2e', borderRadius: '6px' }}>
        <div style={{ fontSize: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>v{compareV1}: </span>
          <span>{v1?.uploadedAt ? new Date(v1.uploadedAt).toLocaleDateString() : 'Original'}</span>
        </div>
        <div style={{ fontSize: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>v{compareV2}: </span>
          <span>{v2?.uploadedAt ? new Date(v2.uploadedAt).toLocaleDateString() : 'Latest'}</span>
        </div>
      </div>
    </div>
  );
}
