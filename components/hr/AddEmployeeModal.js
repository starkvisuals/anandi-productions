'use client';
import { useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUser } from '@/lib/firestore';
import { useAuth } from '@/lib/auth-context';
import { createEmployee, EMPLOYMENT_TYPES, DEPARTMENTS } from '@/lib/hr';

/**
 * Admin modal to add a new employee. Creates a Firebase Auth account with a
 * temporary password, creates the users/{uid} doc, marks them as employee, and
 * sends a password reset / onboarding invite email.
 *
 * Props:
 *  - t        : theme tokens
 *  - onClose  : close handler
 *  - onCreated: called after successful create
 */
export default function AddEmployeeModal({ t, onClose, onCreated }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    employmentType: 'full-time',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    annualCtc: '',
    reportingManager: '',
    jibbleName: '',
    workerClass: 'employee', // 'employee' | 'contractor'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [copied, setCopied] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    } catch (err) {
      console.warn('Copy failed:', err?.message);
    }
  };

  const finishAndClose = () => {
    if (createdEmployee) {
      onCreated?.({ uid: createdEmployee.uid, email: createdEmployee.email });
    } else {
      onClose?.();
    }
  };

  const generateTempPassword = () => {
    return `AP${Math.random().toString(36).slice(-8)}${Math.floor(Math.random() * 100)}`;
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!form.designation.trim() || !form.department.trim()) {
      setError('Designation and department are required.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create Firebase Auth account with a temporary password
      const tempPassword = generateTempPassword();
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), tempPassword);
      const uid = cred.user.uid;

      // 2. Create the user doc (non-HR base fields, following existing app patterns)
      await createUser(uid, {
        email: form.email.trim(),
        name: form.name.trim(),
        firstName: form.name.trim().split(' ')[0] || form.name.trim(),
        phone: form.phone.trim(),
        designation: form.designation.trim(),
        role: 'team-member',
        isCore: true,
        isFreelancer: false,
        isClient: false,
        workerClass: form.workerClass, // 'employee' | 'contractor'
      });

      // 3. Mark as employee and seed HR fields
      const annual = parseFloat(form.annualCtc) || 0;
      await createEmployee(userProfile, uid, {
        designation: form.designation.trim(),
        department: form.department.trim(),
        employmentType: form.employmentType,
        workerClass: form.workerClass,
        dateOfJoining: form.dateOfJoining,
        reportingManager: form.reportingManager,
        jibbleName: form.jibbleName.trim() || form.name.trim(),
        ctc: annual ? { annual, effectiveFrom: form.dateOfJoining, structure: null, history: [] } : null,
      });

      // 4. Send password reset email (doubles as onboarding invite — user sets own password, then lands in onboarding flow)
      try {
        await sendPasswordResetEmail(auth, form.email.trim());
      } catch (resetErr) {
        console.warn('Password reset email failed:', resetErr?.message);
      }

      // 5. Fire custom onboarding invite email via /api/send-email
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: form.email.trim(),
            type: 'employee_onboarding_invite',
            subject: `Welcome to Anandi Productions, ${form.name.trim()}`,
            data: {
              name: form.name.trim(),
              designation: form.designation.trim(),
              dateOfJoining: form.dateOfJoining,
              invitedBy: userProfile?.name || 'Anandi Productions',
            },
          }),
        });
      } catch (emailErr) {
        console.warn('Onboarding invite email failed:', emailErr?.message);
      }

      // Show post-create success screen with copyable invite link
      const inviteLink = typeof window !== 'undefined'
        ? `${window.location.origin}/?onboarding=${uid}`
        : `/?onboarding=${uid}`;
      setCreatedEmployee({
        uid,
        email: form.email.trim(),
        name: form.name.trim(),
        designation: form.designation.trim(),
        inviteLink,
      });
    } catch (err) {
      console.error('Create employee error:', err);
      setError(err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.modalBg || '#14141c',
          borderRadius: '16px',
          border: `1px solid ${t.border}`,
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: t.text }}>
              {createdEmployee ? 'Employee Created' : 'Add Employee'}
            </h2>
            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
              {createdEmployee ? 'Share the invite link with your new hire' : 'Create a profile and send an onboarding invite'}
            </div>
          </div>
          <button onClick={createdEmployee ? finishAndClose : onClose} aria-label="Close" style={{ background: 'rgba(128,128,128,0.15)', border: 'none', color: t.textMuted, width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer' }}>×</button>
        </div>

        {createdEmployee ? (
          <div style={{ padding: '24px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ textAlign: 'center', padding: '8px 0 4px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 12px',
                boxShadow: '0 6px 20px rgba(34,197,94,0.35)',
              }}>✓</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: t.text, marginBottom: '4px' }}>
                {createdEmployee.name} added
              </div>
              <div style={{ fontSize: '12px', color: t.textMuted }}>
                {createdEmployee.designation} · {createdEmployee.email}
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px' }}>
                Onboarding Invite Link
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  readOnly
                  value={createdEmployee.inviteLink}
                  onClick={(e) => e.target.select()}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: t.modalBg || '#0b0b12',
                    border: `1px solid ${t.border}`,
                    borderRadius: '8px',
                    color: t.text,
                    fontSize: '12px',
                    fontFamily: 'ui-monospace, monospace',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdEmployee.inviteLink, 'link')}
                  style={{
                    padding: '10px 14px',
                    background: copied === 'link' ? '#22c55e' : (t.gradientPrimary || t.primary),
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied === 'link' ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '8px', lineHeight: 1.6 }}>
                Send this link via WhatsApp, Slack, or any channel. The employee will log in with their email + the password they set (via the password-reset email we just sent) and be guided through onboarding.
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'rgba(99,102,241,0.08)', border: `1px solid rgba(99,102,241,0.25)`, borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: t.text, marginBottom: '6px' }}>
                What happens next
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: t.textMuted, lineHeight: 1.7 }}>
                <li>Two emails were sent: a password-reset link + a welcome / onboarding invite.</li>
                <li>Once they log in, they'll be guided through personal details, documents, photo capture, and signing the offer letter + agreement.</li>
                <li>You'll get a notification when they finish, and can review their profile in the Employees tab.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => copyToClipboard(createdEmployee.email, 'email')}
                style={{
                  padding: '11px 18px',
                  background: 'transparent',
                  color: t.text,
                  border: `1px solid ${t.border}`,
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied === 'email' ? 'Email copied ✓' : 'Copy email'}
              </button>
              <button
                type="button"
                onClick={finishAndClose}
                style={{
                  padding: '11px 22px',
                  background: t.gradientPrimary || t.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={submit} style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Basic */}
          <Row>
            <Field label="Full name *" t={t}>
              <Input t={t} value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Priya Sharma" />
            </Field>
            <Field label="Email *" t={t}>
              <Input t={t} type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="priya@anandiproductions.com" />
            </Field>
          </Row>

          <Row>
            <Field label="Phone" t={t}>
              <Input t={t} value={form.phone} onChange={(v) => set('phone', v)} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Designation *" t={t}>
              <Input t={t} value={form.designation} onChange={(v) => set('designation', v)} placeholder="e.g. Producer, Editor" />
            </Field>
          </Row>

          {/* Worker classification */}
          <Field label="Worker classification *" t={t}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { value: 'employee', label: 'Employee', desc: 'Full-time / part-time — PF, ESI, gratuity apply' },
                { value: 'contractor', label: 'Independent Contractor', desc: 'Project-based — no statutory benefits' },
              ].map(opt => (
                <label
                  key={opt.value}
                  onClick={() => set('workerClass', opt.value)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    background: form.workerClass === opt.value ? 'rgba(99,102,241,0.12)' : t.bgInput,
                    border: `1.5px solid ${form.workerClass === opt.value ? 'rgba(99,102,241,0.6)' : t.border}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      border: `2px solid ${form.workerClass === opt.value ? '#6366f1' : t.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {form.workerClass === opt.value && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: t.text }}>{opt.label}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px', paddingLeft: '24px' }}>
                    {opt.desc}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Row>
            <Field label="Department *" t={t}>
              <Select t={t} value={form.department} onChange={(v) => set('department', v)}>
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Employment type" t={t}>
              <Select t={t} value={form.employmentType} onChange={(v) => set('employmentType', v)}>
                {Object.entries(EMPLOYMENT_TYPES).map(([k, meta]) => (
                  <option key={k} value={k}>{meta.label}</option>
                ))}
              </Select>
            </Field>
          </Row>

          <Row>
            <Field label="Date of joining" t={t}>
              <Input t={t} type="date" value={form.dateOfJoining} onChange={(v) => set('dateOfJoining', v)} />
            </Field>
            <Field label="Annual CTC (₹)" t={t}>
              <Input t={t} type="number" value={form.annualCtc} onChange={(v) => set('annualCtc', v)} placeholder="e.g. 600000" />
            </Field>
          </Row>

          <Row>
            <Field label="Reporting manager (optional)" t={t}>
              <Input t={t} value={form.reportingManager} onChange={(v) => set('reportingManager', v)} placeholder="Manager name or user ID" />
            </Field>
            <Field label="Jibble name (for attendance match)" t={t} hint="Exact name as it appears in Jibble export. Defaults to full name.">
              <Input t={t} value={form.jibbleName} onChange={(v) => set('jibbleName', v)} placeholder="Same as full name by default" />
            </Field>
          </Row>

          <div style={{ fontSize: '11px', color: t.textMuted, background: t.bgInput, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
            After clicking "Create & Invite", a Firebase Auth account is created, the employee gets a password-reset email to set their own password, and an onboarding invite email is sent. On their first login they'll be guided through the full onboarding flow.
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: t.danger, fontSize: '12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '11px 20px',
                background: 'transparent',
                color: t.textMuted,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '11px 22px',
                background: t.gradientPrimary || t.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              }}
            >
              {submitting ? 'Creating...' : 'Create & Invite'}
            </button>
          </div>
        </form>
        )}
      </div>
    </Overlay>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const Overlay = ({ children, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}
  >
    {children}
  </div>
);

const Row = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
    {children}
  </div>
);

const Field = ({ label, hint, t, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: '10px', color: t.textMuted, fontStyle: 'italic' }}>{hint}</div>}
  </div>
);

const Input = ({ t, type = 'text', value, onChange, placeholder }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      padding: '11px 13px',
      background: t.bgInput,
      border: `1px solid ${t.border}`,
      borderRadius: '10px',
      color: t.text,
      fontSize: '13px',
      outline: 'none',
      fontFamily: 'inherit',
    }}
  />
);

const Select = ({ t, value, onChange, children }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: '11px 13px',
      background: t.bgInput,
      border: `1px solid ${t.border}`,
      borderRadius: '10px',
      color: t.text,
      fontSize: '13px',
      outline: 'none',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}
  >
    {children}
  </select>
);
