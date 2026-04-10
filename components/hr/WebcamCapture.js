'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Webcam-only photo capture. Uses getUserMedia to show a live preview,
 * captures a JPEG on click, then calls onCapture(blob) when the user confirms.
 *
 * Props:
 *  - onCapture(blob)    : called with a JPEG Blob when the user confirms
 *  - onCancel()         : optional cancel handler
 *  - t                  : theme tokens
 *  - size               : preview size in px (default 320)
 */
export default function WebcamCapture({ onCapture, onCancel, t, size = 320 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | ready | captured | error
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const capturedBlobRef = useRef(null);

  const startCamera = async () => {
    setStatus('starting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch (err) {
      console.error('Webcam error:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err.message || err.name}`
      );
      setStatus('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    // Square crop from center
    const cropSize = Math.min(w, h);
    const sx = (w - cropSize) / 2;
    const sy = (h - cropSize) / 2;
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 512, 512);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        capturedBlobRef.current = blob;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus('captured');
      },
      'image/jpeg',
      0.9
    );
  };

  const retake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    capturedBlobRef.current = null;
    setStatus('ready');
  };

  const confirm = () => {
    if (capturedBlobRef.current && onCapture) {
      stopCamera();
      onCapture(capturedBlobRef.current);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '12px',
          overflow: 'hidden',
          background: t?.bgInput || '#0d0d12',
          border: `1px solid ${t?.border || '#2a2a3a'}`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {status === 'error' ? (
          <div style={{ padding: '16px', textAlign: 'center', color: t?.danger || '#ef4444', fontSize: '13px' }}>
            {error}
          </div>
        ) : status === 'captured' && previewUrl ? (
          <img src={previewUrl} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // mirror for natural selfie view
            }}
          />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {status === 'error' && (
          <button
            onClick={startCamera}
            style={{
              padding: '10px 18px',
              background: t?.primary || '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry camera
          </button>
        )}
        {status === 'ready' && (
          <button
            onClick={captureFrame}
            style={{
              padding: '10px 22px',
              background: t?.primary || '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📸 Capture
          </button>
        )}
        {status === 'captured' && (
          <>
            <button
              onClick={retake}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: t?.text || '#fff',
                border: `1px solid ${t?.border || '#2a2a3a'}`,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retake
            </button>
            <button
              onClick={confirm}
              style={{
                padding: '10px 22px',
                background: t?.success || '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Use this photo
            </button>
          </>
        )}
        {onCancel && (
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              color: t?.textMuted || '#999',
              border: `1px solid ${t?.border || '#2a2a3a'}`,
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
