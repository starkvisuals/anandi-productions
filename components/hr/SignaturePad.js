'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * E-signature component: typed legal name + drawn signature canvas.
 * IT Act 2000 compliant (India) — captures name, signature image, timestamp, IP.
 *
 * Props:
 *  - expectedName  : the legal name the employee must type to match (e.g. user.name)
 *  - onSign(result): called with { typedName, signatureDataUrl, signedAt, ipAddress }
 *  - t             : theme tokens
 *  - width, height : canvas size
 */
export default function SignaturePad({ expectedName, onSign, t, width = 420, height = 160 }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [ip, setIp] = useState('');
  const [error, setError] = useState('');

  // Fetch client IP for audit trail (best-effort)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/get-client-ip');
        if (res.ok) {
          const d = await res.json();
          setIp(d.ip || '');
        }
      } catch {
        // non-fatal
      }
    })();
  }, []);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasInk) setHasInk(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const submit = () => {
    setError('');
    if (!typedName.trim()) {
      setError('Please type your full legal name.');
      return;
    }
    if (expectedName && typedName.trim().toLowerCase() !== expectedName.trim().toLowerCase()) {
      setError(`Name must match: ${expectedName}`);
      return;
    }
    if (!hasInk) {
      setError('Please draw your signature above.');
      return;
    }
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSign?.({
      typedName: typedName.trim(),
      signatureDataUrl: dataUrl,
      signedAt: new Date().toISOString(),
      ipAddress: ip || 'unknown',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t?.textMuted || '#999', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          Full legal name {expectedName ? `(must match "${expectedName}")` : ''}
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="Type your full legal name"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: t?.bgInput || '#0d0d12',
            border: `1px solid ${t?.border || '#2a2a3a'}`,
            borderRadius: '8px',
            color: t?.text || '#fff',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t?.textMuted || '#999', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          Draw your signature
        </label>
        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${t?.border || '#2a2a3a'}`, background: '#fff' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
            style={{
              width: '100%',
              height: `${height}px`,
              cursor: 'crosshair',
              touchAction: 'none',
              display: 'block',
            }}
          />
          {!hasInk && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
              Draw here with mouse or touch
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: t?.danger || '#ef4444' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={clear}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: t?.textMuted || '#999',
            border: `1px solid ${t?.border || '#2a2a3a'}`,
            borderRadius: '8px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={submit}
          style={{
            padding: '9px 20px',
            background: t?.primary || '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign & Continue
        </button>
      </div>
      <div style={{ fontSize: '10px', color: t?.textMuted || '#999' }}>
        By signing, you acknowledge that this electronic signature is legally binding under the Information Technology Act, 2000.
      </div>
    </div>
  );
}
