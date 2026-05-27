'use client';
/**
 * Standalone test page for the HR / Employee module.
 * Visit:  /test/hr
 *
 * Purpose: verify the EmployeeModule (list + Add + Import Existing + Detail)
 * works in isolation BEFORE wiring into MainApp.js. Uses your live Firebase
 * — you'll be creating REAL employee records here, so don't add test data
 * you can't archive afterwards.
 *
 * Requires: signed-in producer or HR admin (read off useAuth()).
 */

import { useAuth } from '@/lib/auth-context';
import EmployeeModule from '@/components/hr/EmployeeModule';
import { canAccessHr, isHrFullAdmin } from '@/lib/hr';

// Minimal dark theme tokens (matches what the HR components consume from MainApp's t).
const TEST_THEME = {
  bg: '#0a0a0a',
  bgCard: '#141414',
  bgInput: '#1a1a1a',
  bgSecondary: '#121212',
  bgGlass: 'rgba(20,20,20,0.6)',
  bgGlassBorder: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',
  text: '#fff',
  textSecondary: 'rgba(255,255,255,0.75)',
  textMuted: 'rgba(255,255,255,0.5)',
  primary: '#6366f1',
  accent: '#6366f1',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  gradientPrimary: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  shadow: '0 4px 14px rgba(0,0,0,0.4)',
  cardRadius: '12px',
  blur: 'blur(12px)',
};

export default function TestHrPage() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return <Shell><div style={{ padding: 40, color: '#888' }}>Loading auth…</div></Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <div style={{ padding: 40, color: '#888', fontSize: 13 }}>
          ⚠ You're not signed in. Visit <code>/login</code> first, then come back here.
        </div>
      </Shell>
    );
  }

  if (!canAccessHr(userProfile)) {
    return (
      <Shell>
        <div style={{ padding: 40, color: '#888', fontSize: 13 }}>
          ⛔ You don't have HR access. This module is only for producers and HR admins.
          <div style={{ marginTop: 12, fontSize: 11 }}>
            Your role: <code>{userProfile?.role || 'unknown'}</code> ·{' '}
            isProducer: {String(userProfile?.role === 'producer')} ·{' '}
            isHrAdmin: {String(!!userProfile?.isHrAdmin)} ·{' '}
            isPrimaryProducer: {String(!!userProfile?.isPrimaryProducer)}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Banner userProfile={userProfile} />
      <div style={{
        flex: 1, minHeight: 0,
        background: TEST_THEME.bgCard,
        borderRadius: '12px',
        border: `1px solid ${TEST_THEME.border}`,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <EmployeeModule t={TEST_THEME} />
      </div>
    </Shell>
  );
}

// ─── Layout wrapper ─────────────────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      color: '#fff',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>🧪 HR Module Test Bench</h1>
        <span style={{ fontSize: '11px', color: '#666' }}>
          Live Firebase — anything you create here goes to your real users collection
        </span>
      </header>
      {children}
    </div>
  );
}

// ─── Status banner showing who's signed in + admin tier ─────────────────────
function Banner({ userProfile }) {
  const tier = isHrFullAdmin(userProfile)
    ? { label: '👑 Full HR Admin (Producer)', color: '#22c55e' }
    : userProfile?.isHrAdmin
    ? { label: '🔧 HR Sub-Admin', color: '#fbbf24' }
    : { label: '👤 Employee (self-service)', color: '#6366f1' };

  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px',
      fontSize: '11px',
      display: 'flex', alignItems: 'center', gap: '14px',
      flexWrap: 'wrap',
    }}>
      <span>
        Signed in as <strong>{userProfile?.name || userProfile?.email}</strong>
      </span>
      <span style={{ color: tier.color, fontWeight: 600 }}>{tier.label}</span>
      <span style={{ marginLeft: 'auto', color: '#888' }}>
        Try: 1) Add a new employee · 2) Import an existing user · 3) Edit/Archive a row
      </span>
    </div>
  );
}
