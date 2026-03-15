'use client';

import { useAuth } from '@/lib/auth-context';
import HiringDashboard from '@/components/hiring/HiringDashboard';
import LoginPage from '@/components/LoginPage';

export default function HiringPage() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #1e1e2e', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <LoginPage />;
  }

  // Only producers, admins, and core team can access hiring
  const canAccess = userProfile.isCore || ['producer', 'admin', 'team-lead'].includes(userProfile.role);
  if (!canAccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#e4e4e7', fontSize: '20px', marginBottom: '8px' }}>Access Restricted</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>You don't have permission to access the Hiring Dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14' }}>
      {/* Top nav */}
      <div style={{ background: '#12121a', borderBottom: '1px solid #1e1e2e', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '12px', height: '56px' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🎬</div>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>Anandi Productions</span>
        </a>
        <span style={{ color: '#1e1e2e' }}>/</span>
        <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: '600' }}>Hiring Dashboard</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: '#1e1e2e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
            {userProfile.avatar || '👤'}
          </div>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>{userProfile.firstName || userProfile.name}</span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '28px 28px', maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ color: '#e4e4e7', fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }}>AI Hiring Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            Manage interview links, review candidates, and take hiring decisions
          </p>
        </div>
        <HiringDashboard />
      </div>
    </div>
  );
}
