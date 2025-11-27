'use client';
import { useState, useRef, useEffect } from 'react';

const ASPECT_RATIOS = {
  '9:16': 9/16,
  '1:1': 1,
  '16:9': 16/9,
  '4:5': 4/5,
  '3:2': 3/2,
  'free': null
};

const TOOLS = {
  select: { icon: '👆', label: 'Select' },
  crop: { icon: '⬜', label: 'Crop' },
  rect: { icon: '□', label: 'Rectangle' },
  circle: { icon: '○', label: 'Circle' },
  arrow: { icon: '→', label: 'Arrow' },
  text: { icon: 'T', label: 'Text' },
};

const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];

export default function AnnotationCanvas({ imageUrl, annotations = [], onChange, readonly = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#ef4444');
  const [cropRatio, setCropRatio] = useState('free');
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [shapes, setShapes] = useState(annotations);
  const [selectedShape, setSelectedShape] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      const maxWidth = container.clientWidth;
      const maxHeight = 500;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      const s = Math.min(scaleX, scaleY, 1);
      setScale(s);
      setImageSize({ width: img.width * s, height: img.height * s, naturalWidth: img.width, naturalHeight: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    setShapes(annotations);
  }, [annotations]);

  useEffect(() => {
    drawCanvas();
  }, [shapes, currentShape, selectedShape, imageSize]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize.width) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all shapes
    [...shapes, currentShape].filter(Boolean).forEach((shape, idx) => {
      ctx.strokeStyle = shape.color || '#ef4444';
      ctx.fillStyle = shape.color || '#ef4444';
      ctx.lineWidth = shape === selectedShape ? 3 : 2;
      ctx.setLineDash(shape.type === 'crop' ? [5, 5] : []);

      if (shape.type === 'rect' || shape.type === 'crop') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        if (shape.type === 'crop') {
          // Dim outside area
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, 0, canvas.width, shape.y);
          ctx.fillRect(0, shape.y + shape.height, canvas.width, canvas.height - shape.y - shape.height);
          ctx.fillRect(0, shape.y, shape.x, shape.height);
          ctx.fillRect(shape.x + shape.width, shape.y, canvas.width - shape.x - shape.width, shape.height);
          // Label
          ctx.fillStyle = shape.color;
          ctx.font = '12px sans-serif';
          ctx.fillText(shape.ratio || 'Crop', shape.x + 4, shape.y - 4);
        }
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        const rx = Math.abs(shape.width) / 2;
        const ry = Math.abs(shape.height) / 2;
        ctx.ellipse(shape.x + rx, shape.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        const headLen = 12;
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
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = shape.color;
        // Background
        const metrics = ctx.measureText(shape.text);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(shape.x - 2, shape.y - 14, metrics.width + 8, 20);
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.text, shape.x + 2, shape.y);
      }
    });

    // Selection handles
    if (selectedShape && !readonly) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      const handles = getHandles(selectedShape);
      handles.forEach(h => {
        ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
        ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
      });
    }
  };

  const getHandles = (shape) => {
    if (!shape) return [];
    if (shape.type === 'arrow') {
      return [{ x: shape.x, y: shape.y }, { x: shape.endX, y: shape.endY }];
    }
    return [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.width, y: shape.y },
      { x: shape.x, y: shape.y + shape.height },
      { x: shape.x + shape.width, y: shape.y + shape.height },
    ];
  };

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    if (readonly) return;
    const pos = getMousePos(e);
    setStartPos(pos);

    if (tool === 'select') {
      const clicked = [...shapes].reverse().find(s => isPointInShape(pos, s));
      setSelectedShape(clicked || null);
      return;
    }

    if (tool === 'text') {
      setTextPos(pos);
      return;
    }

    setDrawing(true);
    setSelectedShape(null);
  };

  const handleMouseMove = (e) => {
    if (!drawing || readonly || !startPos) return;
    const pos = getMousePos(e);
    let width = pos.x - startPos.x;
    let height = pos.y - startPos.y;

    if (tool === 'crop' && cropRatio !== 'free' && ASPECT_RATIOS[cropRatio]) {
      const ratio = ASPECT_RATIOS[cropRatio];
      height = width / ratio;
    }

    if (tool === 'arrow') {
      setCurrentShape({ type: 'arrow', x: startPos.x, y: startPos.y, endX: pos.x, endY: pos.y, color, id: 'temp' });
    } else {
      setCurrentShape({ type: tool === 'crop' ? 'crop' : tool, x: startPos.x, y: startPos.y, width, height, color, ratio: tool === 'crop' ? cropRatio : null, id: 'temp' });
    }
  };

  const handleMouseUp = () => {
    if (currentShape && currentShape.id === 'temp') {
      const newShape = { ...currentShape, id: Date.now().toString() };
      const newShapes = [...shapes, newShape];
      setShapes(newShapes);
      onChange?.(newShapes);
    }
    setDrawing(false);
    setCurrentShape(null);
    setStartPos(null);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPos) return;
    const newShape = { type: 'text', x: textPos.x, y: textPos.y, text: textInput, color, id: Date.now().toString() };
    const newShapes = [...shapes, newShape];
    setShapes(newShapes);
    onChange?.(newShapes);
    setTextInput('');
    setTextPos(null);
  };

  const isPointInShape = (pos, shape) => {
    if (shape.type === 'arrow') {
      const dist = distToSegment(pos, { x: shape.x, y: shape.y }, { x: shape.endX, y: shape.endY });
      return dist < 10;
    }
    if (shape.type === 'text') {
      return pos.x >= shape.x && pos.x <= shape.x + 100 && pos.y >= shape.y - 14 && pos.y <= shape.y + 6;
    }
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

  const deleteSelected = () => {
    if (!selectedShape) return;
    const newShapes = shapes.filter(s => s.id !== selectedShape.id);
    setShapes(newShapes);
    onChange?.(newShapes);
    setSelectedShape(null);
  };

  const clearAll = () => {
    setShapes([]);
    onChange?.([]);
    setSelectedShape(null);
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Toolbar */}
      {!readonly && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Tools */}
          <div style={{ display: 'flex', gap: '2px', background: '#1e1e2e', borderRadius: '6px', padding: '3px' }}>
            {Object.entries(TOOLS).map(([key, { icon, label }]) => (
              <button key={key} onClick={() => setTool(key)} title={label} style={{ width: '32px', height: '32px', background: tool === key ? '#6366f1' : 'transparent', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>{icon}</button>
            ))}
          </div>

          {/* Crop Ratios */}
          {tool === 'crop' && (
            <div style={{ display: 'flex', gap: '2px', background: '#1e1e2e', borderRadius: '6px', padding: '3px' }}>
              {Object.keys(ASPECT_RATIOS).map(ratio => (
                <button key={ratio} onClick={() => setCropRatio(ratio)} style={{ padding: '4px 8px', background: cropRatio === ratio ? '#6366f1' : 'transparent', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>{ratio}</button>
              ))}
            </div>
          )}

          {/* Colors */}
          <div style={{ display: 'flex', gap: '3px', marginLeft: '8px' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{ width: '20px', height: '20px', borderRadius: '4px', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>

          {/* Actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {selectedShape && <button onClick={deleteSelected} style={{ padding: '5px 10px', background: '#ef4444', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>🗑️ Delete</button>}
            {shapes.length > 0 && <button onClick={clearAll} style={{ padding: '5px 10px', background: '#1e1e2e', border: '1px solid #3a3a4a', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>Clear All</button>}
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img src={imageUrl} alt="" style={{ width: imageSize.width, height: imageSize.height, display: 'block' }} />
        <canvas
          ref={canvasRef}
          width={imageSize.width}
          height={imageSize.height}
          style={{ position: 'absolute', top: 0, left: 0, cursor: tool === 'select' ? 'default' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Text Input */}
        {textPos && (
          <div style={{ position: 'absolute', left: textPos.x, top: textPos.y, zIndex: 10 }}>
            <input
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextPos(null); }}
              onBlur={handleTextSubmit}
              placeholder="Type & press Enter"
              style={{ padding: '4px 8px', background: '#0d0d14', border: `2px solid ${color}`, borderRadius: '4px', color: '#fff', fontSize: '12px', minWidth: '120px' }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      {shapes.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
          {shapes.length} annotation{shapes.length !== 1 ? 's' : ''} • Click to select, then delete
        </div>
      )}
    </div>
  );
}
