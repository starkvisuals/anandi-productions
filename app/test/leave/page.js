'use client';
/**
 * Standalone test page for the leave ledger (Phase 2, chunk 1).
 * Visit:  /test/leave
 *
 * Uses live Firebase — requests/approvals you make here are real.
 * As producer you'll see the approvals queue; as an employee you'd see
 * only your own balance + requests.
 */

import { useAuth } from '@/lib/auth-context';
import LeaveManagementPanel from '@/components/hr/LeaveManagementPanel';
import { canAccessHr } from '@/lib/hr';

export default function TestLeavePage() {
  const { user, userProfile, loading } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>🧪 Leave Ledger Test Bench</h1>
      <p style={{ fontSize: '11px', color: '#666', marginBottom: '20px' }}>
        Rules: 6 annual / 6 sick / 6 casual per year · sick needs a certificate · max 1 sick + 1 casual paid per month.
      </p>

      {loading ? (
        <div style={{ color: '#888', fontSize: 13 }}>Loading auth…</div>
      ) : !user ? (
        <div style={{ color: '#888', fontSize: 13 }}>⚠ Not signed in. Visit /login first.</div>
      ) : !canAccessHr(userProfile) ? (
        <div style={{ color: '#888', fontSize: 13 }}>⛔ No HR access for this account.</div>
      ) : (
        <div style={{ maxWidth: '760px', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <LeaveManagementPanel actor={userProfile} />
        </div>
      )}
    </div>
  );
}
