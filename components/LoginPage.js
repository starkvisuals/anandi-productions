'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Logo from './Logo';

const INPUT_STYLE = {
  width: '100%',
  padding: '14px 14px 14px 44px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  boxSizing: 'border-box',
};

const envelopeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 4L12 13L2 4" />
  </svg>
);

const lockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const errorIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const iconWrapStyle = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  pointerEvents: 'none',
};

const handleFocus = (e) => {
  e.target.style.borderColor = 'rgba(99,102,241,0.6)';
  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
};

const handleBlur = (e) => {
  e.target.style.borderColor = 'rgba(255,255,255,0.08)';
  e.target.style.boxShadow = 'none';
};

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid credentials. Please check your email and password.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    }

    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      {/* Branding panel (desktop left side) */}
      {!isMobile && (
        <div style={{
          width: '55%',
          background: '#0a0a0f',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse at 70% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            inset: '-50%',
            width: '200%',
            height: '200%',
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            opacity: 0.03,
            pointerEvents: 'none',
            animation: 'grain 8s steps(10) infinite',
          }} />
          <div style={{ position: 'absolute', top: '15%', left: '10%', width: '80px', height: '80px', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '16px', transform: 'rotate(15deg)' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '60px', height: '60px', border: '1px solid rgba(168,85,247,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: '60%', left: '18%', width: '40px', height: '40px', border: '1px solid rgba(99,102,241,0.06)', borderRadius: '8px', transform: 'rotate(-20deg)' }} />
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}>
            <Logo variant="full" size={60} theme="dark" />
            <p style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '13px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontWeight: 400,
              margin: 0,
            }}>
              Production Management System
            </p>
          </div>
        </div>
      )}

      {/* Form panel */}
      <div style={{
        width: isMobile ? '100%' : '45%',
        minHeight: '100vh',
        background: '#12121a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '40px 48px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {isMobile && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '36px',
            }}>
              <Logo variant="icon" size={48} theme="dark" />
              <div style={{
                marginTop: '12px',
                fontSize: '22px',
                fontWeight: 800,
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '4px',
              }}>
                ANANDI
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '2px',
                marginTop: '2px',
              }}>
                Productions
              </div>
            </div>
          )}

          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 8px 0',
            }}>
              Welcome back
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.4)',
              margin: 0,
            }}>
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email field */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '6px',
                fontWeight: 500,
              }}>Email</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrapStyle}>{envelopeIcon}</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={INPUT_STYLE}
                  placeholder="you@example.com"
                  required
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '6px',
                fontWeight: 500,
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrapStyle}>{lockIcon}</div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...INPUT_STYLE, paddingRight: '44px' }}
                  placeholder="Enter your password"
                  required
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  tabIndex={-1}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <line x1="1" y1="1" x2="23" y2="23" />}
                  </svg>
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                marginBottom: '20px',
              }}>
                {errorIcon}
                <span style={{ color: '#f87171', fontSize: '13px' }}>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxSizing: 'border-box',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Forgot password link */}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(99,102,241,0.7)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onClick={() => {}}
              >
                Forgot password?
              </button>
            </div>
          </form>

          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.25)',
            marginTop: '40px',
          }}>
            Contact your admin if you don&apos;t have an account
          </p>
        </div>
      </div>
    </div>
  );
}
