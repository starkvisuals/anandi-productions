'use client';

import { useState, useEffect } from 'react';
import Logo from './Logo';

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState('dark'); // dark, logo, tagline, lightleak, fadeout

  useEffect(() => {
    // Phase timeline:
    // 0-300ms: dark screen
    // 300ms: logo animates in (Logo component handles its own animation)
    // 1000ms: tagline fades in
    // 1500ms: light leak sweeps
    // 2000ms: whole screen fades out
    // 2500ms: onComplete() called

    const timers = [
      setTimeout(() => setPhase('logo'), 300),
      setTimeout(() => setPhase('tagline'), 1000),
      setTimeout(() => setPhase('lightleak'), 1500),
      setTimeout(() => setPhase('fadeout'), 2000),
      setTimeout(() => onComplete?.(), 2500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const phaseIndex = ['dark', 'logo', 'tagline', 'lightleak', 'fadeout'].indexOf(phase);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'fadeout' ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        overflow: 'hidden',
      }}
    >
      {/* Film grain overlay */}
      <div
        style={{
          position: 'absolute',
          inset: '-50%',
          width: '200%',
          height: '200%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          opacity: 0.06,
          animation: 'grain 0.5s steps(6) infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Light leak effect */}
      {phaseIndex >= 3 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.08), transparent 70%)',
            backgroundSize: '200% 200%',
            animation: 'lightLeak 1.2s ease-in-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Logo container */}
      <div
        style={{
          opacity: phaseIndex >= 1 ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        {phaseIndex >= 1 && (
          <Logo variant="icon" size={80} animated={true} theme="dark" />
        )}
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: 28,
          opacity: phaseIndex >= 2 ? 1 : 0,
          transform: phaseIndex >= 2 ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '14px',
          fontWeight: 300,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.5)',
          textAlign: 'center',
        }}
      >
        Where Creativity Meets Production
      </div>
    </div>
  );
}
