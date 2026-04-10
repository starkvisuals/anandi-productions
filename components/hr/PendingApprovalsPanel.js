'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { listPendingApprovals, approvePendingApproval, rejectPendingApproval, isHrFullAdmin } from '@/lib/hr';

/**
 * Producer-only panel showing pending approval requests from HR sub-admins.
 *
 * Props:
 *  - t        : theme tokens
 *  - onChange : called after each approve/reject so parent can refresh counts
 */
export default function PendingApprovalsPanel({ t, onChange }) {
  const { userProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listPendingApprovals(userProfile);
      setItems(list);
    } catch (err) {
      setError(err.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isHrFullAdmin(userProfile)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
        Only the primary producer can view pending approvals.
      </div>
    );
  }

  const approve = async (id) => {
    if (!window.confirm('Approve this change? It will be applied immediately.')) return;
    setBusyId(id);
    setError('');
    try {
      await approvePendingApproval(userProfile, id);
      await load();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Approval failed');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setBusyId(id);
    setError('');
    try {
      await rejectPendingApproval(userProfile, id, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
      await load();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Rejection failed');
    } finally {
      setBusyId(null);
    }
  };

  const formatValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>Loading approvals...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: t.danger, fontSize: '12px' }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px' }}>
          No pending approvals. 🎉
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} style={{ padding: '18px 20px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>
                  {humanAction(item.action)}
                </div>
                <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
                  Requested by <strong style={{ color: t.text }}>{item.requestedByName || item.requestedBy}</strong> · Target: <code style={{ fontFamily: 'ui-monospace, monospace' }}>{item.targetEmployee}</code>
                </div>
              </div>
              <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, color: t.warning || '#f59e0b', background: 'rgba(245,158,11,0.15)', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
                Pending
              </span>
            </div>

            {/* Diff */}
            <div style={{ background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '12px 14px', fontSize: '12px', fontFamily: 'ui-monospace, monospace' }}>
              {item.diff && Object.keys(item.diff).length > 0 ? (
                Object.entries(item.diff).map(([field, { from, to }]) => (
                  <div key={field} style={{ marginBottom: '8px' }}>
                    <div style={{ color: t.textMuted, fontWeight: 600, marginBottom: '2px' }}>{field}</div>
                    <div style={{ color: t.danger, whiteSpace: 'pre-wrap' }}>− {formatValue(from)}</div>
                    <div style={{ color: '#22c55e', whiteSpace: 'pre-wrap' }}>+ {formatValue(to)}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: t.textMuted }}>
                  {item.action === 'delete_employee' ? `Delete employee ${formatValue(item.currentValue)}` : 'No diff available'}
                </div>
              )}
            </div>

            {/* Actions */}
            {rejectingId === item.id ? (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection"
                  style={{
                    padding: '11px 13px',
                    background: t.bgInput,
                    border: `1px solid ${t.border}`,
                    borderRadius: '10px',
                    color: t.text,
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setRejectingId(null); setRejectReason(''); }} style={ghostBtn(t)}>Cancel</button>
                  <button onClick={() => reject(item.id)} disabled={busyId === item.id} style={dangerBtn(t, busyId === item.id)}>
                    {busyId === item.id ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button onClick={() => { setRejectingId(item.id); setRejectReason(''); }} disabled={busyId === item.id} style={ghostBtn(t)}>
                  Reject
                </button>
                <button onClick={() => approve(item.id)} disabled={busyId === item.id} style={primaryBtn(t, busyId === item.id)}>
                  {busyId === item.id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const humanAction = (action) => {
  const map = {
    update_employee: 'Update Employee',
    update_ctc: 'Update CTC',
    update_statutory: 'Update Statutory Fields',
    delete_employee: 'Delete Employee',
    toggle_employee_flag: 'Toggle Employee Flag',
    role_change: 'Role Change',
  };
  return map[action] || action;
};

const ghostBtn = (t) => ({
  padding: '9px 16px',
  background: 'transparent',
  color: t.text,
  border: `1px solid ${t.border}`,
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
});

const primaryBtn = (t, disabled) => ({
  padding: '9px 18px',
  background: t.gradientPrimary || t.primary,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

const dangerBtn = (t, disabled) => ({
  padding: '9px 18px',
  background: t.danger,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});
