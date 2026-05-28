'use client';
/**
 * Standalone test page for Jibble attendance import (Phase 2, chunk 3).
 * Visit:  /test/attendance
 *
 * Upload any Jibble CSV export. The page auto-detects columns, lets you
 * fix the mapping, previews each employee's classified month, and (on
 * confirm) saves the month + credits overtime to comp-off banks.
 */

import { useAuth } from '@/lib/auth-context';
import AttendanceImport from '@/components/hr/AttendanceImport';
import { canManageEmployees } from '@/lib/hr';

export default function TestAttendancePage() {
  const { user, userProfile, loading } = useAuth();
  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>🧪 Jibble Attendance Import Test Bench</h1>
      <p style={{ fontSize: '11px', color: '#666', marginBottom: '20px' }}>Upload a Jibble CSV. Nothing is saved until you click Confirm.</p>
      {loading ? (
        <div style={{ color: '#888', fontSize: 13 }}>Loading auth…</div>
      ) : !user ? (
        <div style={{ color: '#888', fontSize: 13 }}>⚠ Not signed in. Visit /login first.</div>
      ) : !canManageEmployees(userProfile) ? (
        <div style={{ color: '#888', fontSize: 13 }}>⛔ Admin only.</div>
      ) : (
        <div style={{ maxWidth: '920px', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <AttendanceImport actor={userProfile} />
        </div>
      )}
    </div>
  );
}
