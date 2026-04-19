'use client';
import { useState, useEffect, useRef } from 'react';
import { generateId } from '@/lib/firestore';

/**
 * AnnotationCanvas — stand-alone component for drawing annotations on images or
 * as a transparent overlay on video.
 *
 * Must live OUTSIDE the parent component (e.g. MainApp) so its React identity
 * stays stable across parent re-renders.  When defined as a nested `const`
 * inside a parent component function, React creates a brand-new function
 * reference on every parent render → unmount/remount → all in-progress drawing
 * is wiped instantly.
 *
 * Props:
 *   imageUrl    – image src (omit when videoOverlay=true)
 *   annotations – array of saved annotation objects (controlled from parent)
 *   onChange    – callback(updatedAnnotations) called after every mutation
 *   videoOverlay– if true, renders transparent overlay; no image tag
 *   t           – theme token object (bgCard, bgInput, bgSecondary, border,
 *                  text, textMuted, textSecondary, primary)
 *   theme       – 'dark' | 'light'  (used for canvas background colour)
 *   userName    – display name of the current user (for annotation author)
 */
export default function AnnotationCanvas({ imageUrl, annotations = [], onChange, videoOverlay = false, t, theme, userName }) {
  const [annots, setAnnots] = useState(annotations);
  const [tool, setTool] = useState('rect');
  const [color, setColor] = useState('#ef4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentEnd, setCurrentEnd] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [selectedAnnot, setSelectedAnnot] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [inlineText, setInlineText] = useState('');
  const [editingAnnotId, setEditingAnnotId] = useState(null);
  const [newAnnotPos, setNewAnnotPos] = useState(null);
  const lastPinchDistRef = useRef(0);
  const containerRef = useRef(null);
  const imageContainerRef = useRef(null);
  const inlineInputRef = useRef(null);
  // Ref tracks latest annots so drag/resize handleEnd doesn't read a stale closure
  const annotsRef = useRef(annots);

  const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  const TOOLS = [
    { id: 'rect', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>, label: 'Rectangle' },
    { id: 'circle', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>, label: 'Circle' },
    { id: 'arrow', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>, label: 'Arrow' },
    { id: 'freehand', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>, label: 'Draw' },
    { id: 'text', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="9.5" y1="4" x2="9.5" y2="20"/><line x1="14.5" y1="4" x2="14.5" y2="20"/><line x1="7" y1="20" x2="17" y2="20"/></svg>, label: 'Text' },
  ];

  // Sync internal state when the parent passes a new annotations array
  useEffect(() => { setAnnots(annotations); }, [annotations]);

  // Keep ref in sync so drag/resize handleEnd always reads the latest state
  useEffect(() => { annotsRef.current = annots; }, [annots]);

  // In video overlay mode the canvas is always "ready" — no image to wait for
  useEffect(() => { if (videoOverlay) setImageLoaded(true); }, [videoOverlay]);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    setImageDims({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  };

  const getPos = (e) => {
    if (!imageContainerRef.current) return { x: 0, y: 0 };
    const rect = imageContainerRef.current.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else if (e.changedTouches && e.changedTouches.length > 0) { clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    };
  };

  const getTouchDist = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) { e.preventDefault(); setIsPinching(true); lastPinchDistRef.current = getTouchDist(e.touches); return; }
    if (e.touches.length === 1 && !isPinching) handleStart(e);
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && isPinching) { e.preventDefault(); const dist = getTouchDist(e.touches); if (lastPinchDistRef.current > 0) setZoom(z => Math.max(50, Math.min(300, z * (dist / lastPinchDistRef.current)))); lastPinchDistRef.current = dist; return; }
    if (e.touches.length === 1 && !isPinching) handleMove(e);
  };
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) { setIsPinching(false); lastPinchDistRef.current = 0; }
    if (e.touches.length === 0 && !isPinching) handleEnd(e);
  };

  const handleStart = (e) => {
    if (dragging || resizing || isPinching || newAnnotPos) return;
    e.preventDefault(); e.stopPropagation();
    const pos = getPos(e);
    setDrawStart(pos); setCurrentEnd(pos); setIsDrawing(true);
    if (tool === 'freehand') setCurrentPath([pos]);
    setSelectedAnnot(null);
  };

  const handleMove = (e) => {
    if (isPinching) return;
    if (dragging) {
      e.preventDefault();
      const pos = getPos(e);
      setAnnots(prev => prev.map(a => a.id === dragging ? { ...a, x: Math.max(0, Math.min(100 - (a.width || 5), pos.x - (a.width || 5)/2)), y: Math.max(0, Math.min(100 - (a.height || 5), pos.y - (a.height || 5)/2)) } : a));
      return;
    }
    if (resizing) {
      e.preventDefault();
      const pos = getPos(e);
      setAnnots(prev => { const annot = prev.find(a => a.id === resizing); if (!annot) return prev; return prev.map(a => a.id === resizing ? { ...a, width: Math.max(3, pos.x - annot.x), height: Math.max(3, pos.y - annot.y) } : a); });
      return;
    }
    if (!isDrawing || !drawStart) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentEnd(pos);
    if (tool === 'freehand') setCurrentPath(prev => [...prev, pos]);
  };

  const handleEnd = (e) => {
    // Use annotsRef.current (always latest) instead of the stale closure `annots`
    if (dragging) { setDragging(null); onChange(annotsRef.current); return; }
    if (resizing) { setResizing(null); onChange(annotsRef.current); return; }
    if (!isDrawing || !drawStart) return;

    const pos = currentEnd || drawStart;
    const width = Math.abs(pos.x - drawStart.x);
    const height = Math.abs(pos.y - drawStart.y);
    const x = Math.min(pos.x, drawStart.x);
    const y = Math.min(pos.y, drawStart.y);
    const author = userName || 'You';

    if (tool === 'text') {
      setNewAnnotPos({ x: drawStart.x, y: drawStart.y, type: 'text', color, author });
      setInlineText('');
      setTimeout(() => inlineInputRef.current?.focus(), 50);
    } else if (tool === 'freehand' && currentPath.length > 2) {
      const newAnnot = { id: generateId(), type: 'freehand', path: currentPath, color, createdAt: new Date().toISOString(), author, text: '' };
      setNewAnnotPos({ ...newAnnot, _isShape: true });
      setInlineText('');
      setTimeout(() => inlineInputRef.current?.focus(), 50);
    } else if (width > 2 || height > 2) {
      const newAnnot = { id: generateId(), type: tool, x, y, width: Math.max(width, 5), height: Math.max(height, 5), color, createdAt: new Date().toISOString(), author, text: '' };
      setNewAnnotPos({ ...newAnnot, _isShape: true });
      setInlineText('');
      setTimeout(() => inlineInputRef.current?.focus(), 50);
    }

    setIsDrawing(false); setDrawStart(null); setCurrentEnd(null); setCurrentPath([]);
  };

  const confirmInlineAnnotation = () => {
    if (!newAnnotPos) return;
    let newAnnot;
    if (newAnnotPos._isShape) {
      const { _isShape, ...rest } = newAnnotPos;
      newAnnot = { ...rest, text: inlineText.trim() || '' };
    } else {
      if (!inlineText.trim()) { setNewAnnotPos(null); setInlineText(''); return; }
      newAnnot = { id: generateId(), type: 'text', x: newAnnotPos.x, y: newAnnotPos.y, text: inlineText.trim(), color: newAnnotPos.color, createdAt: new Date().toISOString(), author: newAnnotPos.author };
    }
    const updated = [...annots, newAnnot];
    setAnnots(updated);
    onChange(updated);
    setNewAnnotPos(null); setInlineText('');
  };

  const cancelInlineAnnotation = () => { setNewAnnotPos(null); setInlineText(''); };

  const deleteAnnot = (id, e) => {
    if (e) e.stopPropagation();
    const updated = annots.filter(a => a.id !== id);
    setAnnots(updated);
    onChange(updated);
    setSelectedAnnot(null);
  };

  const renderAnnotation = (a) => {
    const isSelected = selectedAnnot === a.id;
    const labelStyle = { position: 'absolute', top: '-26px', left: '0', background: a.color, color: '#fff', padding: '3px 8px', borderRadius: '4px 4px 4px 0', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: '600', zIndex: 11, pointerEvents: 'auto', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' };
    const deleteBtn = isSelected ? <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', background: '#ef4444', border: '2px solid #fff', borderRadius: '50%', color: '#fff', fontSize: '11px', cursor: 'pointer', zIndex: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>×</button> : null;
    const resizeHandle = isSelected ? <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} onTouchStart={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '10px', height: '10px', background: '#fff', border: `2px solid ${a.color}`, borderRadius: '2px', cursor: 'se-resize', zIndex: 12 }} /> : null;

    if (a.type === 'freehand' && a.path) {
      const pathD = a.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const minX = Math.min(...a.path.map(p => p.x));
      const minY = Math.min(...a.path.map(p => p.y));
      return (
        <div key={a.id} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            <path d={pathD} stroke={a.color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: isSelected ? '4px' : '3px', pointerEvents: 'stroke', cursor: 'pointer', filter: isSelected ? `drop-shadow(0 0 3px ${a.color})` : 'none' }} onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }} />
          </svg>
          {a.text && <div style={{ ...labelStyle, left: `${minX}%`, top: `${Math.max(0, minY)}%`, transform: 'translateY(-100%)' }}>{a.text}</div>}
          {isSelected && <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', left: `${minX}%`, top: `${minY}%`, transform: 'translate(-50%, -50%)', width: '20px', height: '20px', background: '#ef4444', border: '2px solid #fff', borderRadius: '50%', color: '#fff', fontSize: '11px', cursor: 'pointer', zIndex: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', pointerEvents: 'auto' }}>×</button>}
        </div>
      );
    }

    if (a.type === 'text') {
      return (
        <div key={a.id}
          style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, color: '#fff', fontSize: '13px', fontWeight: '600', padding: '4px 10px', cursor: 'move', background: a.color, borderRadius: '4px', zIndex: 10, border: isSelected ? '2px solid #fff' : 'none', boxShadow: isSelected ? `0 0 0 2px ${a.color}, 0 2px 8px rgba(0,0,0,0.3)` : '0 2px 6px rgba(0,0,0,0.3)', maxWidth: '200px', wordBreak: 'break-word' }}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
          onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
          {a.text}
          {deleteBtn}
        </div>
      );
    }

    if (a.type === 'circle') {
      return (
        <div key={a.id}
          style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: '50%', background: `${a.color}15`, cursor: 'move', boxSizing: 'border-box', zIndex: 10, boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${a.color}` : 'none' }}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
          onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
          {a.text && <div style={labelStyle}>{a.text}</div>}
          {resizeHandle}{deleteBtn}
        </div>
      );
    }

    if (a.type === 'arrow') {
      return (
        <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, cursor: 'move', zIndex: 10 }}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
          onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
          {a.text && <div style={labelStyle}>{a.text}</div>}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs><marker id={`arr-${a.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs>
            <line x1="0" y1="50" x2="100" y2="50" stroke={a.color} strokeWidth={isSelected ? '4' : '3'} markerEnd={`url(#arr-${a.id})`} vectorEffect="non-scaling-stroke" style={{ filter: isSelected ? `drop-shadow(0 0 3px ${a.color})` : 'none' }} />
          </svg>
          {resizeHandle}{deleteBtn}
        </div>
      );
    }

    // Rectangle (default)
    return (
      <div key={a.id}
        style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: '3px', background: `${a.color}15`, cursor: 'move', boxSizing: 'border-box', zIndex: 10, boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${a.color}` : 'none' }}
        onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
        onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
        onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
        {a.text && <div style={labelStyle}>{a.text}</div>}
        {resizeHandle}{deleteBtn}
      </div>
    );
  };

  const renderPreview = () => {
    if (!isDrawing || !drawStart || !currentEnd || tool === 'text') return null;
    if (tool === 'freehand' && currentPath.length > 1) {
      const pathD = currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}><path d={pathD} stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.7" vectorEffect="non-scaling-stroke" style={{ strokeWidth: '3px' }} /></svg>;
    }
    const x = Math.min(drawStart.x, currentEnd.x);
    const y = Math.min(drawStart.y, currentEnd.y);
    const w = Math.abs(currentEnd.x - drawStart.x);
    const h = Math.abs(currentEnd.y - drawStart.y);
    if (w < 1 && h < 1) return null;
    return <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, border: `2px dashed ${color}`, borderRadius: tool === 'circle' ? '50%' : '3px', pointerEvents: 'none', opacity: 0.8, background: `${color}10` }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', alignItems: 'center', flexShrink: 0, background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', gap: '2px', background: t.bgInput, borderRadius: '10px', padding: '3px' }}>
          {TOOLS.map(tl => (
            <button key={tl.id} onClick={() => setTool(tl.id)} title={tl.label}
              style={{ width: '34px', height: '34px', background: tool === tl.id ? t.primary : 'transparent', border: 'none', borderRadius: '8px', color: tool === tl.id ? '#fff' : t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              {tl.icon}
            </button>
          ))}
        </div>
        <div style={{ width: '1px', height: '24px', background: t.border }} />
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width: '22px', height: '22px', background: c, border: color === c ? `2.5px solid ${t.text}` : '2px solid transparent', borderRadius: '50%', cursor: 'pointer', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {!videoOverlay && (
          <div style={{ display: 'flex', gap: '2px', background: t.bgInput, borderRadius: '8px', padding: '3px', alignItems: 'center' }}>
            <button onClick={() => setZoom(z => Math.max(50, z - 25))} style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', borderRadius: '6px', color: t.textSecondary, cursor: 'pointer', fontSize: '15px' }}>-</button>
            <button onClick={() => setZoom(100)} style={{ padding: '2px 8px', fontSize: '10px', color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', minWidth: '36px' }}>{zoom}%</button>
            <button onClick={() => setZoom(z => Math.min(300, z + 25))} style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', borderRadius: '6px', color: t.textSecondary, cursor: 'pointer', fontSize: '15px' }}>+</button>
          </div>
        )}
        {annots.length > 0 && <span style={{ fontSize: '10px', color: t.textMuted, marginLeft: '4px' }}>{annots.length}</span>}
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: videoOverlay ? 'stretch' : 'center', justifyContent: videoOverlay ? 'stretch' : 'center', overflow: videoOverlay ? 'hidden' : (zoom > 100 ? 'auto' : 'hidden'), background: videoOverlay ? 'transparent' : (theme === 'dark' ? '#0a0a0f' : '#e5e7eb'), position: 'relative' }}>

        {!imageLoaded && !videoOverlay && (
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: t.textMuted }}>
            <div className="spinner" style={{ width: 20, height: 20, border: `2px solid ${t.primary}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
            <span style={{ fontSize: '11px' }}>Loading...</span>
          </div>
        )}

        <div
          ref={imageContainerRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => { setSelectedAnnot(null); if (!isDrawing) cancelInlineAnnotation(); }}
          style={{
            position: videoOverlay ? 'absolute' : 'relative',
            top: videoOverlay ? 0 : undefined, left: videoOverlay ? 0 : undefined,
            width: videoOverlay ? '100%' : undefined, height: videoOverlay ? '100%' : undefined,
            cursor: 'crosshair', userSelect: 'none', touchAction: 'none',
            transform: videoOverlay ? 'none' : `scale(${zoom / 100})`, transformOrigin: 'center center',
            maxWidth: videoOverlay ? '100%' : (zoom <= 100 ? '100%' : 'none'), maxHeight: videoOverlay ? '100%' : (zoom <= 100 ? '100%' : 'none'),
            zIndex: videoOverlay ? 10 : undefined
          }}>
          {!videoOverlay && (
            <img
              src={imageUrl} alt="" draggable={false} onLoad={handleImageLoad}
              style={{
                display: 'block',
                maxWidth: zoom <= 100 ? '100%' : `${imageDims.width}px`,
                maxHeight: zoom <= 100 ? 'calc(100vh - 200px)' : `${imageDims.height}px`,
                width: 'auto', height: 'auto', objectFit: 'contain',
                pointerEvents: 'none', opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.2s'
              }}
            />
          )}
          {imageLoaded && annots.map(renderAnnotation)}
          {imageLoaded && renderPreview()}

          {/* Inline text input — appears right where you drew */}
          {newAnnotPos && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: `${newAnnotPos.x || newAnnotPos.path?.[0]?.x || 0}%`, top: `${(newAnnotPos.y || newAnnotPos.path?.[0]?.y || 0)}%`, transform: 'translateY(-100%)', zIndex: 20 }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: t.bgCard, borderRadius: '8px', padding: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: `2px solid ${newAnnotPos.color}` }}>
                <input
                  ref={inlineInputRef}
                  value={inlineText}
                  onChange={(e) => setInlineText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmInlineAnnotation(); if (e.key === 'Escape') cancelInlineAnnotation(); }}
                  placeholder="Add note..."
                  style={{ width: '180px', padding: '6px 8px', border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: t.text }}
                />
                <button onClick={confirmInlineAnnotation} style={{ width: '28px', height: '28px', background: newAnnotPos.color, border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>+</button>
                <button onClick={cancelInlineAnnotation} style={{ width: '28px', height: '28px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>×</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
