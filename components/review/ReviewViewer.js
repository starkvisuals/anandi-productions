'use client';
// components/review/ReviewViewer.js — the full Frame.io review loop (A1.4).
//
// Composes ReviewCanvas (annotation) + VideoTimeline (scrubber markers) +
// CommentSidebar (comment threads) into ONE controlled unit around a single
// asset. This is the component MainApp's lightbox will mount (A1.5).
//
// Comments are the primary object and live in asset.feedback[]; each item
// carries BOTH its drawing (pin/rect/…: x, y, width, path, color, videoTimestamp)
// and its comment fields (text, author, userId, resolved, replies). One array,
// one loop. Legacy asset.annotations[] (old drawings, pre-unification) stay
// READABLE on the canvas — no migration; edits to a legacy item write back to
// annotations[], never silently fail.
//
// Fully controlled: it holds only view state (selection, playhead, duration);
// all persistence goes through onUpdateAsset so the parent owns the data.
//
// Props:
//   asset        : { id?, type|mediaType, url|src, posterUrl?, feedback?[], annotations?[] }
//   onUpdateAsset: (patch) => void   — persist a shallow patch ({feedback} / {annotations})
//   currentUser  : { id, name }
//   videoRef     : optional external ref to the <video>
//   mentionables : [{ id, name }]    — optional, for @mention

import { useMemo, useRef, useState } from 'react';
import ReviewCanvas from './ReviewCanvas';
import CommentSidebar from './CommentSidebar';
import VideoTimeline from './VideoTimeline';

const DRAWING_TYPES = ['pin', 'rect', 'circle', 'arrow', 'freehand', 'text'];
const genId = () => Math.random().toString(36).slice(2, 10);

function mediaFromAsset(asset = {}) {
  const type = String(asset.mediaType || asset.type || '').toLowerCase().includes('video') ? 'video' : 'image';
  const src = asset.url || asset.src || asset.fileUrl || '';
  // Prefer Mux HLS (fast adaptive streaming) when the asset has a playback id.
  const hls = asset.muxPlaybackId ? `https://stream.mux.com/${asset.muxPlaybackId}.m3u8` : undefined;
  const poster = asset.posterUrl || asset.thumbnailUrl || asset.thumbnail
    || (asset.muxPlaybackId ? `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg` : undefined);
  return { type, src, hls, poster };
}

export default function ReviewViewer({ asset, onUpdateAsset, currentUser, videoRef: externalVideoRef, mentionables = [] }) {
  const localVideoRef = useRef(null);
  const videoRef = externalVideoRef || localVideoRef;

  const media = useMemo(() => mediaFromAsset(asset), [asset]);
  const isVideo = media.type === 'video';

  const [selectedId, setSelectedId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const feedback = asset?.feedback ?? [];
  const legacy = asset?.annotations ?? [];

  // Canvas shows feedback items + legacy drawings; the sidebar/timeline show
  // feedback comments only (legacy drawings have no thread).
  const legacyItems = useMemo(
    () => legacy.filter(a => DRAWING_TYPES.includes(a.type)).map(a => ({ ...a, __legacy: true })),
    [legacy]
  );
  const canvasItems = useMemo(() => [...feedback, ...legacyItems], [feedback, legacyItems]);
  const isLegacyId = (id) => legacyItems.some(a => a.id === id);

  // ── Writes — route to feedback[] (comments) or legacy annotations[] ─────────
  const addItem = (item) => {
    onUpdateAsset?.({ feedback: [...feedback, { author: currentUser?.name || 'You', userId: currentUser?.id, ...item }] });
  };
  const updateItem = (id, patch) => {
    if (isLegacyId(id)) onUpdateAsset?.({ annotations: legacy.map(a => (a.id === id ? { ...a, ...patch } : a)) });
    else onUpdateAsset?.({ feedback: feedback.map(c => (c.id === id ? { ...c, ...patch } : c)) });
  };
  const deleteItem = (id) => {
    if (isLegacyId(id)) onUpdateAsset?.({ annotations: legacy.filter(a => a.id !== id) });
    else onUpdateAsset?.({ feedback: feedback.filter(c => c.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  // General comment (no drawing) from the sidebar composer.
  const postComment = ({ text, videoTimestamp }) => {
    const id = genId();
    onUpdateAsset?.({
      feedback: [...feedback, { id, type: 'general', text, videoTimestamp, color: '#FACC15', author: currentUser?.name || 'You', userId: currentUser?.id, createdAt: new Date().toISOString() }],
    });
    setSelectedId(id);
  };

  // Seek the shared <video>; optimistically move the playhead so the UI responds
  // before the first timeupdate (and even if playback can't start).
  const seekTo = (seconds) => {
    setCurrentTime(seconds);
    const v = videoRef.current;
    if (v) { v.currentTime = seconds; v.pause(); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', minHeight: 0 }}>
      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReviewCanvas
            media={media}
            items={canvasItems}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            selectedId={selectedId}
            onSelect={setSelectedId}
            videoRef={videoRef}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
          />
        </div>
        {isVideo && (
          <VideoTimeline
            duration={duration}
            currentTime={currentTime}
            comments={feedback}
            selectedId={selectedId}
            onSeek={seekTo}
            onSelect={setSelectedId}
          />
        )}
      </div>

      <CommentSidebar
        comments={feedback}
        currentUser={currentUser}
        mediaType={media.type}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onSeek={seekTo}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onPost={postComment}
        currentTime={currentTime}
        mentionables={mentionables}
      />
    </div>
  );
}
