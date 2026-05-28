'use client';
/**
 * LeaveRequestModal — an employee (or admin on their behalf) raises a leave
 * request. Enforces the sick-leave certificate requirement at the UI level;
 * the data layer (lib/hr.requestLeave) enforces it again.
 *
 * Props:
 *   actor       — current user profile
 *   employeeId  — whose leave (defaults to actor.id)
 *   onSaved     — () => void after a successful request
 *   onClose     — () => void
 */

import { useState } from 'react';
import { requestLeave, uploadLeaveCertificate, LEAVE_TYPES, LEAVE_QUOTAS, MONTHLY_LEAVE_CAP } from '@/lib/hr';

const inputStyle = {
  padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
  color: '#fff', fontSize: '12px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        {hint && <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: '6px' }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function LeaveRequestModal({ actor, employeeId, onSaved, onClose }) {
  const targetUid = employeeId || actor?.id;
  const [type, setType] = useState('annual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isSick = type === 'sick';
  const isCompOff = type === 'comp-off';

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    if (!fromDate) { setError('Pick a start date'); return; }
    if (isSick && !certFile) { setError('Sick leave requires a doctor\'s certificate'); return; }
    setBusy(true);
    try {
      let certificateUrl = null;
      if (isSick && certFile) {
        const res = await uploadLeaveCertificate(targetUid, certFile);
        certificateUrl = res.url;
      }
      await requestLeave(actor, {
        employeeId: targetUid,
        type,
        fromDate,
        toDate: halfDay ? fromDate : (toDate || fromDate),
        halfDay,
        reason,
        certificateUrl,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '460px', background: '#101010',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
        color: '#fff', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Request Leave</h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="Leave type" required>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
            </select>
          </Field>

          {/* Rule hints */}
          {isSick && (
            <div style={{ fontSize: '10px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '6px', padding: '8px 10px' }}>
              Sick leave requires a doctor's certificate, and only 1 sick leave per month is paid.
            </div>
          )}
          {type === 'casual' && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
              Only 1 casual leave per month is paid. Beyond that = loss of pay.
            </div>
          )}
          {isCompOff && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
              Comp-off can only be redeemed once you have ≥10 banked overtime hours (subject to approval).
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: halfDay ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <Field label="From" required>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
            </Field>
            {!halfDay && (
              <Field label="To" hint="same as from for 1 day">
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
              </Field>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={halfDay} onChange={e => { setHalfDay(e.target.checked); if (e.target.checked) setToDate(''); }} />
            Half day (0.5)
          </label>

          {isSick && (
            <Field label="Doctor's certificate" required hint="image or PDF">
              <input type="file" accept="image/*,application/pdf" onChange={e => setCertFile(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: '6px' }} />
            </Field>
          )}

          <Field label="Reason">
            <textarea value={reason} onChange={e => setReason(e.target.value)} style={{ ...inputStyle, minHeight: '54px', resize: 'vertical' }} placeholder="Optional note for your manager" />
          </Field>

          {error && <div style={{ fontSize: '11px', color: '#ef4444' }}>⚠ {error}</div>}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...inputStyle, width: 'auto', padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy} style={{
            padding: '8px 18px', borderRadius: '6px', border: 'none',
            background: busy ? 'rgba(99,102,241,0.4)' : '#6366f1',
            color: '#fff', fontSize: '12px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
    </div>
  );
}
