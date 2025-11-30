'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// Mux Player Component with HLS.js fallback
// Uses native HLS on Safari, HLS.js on other browsers
const MuxPlayer = forwardRef(({ 
  playbackId, 
  poster,
  autoPlay = false,
  muted = false,
  loop = false,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onError,
  style = {},
  controls = true,
  showTimecode = true,
}, ref) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Expose video element methods to parent
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    get currentTime() { return videoRef.current?.currentTime || 0; },
    set currentTime(time) { if (videoRef.current) videoRef.current.currentTime = time; },
    get duration() { return videoRef.current?.duration || 0; },
    get paused() { return videoRef.current?.paused ?? true; },
    get playbackRate() { return videoRef.current?.playbackRate || 1; },
    set playbackRate(rate) { if (videoRef.current) videoRef.current.playbackRate = rate; },
  }));

  // Format timecode HH:MM:SS:FF (24fps)
  const formatTimecode = (seconds, fps = 24) => {
    if (!seconds && seconds !== 0) return '00:00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}:${f.toString().padStart(2,'0')}`;
  };

  // HLS stream URL from Mux
  const streamUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
  
  // Thumbnail URL
  const thumbnailUrl = playbackId 
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`
    : poster;

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    // Check if browser natively supports HLS (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      setIsLoading(false);
    } else {
      // Use HLS.js for other browsers
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });
          
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            if (autoPlay) {
              video.play().catch(() => {});
            }
          });
          
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('HLS fatal error:', data);
              setError('Video playback error');
              if (onError) onError(data);
            }
          });
        } else {
          setError('HLS not supported');
        }
      }).catch(err => {
        console.error('Failed to load HLS.js:', err);
        // Fallback to direct URL
        video.src = streamUrl;
        setIsLoading(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, autoPlay]);

  // Event handlers
  const handleTimeUpdate = () => {
    const time = videoRef.current?.currentTime || 0;
    setCurrentTime(time);
    if (onTimeUpdate) onTimeUpdate(time);
  };

  const handleDurationChange = () => {
    const dur = videoRef.current?.duration || 0;
    setDuration(dur);
    if (onDurationChange) onDurationChange(dur);
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => {
    setIsPlaying(false);
    if (onEnded) onEnded();
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const seek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const changePlaybackRate = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  if (!playbackId) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0a0f',
        color: 'rgba(255,255,255,0.5)',
        ...style 
      }}>
        No video available
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', ...style }}>
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={thumbnailUrl}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        controls={controls}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
        }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          color: '#ef4444',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Pro Timecode Display */}
      {showTimecode && !controls && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'rgba(0,0,0,0.8)',
          padding: '8px 14px',
          borderRadius: '6px',
          fontFamily: 'monospace',
          fontSize: '14px',
          fontWeight: '600',
          color: '#22c55e',
          letterSpacing: '1px',
        }}>
          {formatTimecode(currentTime)}
        </div>
      )}

      {/* Playback Rate Indicator */}
      {playbackRate !== 1 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(99,102,241,0.9)',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          {playbackRate}x
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

MuxPlayer.displayName = 'MuxPlayer';

export default MuxPlayer;

// Utility function to get Mux thumbnail URL
export const getMuxThumbnail = (playbackId, options = {}) => {
  if (!playbackId) return null;
  const { time = 0, width = 640, height, fit = 'crop' } = options;
  let url = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
  if (width) url += `&width=${width}`;
  if (height) url += `&height=${height}`;
  if (fit) url += `&fit_mode=${fit}`;
  return url;
};

// Utility function to get Mux animated GIF
export const getMuxGif = (playbackId, options = {}) => {
  if (!playbackId) return null;
  const { start = 0, end = 5, width = 320, fps = 15 } = options;
  return `https://image.mux.com/${playbackId}/animated.gif?start=${start}&end=${end}&width=${width}&fps=${fps}`;
};

// Utility function to get Mux storyboard
export const getMuxStoryboard = (playbackId) => {
  if (!playbackId) return null;
  return `https://image.mux.com/${playbackId}/storyboard.vtt`;
};
