'use client';
/**
 * Standalone test page for monthly payroll (Phase 2, chunk 4).
 * Visit:  /test/payroll
 *
 * Run after importing attendance for the same month (/test/attendance) for
 * accurate LOP. Without attendance, everyone is assumed fully present.
 */

import { useAuth } from '@/lib/auth-context';
import PayrollSheet from '@/components/hr/PayrollSheet';
import { canManageEmployees } from '@/lib/hr';

export default function TestPayrollPage() {
  const { user, userProfile, loading } = useAuth();
  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>🧪 Payroll Test Bench</h1>
      <p style={{ fontSize: '11px', color: '#666', marginBottom: '20px' }}>Nothing is saved until you click Finalize.</p>
      {loading ? (
        <div style={{ color: '#888', fontSize: 13 }}>Loading auth…</div>
      ) : !user ? (
        <div style={{ color: '#888', fontSize: 13 }}>⚠ Not signed in. Visit /login first.</div>
      ) : !canManageEmployees(userProfile) ? (
        <div style={{ color: '#888', fontSize: 13 }}>⛔ Admin only.</div>
      ) : (
        <div style={{ maxWidth: '900px', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <PayrollSheet actor={userProfile} />
        </div>
      )}
    </div>
  );
}
