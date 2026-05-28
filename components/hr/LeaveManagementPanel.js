'use client';
/**
 * LeaveManagementPanel — dual-mode leave view.
 *
 *   Employee: their balance cards + "Request leave" + own history.
 *   Admin (producer/HR): a "Pending approvals" queue (approve/reject) PLUS
 *   the ability to view any employee's balance.
 *
 * Props:
 *   actor       — current user profile
 *   employeeId  — optional; admin viewing a specific employee's balance.
 *                 Defaults to actor.id (self-service).
 *   t           — theme tokens (optional)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getLeaveRequests, getLeaveBalance, approveLeaveRequest, rejectLeaveRequest,
  cancelLeaveRequest, canManageEmployees, LEAVE_QUOTAS,
} from '@/lib/hr';
import LeaveRequestModal from './LeaveRequestModal';

const TYPE_LABEL = { annual: 'Annual', sick: 'Sick', casual: 'Casual', 'comp-off': 'Comp-off' };
const TYPE_COLOR = { annual: '#6366f1', sick: '#ef4444', casual: '#f59e0b', 'comp-off': '#22c55e' };
const STATUS_STYLE = {
  pending:  { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending' },
  approved: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'Approved' },
  rejected: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'Rejected' },
};

function BalanceCard({ label, used, quota, color }) {
  const left = quota - used;
  return (
    <div style={{ flex: 1, minWidth: '110px', padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{left}<span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}> / {quota}</span></div>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{used} used</div>
    </div>
  );
}

export default function LeaveManagementPanel({ actor, employeeId, t }) {
  const isAdmin = canManageEmployees(actor);
  const viewUid = employeeId || actor?.id;

  const [balance, setBalance] = useState(null);
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState([]); // admin: all pending across team
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bal, mine] = await Promise.all([
        getLeaveBalance(actor, viewUid).catch(() => null),
        getLeaveRequests(actor, viewUid),
      ]);
      setBalance(bal);
      setRequests(mine);
      if (isAdmin) {
        const all = await getLeaveRequests(actor, null);
        setPending(all.filter(r => r.status === 'pending'));
      }
    } catch (e) {
      setError(e.message || 'Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, [actor, viewUid, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  const doApprove = async (id) => {
    setBusyId(id); setError(null);
    try { await approveLeaveRequest(actor, id); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  };
  const doReject = async (id) => {
    const reason = window.prompt('Reason for rejection (optional):') ?? '';
    setBusyId(id); setError(null);
    try { await rejectLeaveRequest(actor, id, reason); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  };
  const doCancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    setBusyId(id);
    try { await cancelLeaveRequest(actor, id); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  };

  const RequestRow = ({ r, showEmployee, showActions, allowCancel }) => {
    const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TYPE_COLOR[r.type] || '#888', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
            {showEmployee && <span>{r.employeeName} · </span>}
            {TYPE_LABEL[r.type] || r.type} · {r.days} day{r.days === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
            {r.fromDate}{r.toDate && r.toDate !== r.fromDate ? ` → ${r.toDate}` : ''}{r.halfDay ? ' (half day)' : ''}
            {r.reason ? ` · ${r.reason}` : ''}
          </div>
          {r.certificateUrl && (
            <a href={r.certificateUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#6366f1' }}>📎 Certificate</a>
          )}
          {r.rejectionReason && <div style={{ fontSize: '10px', color: '#ef4444' }}>Rejected: {r.rejectionReason}</div>}
        </div>
        {showActions && r.status === 'pending' ? (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => doApprove(r.id)} disabled={busyId === r.id} style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Approve</button>
            <button onClick={() => doReject(r.id)} disabled={busyId === r.id} style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>Reject</button>
          </div>
        ) : (
          <span style={{ padding: '2px 8px', borderRadius: '10px', background: st.bg, color: st.color, fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
        )}
        {allowCancel && r.status === 'pending' && (
          <button onClick={() => doCancel(r.id)} disabled={busyId === r.id} title="Cancel" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✕</button>
        )}
      </div>
    );
  };

  return (
    <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Balance + request */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
            {employeeId && isAdmin ? 'Leave Balance' : 'My Leave Balance'}
          </h3>
          <button onClick={() => setShowRequest(true)} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Request Leave
          </button>
        </div>
        {loading && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Loading…</div>}
        {balance && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <BalanceCard label="Annual" used={balance.used.annual} quota={LEAVE_QUOTAS.annual} color={TYPE_COLOR.annual} />
            <BalanceCard label="Sick" used={balance.used.sick} quota={LEAVE_QUOTAS.sick} color={TYPE_COLOR.sick} />
            <BalanceCard label="Casual" used={balance.used.casual} quota={LEAVE_QUOTAS.casual} color={TYPE_COLOR.casual} />
          </div>
        )}
        {balance && (balance.thisMonth.sick > 0 || balance.thisMonth.casual > 0) && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
            This month: {balance.thisMonth.sick} sick, {balance.thisMonth.casual} casual used (cap 1 each/month).
          </div>
        )}
      </div>

      {error && <div style={{ fontSize: '12px', color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>⚠ {error}</div>}

      {/* Admin: pending approvals queue */}
      {isAdmin && !employeeId && (
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>
            Pending Approvals {pending.length > 0 && <span style={{ color: '#fbbf24' }}>({pending.length})</span>}
          </h3>
          {pending.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', padding: '14px', textAlign: 'center' }}>No pending leave requests.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pending.map(r => <RequestRow key={r.id} r={r} showEmployee showActions />)}
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>
          {employeeId && isAdmin ? 'Leave History' : 'My Requests'}
        </h3>
        {requests.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', padding: '14px', textAlign: 'center' }}>No leave requests yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {requests.map(r => <RequestRow key={r.id} r={r} allowCancel={!isAdmin || r.employeeId === actor.id} />)}
          </div>
        )}
      </div>

      {showRequest && (
        <LeaveRequestModal
          actor={actor}
          employeeId={viewUid}
          onSaved={refresh}
          onClose={() => setShowRequest(false)}
        />
      )}
    </div>
  );
}
