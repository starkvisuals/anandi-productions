'use client';
/**
 * ImportExistingUserModal — convert an existing user (core team, freelancer,
 * etc.) into an employee record. For migrating people who are already in the
 * `users` collection but don't yet have `isEmployee: true`.
 *
 * Tiny, focused. Sister to AddEmployeeModal (which creates net-new accounts).
 *
 * Why this is separate:
 *   - AddEmployeeModal creates a Firebase Auth account + sends invite — wrong
 *     path for someone who already has an account.
 *   - createEmployee() in lib/hr uses updateDoc, so it works on any uid that
 *     already exists in the users collection.
 *
 * Props:
 *   t          — theme tokens
 *   onClose    — close handler
 *   onCreated  — called after successful conversion ({ uid })
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getUsers } from '@/lib/firestore';
import { createEmployee, EMPLOYMENT_TYPES, DEPARTMENTS } from '@/lib/hr';

const inputStyle = {
  padding: '7px 10px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        {hint && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: '6px' }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function ImportExistingUserModal({ onClose, onCreated }) {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    designation: '',
    department: 'Production',
    employmentType: 'full-time',
    workerClass: 'employee',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    workLocation: '',
    reportingManager: '',
    jibbleName: '',
    annualCtc: '',
    probationMonths: '',
    probationMonthlySalary: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Load all non-employee users
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getUsers();
        if (cancelled) return;
        setUsers(all.filter(u => !u.isEmployee));
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => users.find(u => u.id === selectedUid), [users, selectedUid]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  // Prefill jibbleName from selected user name
  useEffect(() => {
    if (selected && !form.jibbleName) {
      setForm(f => ({ ...f, jibbleName: selected.name || '' }));
    }
  }, [selected]); // eslint-disable-line

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedUid) { setError('Pick a user to convert first'); return; }
    if (!form.designation.trim()) { setError('Designation is required'); return; }
    if (!form.dateOfJoining) { setError('Date of joining is required'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const probMonths = parseInt(form.probationMonths, 10) || 0;
      const probSalary = parseFloat(form.probationMonthlySalary) || 0;
      const payload = {
        ...form,
        ctc: form.annualCtc ? { annual: Number(form.annualCtc), effectiveFrom: form.dateOfJoining, structure: {}, history: [] } : null,
        probation: (probMonths > 0 && probSalary > 0) ? { months: probMonths, monthlySalary: probSalary } : null,
      };
      delete payload.annualCtc;
      delete payload.probationMonths;
      delete payload.probationMonthlySalary;
      await createEmployee(userProfile, selectedUid, payload);
      if (onCreated) onCreated({ uid: selectedUid });
      onClose?.();
    } catch (err) {
      setError(err.message || 'Conversion failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '640px', maxHeight: '90vh',
        background: '#101010',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        display: 'flex', flexDirection: 'column',
        color: '#fff',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>↻ Convert Existing User to Employee</h2>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>
              For migrating existing team members. They keep their account; we add HR fields.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* User search + picker */}
          <Field label="Search & pick user" required hint={`${users.length} non-employee users`}>
            <input
              type="text"
              placeholder="Type name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{
            maxHeight: '160px', overflowY: 'auto',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
          }}>
            {loading && <div style={{ padding: '12px', color: '#888', fontSize: '11px' }}>Loading users…</div>}
            {!loading && filteredUsers.length === 0 && <div style={{ padding: '12px', color: '#888', fontSize: '11px' }}>No matching users</div>}
            {filteredUsers.map(u => (
              <div
                key={u.id}
                onClick={() => setSelectedUid(u.id)}
                style={{
                  padding: '8px 12px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer',
                  background: selectedUid === u.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (selectedUid !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (selectedUid !== u.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, flexShrink: 0,
                }}>{(u.name || u.email || '?').slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name || '(unnamed)'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email || 'no email'} · {u.isCore ? 'Core' : u.isFreelancer ? 'Freelancer' : u.isClient ? 'Client' : u.role || 'User'}
                  </div>
                </div>
                {selectedUid === u.id && <span style={{ color: '#6366f1', fontSize: '13px', flexShrink: 0 }}>✓</span>}
              </div>
            ))}
          </div>

          {/* HR field form — only show after a user is picked */}
          {selected && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HR Fields for {selected.name}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="Designation" required>
                  <input value={form.designation} onChange={e => set('designation', e.target.value)} style={inputStyle} placeholder="Editor / Producer / etc." />
                </Field>
                <Field label="Department">
                  <select value={form.department} onChange={e => set('department', e.target.value)} style={inputStyle}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Employment Type">
                  <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)} style={inputStyle}>
                    {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{typeof v === 'string' ? v : v.label || k}</option>)}
                  </select>
                </Field>
                <Field label="Worker Class" hint="employee = on payroll">
                  <select value={form.workerClass} onChange={e => set('workerClass', e.target.value)} style={inputStyle}>
                    <option value="employee">Employee (on rolls)</option>
                    <option value="contractor">Contractor / Freelancer</option>
                  </select>
                </Field>
                <Field label="Date of Joining" required>
                  <input type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Annual CTC (₹)" hint="full salary × 12 (post-probation)">
                  <input type="number" value={form.annualCtc} onChange={e => set('annualCtc', e.target.value)} style={inputStyle} placeholder="e.g. 600000" />
                </Field>
                <Field label="Work Location">
                  <input value={form.workLocation} onChange={e => set('workLocation', e.target.value)} style={inputStyle} placeholder="Mumbai / Remote" />
                </Field>
                <Field label="Probation period (months)" hint="blank = none">
                  <input type="number" value={form.probationMonths} onChange={e => set('probationMonths', e.target.value)} style={inputStyle} placeholder="e.g. 2" />
                </Field>
                <Field label="Probation salary (₹/month)" hint="reduced pay during probation">
                  <input type="number" value={form.probationMonthlySalary} onChange={e => set('probationMonthlySalary', e.target.value)} style={inputStyle} placeholder="e.g. 20000" />
                </Field>
                <Field label="Reporting Manager">
                  <input value={form.reportingManager} onChange={e => set('reportingManager', e.target.value)} style={inputStyle} placeholder="Name or UID" />
                </Field>
                <Field label="Jibble Name" hint="exact match for attendance CSV">
                  <input value={form.jibbleName} onChange={e => set('jibbleName', e.target.value)} style={inputStyle} placeholder={selected.name} />
                </Field>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {error && <span style={{ fontSize: '11px', color: '#ef4444', flex: 1 }}>⚠ {error}</span>}
          {!error && selected && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', flex: 1 }}>
            Will set isEmployee=true and assign a new AP-### ID.
          </span>}
          {!error && !selected && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', flex: 1 }}>
            Pick a user above to fill in HR fields.
          </span>}
          <button type="button" onClick={onClose} disabled={submitting} style={{ ...inputStyle, width: 'auto', padding: '7px 14px', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={submitting || !selected} style={{
            padding: '7px 18px', borderRadius: '6px',
            background: submitting || !selected ? 'rgba(99,102,241,0.3)' : '#6366f1',
            border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700,
            cursor: submitting || !selected ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? 'Converting…' : 'Convert to Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
