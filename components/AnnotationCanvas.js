'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

const ASPECT_RATIOS = { '9:16': 9/16, '1:1': 1, '16:9': 16/9, '4:5': 4/5, '3:2': 3/2, 'free': null };
const TOOLS = { select: { icon: '👆', label: 'Select/Move' }, crop: { icon: '⬜', label: 'Crop' }, rect: { icon: '□', label: 'Rectangle' }, circle: { icon: '○', label: 'Circle' }, arrow: { icon: '→', label: 'Arrow' }, text: { icon: 'T', label: 'Text' } };
const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];

export default function AnnotationCanvas({ imageUrl, annotations = [], onChange, readonly = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#ef4444');
  const [cropRatio, setCropRatio] = useState('free');
  const [drawing, setDrawing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [startPos, setStartPos] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [shapes, setShapes] = useState(annotations);
  const [selectedShape, setSelectedShape] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      const maxWidth = Math.min(container.clientWidth - 40, 900);
      const maxHeight = 600;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      const s = Math.min(scaleX, scaleY, 1);
      setImageSize({ width: img.width * s, height: img.height * s, naturalWidth: img.width, naturalHeight: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => { setShapes(annotations); }, [annotations]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize.width) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);

    [...shapes, currentShape].filter(Boolean).forEach((shape) => {
      ctx.strokeStyle = shape.color || '#ef4444';
      ctx.fillStyle = shape.color || '#ef4444';
      ctx.lineWidth = (shape === selectedShape ? 3 : 2) / zoom;
      ctx.setLineDash(shape.type === 'crop' ? [5/zoom, 5/zoom] : []);

      if (shape.type === 'rect' || shape.type === 'crop') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        if (shape.type === 'crop') {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(0, 0, imageSize.width/zoom, shape.y);
          ctx.fillRect(0, shape.y + shape.height, imageSize.width/zoom, imageSize.height/zoom - shape.y - shape.height);
          ctx.fillRect(0, shape.y, shape.x, shape.height);
          ctx.fillRect(shape.x + shape.width, shape.y, imageSize.width/zoom - shape.x - shape.width, shape.height);
          ctx.fillStyle = shape.color;
          ctx.font = `${12/zoom}px sans-serif`;
          ctx.fillText(shape.ratio || 'Crop', shape.x + 4, shape.y - 4);
        }
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        const rx = Math.abs(shape.width) / 2;
        const ry = Math.abs(shape.height) / 2;
        ctx.ellipse(shape.x + shape.width/2, shape.y + shape.height/2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        const headLen = 12 / zoom;
        const angle = Math.atan2(shape.endY - shape.y, shape.endX - shape.x);
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(shape.endX - headLen * Math.cos(angle - Math.PI / 6), shape.endY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(shape.endX - headLen * Math.cos(angle + Math.PI / 6), shape.endY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (shape.type === 'text') {
        ctx.font = `bold ${14/zoom}px sans-serif`;
        const metrics = ctx.measureText(shape.text);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(shape.x - 4, shape.y - 16, metrics.width + 12, 24);
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.text, shape.x, shape.y);
      }
    });

    // Draw selection handles + move indicator
    if (selectedShape && !readonly) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([]);
      const handles = getHandles(selectedShape);
      const handleSize = 10 / zoom;
      handles.forEach(h => {
        ctx.fillRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
      });
      // Draw move icon in center for rect/crop/circle
      if (['rect', 'crop', 'circle'].includes(selectedShape.type)) {
        const cx = selectedShape.x + selectedShape.width / 2;
        const cy = selectedShape.y + selectedShape.height / 2;
        ctx.fillStyle = 'rgba(99,102,241,0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, 12/zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `${10/zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✥', cx, cy);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    }
    ctx.restore();
  }, [shapes, currentShape, selectedShape, imageSize, zoom, readonly]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const getHandles = (shape) => {
    if (!shape) return [];
    if (shape.type === 'arrow') return [{ x: shape.x, y: shape.y, type: 'start' }, { x: shape.endX, y: shape.endY, type: 'end' }];
    if (shape.type === 'text') return [{ x: shape.x, y: shape.y, type: 'move' }];
    return [
      { x: shape.x, y: shape.y, type: 'nw' },
      { x: shape.x + shape.width, y: shape.y, type: 'ne' },
      { x: shape.x, y: shape.y + shape.height, type: 'sw' },
      { x: shape.x + shape.width, y: shape.y + shape.height, type: 'se' },
    ];
  };

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };

  const getHandleAtPos = (pos) => {
    if (!selectedShape) return null;
    const handles = getHandles(selectedShape);
    const handleSize = 15 / zoom;
    return handles.find(h => Math.abs(h.x - pos.x) < handleSize && Math.abs(h.y - pos.y) < handleSize);
  };

  const isInMoveZone = (pos, shape) => {
    if (!shape || !['rect', 'crop', 'circle'].includes(shape.type)) return false;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    return Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2) < 20 / zoom;
  };

  const handleMouseDown = (e) => {
    if (readonly) return;
    const pos = getMousePos(e);
    
    // Check resize handle
    const handle = getHandleAtPos(pos);
    if (handle && selectedShape) {
      setResizing(handle.type);
      setStartPos(pos);
      return;
    }

    // Check move zone (center of selected shape)
    if (selectedShape && isInMoveZone(pos, selectedShape)) {
      setDragging(true);
      setDragStart({ x: pos.x - selectedShape.x, y: pos.y - selectedShape.y });
      return;
    }

    if (tool === 'select') {
      const clicked = [...shapes].reverse().find(s => isPointInShape(pos, s));
      setSelectedShape(clicked || null);
      if (clicked) {
        setDragging(true);
        setDragStart({ x: pos.x - clicked.x, y: pos.y - clicked.y });
      }
      return;
    }

    if (tool === 'text') { setTextPos(pos); return; }

    setDrawing(true);
    setStartPos(pos);
    setSelectedShape(null);
  };

  const handleMouseMove = (e) => {
    if (readonly) return;
    const pos = getMousePos(e);

    // Dragging (moving) shape
    if (dragging && selectedShape && dragStart) {
      const newX = pos.x - dragStart.x;
      const newY = pos.y - dragStart.y;
      const newShapes = shapes.map(s => {
        if (s.id !== selectedShape.id) return s;
        if (s.type === 'arrow') {
          const dx = newX - s.x;
          const dy = newY - s.y;
          return { ...s, x: newX, y: newY, endX: s.endX + dx, endY: s.endY + dy };
        }
        return { ...s, x: newX, y: newY };
      });
      setShapes(newShapes);
      setSelectedShape(newShapes.find(s => s.id === selectedShape.id));
      setIsDirty(true);
      return;
    }

    // Resizing
    if (resizing && selectedShape) {
      const newShapes = shapes.map(s => {
        if (s.id !== selectedShape.id) return s;
        if (s.type === 'arrow') {
          if (resizing === 'start') return { ...s, x: pos.x, y: pos.y };
          if (resizing === 'end') return { ...s, endX: pos.x, endY: pos.y };
        } else if (s.type === 'text') {
          return { ...s, x: pos.x, y: pos.y };
        } else {
          let newX = s.x, newY = s.y, newW = s.width, newH = s.height;
          if (resizing.includes('w')) { newX = pos.x; newW = s.x + s.width - pos.x; }
          if (resizing.includes('e')) { newW = pos.x - s.x; }
          if (resizing.includes('n')) { newY = pos.y; newH = s.y + s.height - pos.y; }
          if (resizing.includes('s')) { newH = pos.y - s.y; }
          return { ...s, x: newX, y: newY, width: newW, height: newH };
        }
        return s;
      });
      setShapes(newShapes);
      setSelectedShape(newShapes.find(s => s.id === selectedShape.id));
      setIsDirty(true);
      return;
    }

    // Drawing new shape
    if (!drawing || !startPos) return;
    let width = pos.x - startPos.x;
    let height = pos.y - startPos.y;
    if (tool === 'crop' && cropRatio !== 'free' && ASPECT_RATIOS[cropRatio]) {
      height = width / ASPECT_RATIOS[cropRatio];
    }
    if (tool === 'arrow') {
      setCurrentShape({ type: 'arrow', x: startPos.x, y: startPos.y, endX: pos.x, endY: pos.y, color, id: 'temp' });
    } else {
      setCurrentShape({ type: tool === 'crop' ? 'crop' : tool, x: startPos.x, y: startPos.y, width, height, color, ratio: tool === 'crop' ? cropRatio : null, id: 'temp' });
    }
  };

  const handleMouseUp = () => {
    if (dragging) { setDragging(false); setDragStart(null); return; }
    if (resizing) { setResizing(null); return; }
    if (currentShape && currentShape.id === 'temp') {
      const newShape = { ...currentShape, id: Date.now().toString() };
      setShapes(prev => [...prev, newShape]);
      setSelectedShape(newShape);
      setIsDirty(true);
    }
    setDrawing(false);
    setCurrentShape(null);
    setStartPos(null);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPos) return;
    const newShape = { type: 'text', x: textPos.x, y: textPos.y, text: textInput, color, id: Date.now().toString() };
    setShapes(prev => [...prev, newShape]);
    setSelectedShape(newShape);
    setIsDirty(true);
    setTextInput('');
    setTextPos(null);
  };

  const isPointInShape = (pos, shape) => {
    if (shape.type === 'arrow') {
      const dist = distToSegment(pos, { x: shape.x, y: shape.y }, { x: shape.endX, y: shape.endY });
      return dist < 15 / zoom;
    }
    if (shape.type === 'text') return pos.x >= shape.x - 4 && pos.x <= shape.x + 150 && pos.y >= shape.y - 20 && pos.y <= shape.y + 10;
    const minX = Math.min(shape.x, shape.x + shape.width);
    const maxX = Math.max(shape.x, shape.x + shape.width);
    const minY = Math.min(shape.y, shape.y + shape.height);
    const maxY = Math.max(shape.y, shape.y + shape.height);
    return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
  };

  const distToSegment = (p, v, w) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
  };

  const deleteSelected = () => { if (!selectedShape) return; setShapes(prev => prev.filter(s => s.id !== selectedShape.id)); setSelectedShape(null); setIsDirty(true); };
  const clearAll = () => { setShapes([]); setSelectedShape(null); setIsDirty(true); };
  const handleSave = () => { onChange?.(shapes); setIsDirty(false); };
  const handleZoom = (delta) => { setZoom(z => Math.max(0.5, Math.min(3, z + delta))); };

  return (
    <div ref={containerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {!readonly && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '12px', background: '#1e1e2e', borderRadius: '10px' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
            {Object.entries(TOOLS).map(([key, { icon, label }]) => (
              <button key={key} onClick={() => setTool(key)} title={label} style={{ width: '40px', height: '40px', background: tool === key ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</button>
            ))}
          </div>
          {tool === 'crop' && (
            <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
              {Object.keys(ASPECT_RATIOS).map(ratio => (
                <button key={ratio} onClick={() => setCropRatio(ratio)} style={{ padding: '8px 12px', background: cropRatio === ratio ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{ratio}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '4px' }}>
            {COLORS.map(c => <div key={c} onClick={() => setColor(c)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: c, border: color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', boxSizing: 'border-box' }} />)}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
            <button onClick={() => handleZoom(-0.25)} style={{ width: '36px', height: '36px', background: 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>−</button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => handleZoom(0.25)} style={{ width: '36px', height: '36px', background: 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>+</button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {selectedShape && <button onClick={deleteSelected} style={{ padding: '8px 14px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>🗑️ Delete</button>}
            {shapes.length > 0 && <button onClick={clearAll} style={{ padding: '8px 14px', background: '#1e1e2e', border: '1px solid #3a3a4a', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Clear All</button>}
            {isDirty && <button onClick={handleSave} style={{ padding: '8px 16px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>💾 Save</button>}
          </div>
        </div>
      )}
      <div style={{ position: 'relative', display: 'inline-block', borderRadius: '10px', overflow: 'hidden', border: '1px solid #2a2a3e' }}>
        <img src={imageUrl} alt="" style={{ width: imageSize.width * zoom, height: imageSize.height * zoom, display: 'block' }} />
        <canvas ref={canvasRef} width={imageSize.width * zoom} height={imageSize.height * zoom} style={{ position: 'absolute', top: 0, left: 0, cursor: tool === 'select' ? (dragging ? 'grabbing' : resizing ? 'nwse-resize' : 'default') : 'crosshair' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
        {textPos && (
          <div style={{ position: 'absolute', left: textPos.x * zoom, top: textPos.y * zoom, zIndex: 10 }}>
            <input autoFocus value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextPos(null); }} placeholder="Type & press Enter" style={{ padding: '8px 12px', background: '#0d0d14', border: `2px solid ${color}`, borderRadius: '6px', color: '#fff', fontSize: '14px', minWidth: '150px' }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        {shapes.length} annotation{shapes.length !== 1 ? 's' : ''} • Select to move (drag center ✥) or resize (drag corners) • Click Save when done
      </div>
    </div>
  );
}
