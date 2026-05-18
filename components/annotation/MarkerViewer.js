'use client';
/**
 * MarkerViewer — read-only overlay of saved marker.js v3 annotations.
 * Use this anywhere you want to *show* annotations without editing
 * (lightbox preview, share view, thumbnail badge area, etc.).
 *
 * <MarkerViewer imageUrl="..." state={savedJson} />
 */

import { useEffect, useRef } from 'react';

export default function MarkerViewer({ imageUrl, state }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !imgRef.current || !state) return;
    let view;
    let cancelled = false;
    (async () => {
      const { MarkerView } = await import('@markerjs/markerjs3');
      if (cancelled) return;
      view = new MarkerView();
      view.targetImage = imgRef.current;
      view.style.display = 'block';
      view.style.width = '100%';
      view.style.height = '100%';
      const host = containerRef.current;
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(view);
      try { view.show(state); } catch (e) { console.warn('[MarkerViewer] show failed', e); }
    })();
    return () => {
      cancelled = true;
      if (view && view.parentNode) view.parentNode.removeChild(view);
    };
  }, [imageUrl, state]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <img ref={imgRef} src={imageUrl} alt="" crossOrigin="anonymous" style={{ display: 'none' }} />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
