'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme, SPACE, RADIUS, WEIGHT } from '@/lib/theme';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from './Logo';

// Icons inherit currentColor so they pick up the input's token colour.
const EnvelopeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 4L12 13L2 4" /></svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
);

export default function LoginPage() {
  const { t, mode } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleForgotPassword = async () => {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Enter your email above first, then tap “Forgot password?”'); return; }
    try {
      const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(getAuth(), email.trim());
      setInfo('Password reset link sent to your email. Check inbox & spam. If it doesn’t arrive, ask HR to re-share your temporary password.');
    } catch (err) {
      if (err?.code === 'auth/user-not-found') setError('No account found for that email.');
      else setError(err?.message || 'Could not send reset email.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') setError('Invalid email or password');
      else if (err.code === 'auth/invalid-credential') setError('Invalid credentials. Please check your email and password.');
      else setError(err.message || 'Login failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', flexDirection: isMobile ? 'column' : 'row', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Branding hero — a fixed near-black brand statement (both themes), yellow-lit */}
      {!isMobile && (
        <div style={{ width: '55%', background: '#0a0a0f', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 45%, rgba(250,204,21,0.08) 0%, transparent 62%), radial-gradient(ellipse at 72% 82%, rgba(250,204,21,0.05) 0%, transparent 58%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: '-50%', width: '200%', height: '200%', background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, opacity: 0.03, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '15%', left: '10%', width: '80px', height: '80px', border: '1px solid rgba(250,204,21,0.12)', borderRadius: '16px', transform: 'rotate(15deg)' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '60px', height: '60px', border: '1px solid rgba(250,204,21,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: '60%', left: '18%', width: '40px', height: '40px', border: '1px solid rgba(250,204,21,0.06)', borderRadius: '8px', transform: 'rotate(-20deg)' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE['6'] }}>
            <Logo variant="full" size={60} theme="dark" />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: WEIGHT.regular, margin: 0 }}>
              Production Management System
            </p>
          </div>
        </div>
      )}

      {/* Form panel — theme-aware */}
      <div style={{ width: isMobile ? '100%' : '45%', minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 24px' : '40px 48px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: SPACE['8'] }}>
              <Logo variant="full" size={44} theme={mode} />
            </div>
          )}

          <div style={{ marginBottom: SPACE['8'] }}>
            <h1 style={{ fontSize: 28, fontWeight: WEIGHT.bold, color: t.text, margin: '0 0 6px 0' }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: t.textMuted, margin: 0 }}>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACE['4'] }}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              iconLeft={<EnvelopeIcon />}
              required
              autoComplete="email"
            />

            {/* Password with an overlaid show/hide toggle (Input's iconRight isn't clickable) */}
            <div style={{ position: 'relative' }}>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                iconLeft={<LockIcon />}
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 12, bottom: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: t.textMuted }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  {showPassword && <line x1="1" y1="1" x2="23" y2="23" />}
                </svg>
              </button>
            </div>

            {error && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: SPACE['2'], padding: `10px ${SPACE['3']}`, background: `${t.danger}14`, border: `1px solid ${t.danger}33`, borderRadius: RADIUS.md }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span style={{ color: t.danger, fontSize: 13 }}>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg" loading={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>

            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={handleForgotPassword}
                style={{ background: 'none', border: 'none', color: t.textSecondary, fontSize: 13, cursor: 'pointer', padding: 4, fontWeight: WEIGHT.medium }}
                onMouseEnter={(e) => (e.currentTarget.style.color = t.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = t.textSecondary)}>
                Forgot password?
              </button>
              {info && <div style={{ marginTop: 8, fontSize: 12, color: t.success, lineHeight: 1.5 }}>{info}</div>}
            </div>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: t.textDisabled, marginTop: SPACE['10'] }}>
            Contact your admin if you don&apos;t have an account
          </p>
        </div>
      </div>
    </div>
  );
}
