'use client';
import { useState } from 'react';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, firebaseConfig } from '@/lib/firebase';
import { createUser } from '@/lib/firestore';
import { useAuth } from '@/lib/auth-context';
import { createEmployee, EMPLOYMENT_TYPES, DEPARTMENTS } from '@/lib/hr';

/**
 * Create a Firebase Auth account WITHOUT touching the current (producer)
 * session. The primary SDK's createUserWithEmailAndPassword auto-signs-in as
 * the new user — which would log the admin out. We do it on a throwaway
 * secondary app instead, then tear it down. Returns the new user's uid.
 */
async function createAuthUserIsolated(email, password) {
  const SECONDARY = 'employee-creator';
  let secondaryApp;
  try {
    try { secondaryApp = getApp(SECONDARY); }
    catch { secondaryApp = initializeApp(firebaseConfig, SECONDARY); }
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth).catch(() => {});
    return uid;
  } finally {
    if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
  }
}

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
    probationMonths: '',      // e.g. 2 (blank = no probation)
    probationMonthlySalary: '', // e.g. 20000 (reduced salary during probation)
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
      // 1. Create Firebase Auth account with a temporary password — on a
      // SECONDARY app so the producer's own session is never replaced.
      const tempPassword = generateTempPassword();
      const uid = await createAuthUserIsolated(form.email.trim(), tempPassword);

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
      const probMonths = parseInt(form.probationMonths, 10) || 0;
      const probSalary = parseFloat(form.probationMonthlySalary) || 0;
      await createEmployee(userProfile, uid, {
        designation: form.designation.trim(),
        department: form.department.trim(),
        employmentType: form.employmentType,
        workerClass: form.workerClass,
        dateOfJoining: form.dateOfJoining,
        reportingManager: form.reportingManager,
        jibbleName: form.jibbleName.trim() || form.name.trim(),
        ctc: annual ? { annual, effectiveFrom: form.dateOfJoining, structure: null, history: [] } : null,
        probation: (probMonths > 0 && probSalary > 0) ? { months: probMonths, monthlySalary: probSalary } : null,
      });

      // 4. Send password reset email (doubles as onboarding invite — user sets own password, then lands in onboarding flow)
      let resetSent = false;
      let resetError = '';
      try {
        await sendPasswordResetEmail(auth, form.email.trim());
        resetSent = true;
      } catch (resetErr) {
        resetError = resetErr?.message || 'unknown error';
        console.warn('Password reset email failed:', resetError);
      }

      // 5. Fire custom onboarding invite email via /api/send-email.
      // The route returns { skipped: true } when RESEND_API_KEY is not
      // configured — treat that as "not sent" so we never lie to the admin.
      let inviteSent = false;
      let inviteSkipped = false;
      let inviteError = '';
      try {
        const resp = await fetch('/api/send-email', {
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
        const result = await resp.json().catch(() => ({}));
        if (resp.ok && result?.skipped) inviteSkipped = true;
        else if (resp.ok && result?.success) inviteSent = true;
        else inviteError = result?.error || `HTTP ${resp.status}`;
      } catch (emailErr) {
        inviteError = emailErr?.message || 'network error';
        console.warn('Onboarding invite email failed:', inviteError);
      }

      // Show post-create success screen with login link + credentials to share
      const loginLink = typeof window !== 'undefined'
        ? `${window.location.origin}/`
        : '/';
      setCreatedEmployee({
        uid,
        email: form.email.trim(),
        name: form.name.trim(),
        designation: form.designation.trim(),
        phone: form.phone.trim(),
        tempPassword,
        inviteLink: loginLink,
        emailStatus: { resetSent, resetError, inviteSent, inviteSkipped, inviteError },
      });
    } catch (err) {
      console.error('Create employee error:', err);
      if (err?.code === 'auth/email-already-in-use') {
        setError('This email already has a login account. If you deleted this employee earlier, the Firebase Auth account still exists (deletion only removes the HR record). Either delete it in Firebase Console → Authentication → Users, or use a different email (Gmail "you+test@gmail.com" works). A server-side cleanup is on the way.');
      } else if (err?.code === 'auth/invalid-email') {
        setError('That email address is not valid.');
      } else if (err?.code === 'auth/weak-password') {
        setError('Generated password was rejected — please try again.');
      } else {
        setError(err.message || 'Failed to create employee');
      }
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

            {/* Login credentials to hand to the employee */}
            {(() => {
              const { name, email, tempPassword, inviteLink, phone, designation } = createdEmployee;
              const message =
                `Welcome to Anandi Productions, ${name}! 🎬\n\n` +
                `You've been added${designation ? ` as ${designation}` : ''}. Here are your login details for the employee portal:\n\n` +
                `🔗 Login link: ${inviteLink}\n` +
                `👤 Username (email): ${email}\n` +
                `🔑 Temporary password: ${tempPassword}\n\n` +
                `Steps:\n` +
                `1. Open the link and log in with the email + temporary password above.\n` +
                `2. Complete your onboarding (details, documents, photo, sign your offer letter & agreement).\n` +
                `3. To set your own password, use "Forgot password?" on the login screen anytime.\n\n` +
                `Welcome aboard! 🎉`;
              const digits = (phone || '').replace(/[^0-9]/g, '');
              const waHref = digits
                ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;

              const CredRow = ({ label, value, copyKey }) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', color: t.textMuted, width: '70px', flexShrink: 0 }}>{label}</span>
                  <code style={{ flex: 1, fontSize: '12px', color: t.text, background: t.modalBg || '#0b0b12', border: `1px solid ${t.border}`, borderRadius: '6px', padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
                  <button type="button" onClick={() => copyToClipboard(value, copyKey)} style={{ padding: '7px 10px', background: copied === copyKey ? '#22c55e' : 'transparent', color: copied === copyKey ? '#fff' : t.text, border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {copied === copyKey ? '✓' : 'Copy'}
                  </button>
                </div>
              );

              return (
                <div style={{ padding: '16px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '12px' }}>
                    Login details — send these to {name}
                  </div>
                  <CredRow label="Login link" value={inviteLink} copyKey="link" />
                  <CredRow label="Username" value={email} copyKey="email" />
                  <CredRow label="Temp password" value={tempPassword} copyKey="pw" />

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1, textAlign: 'center', textDecoration: 'none',
                        padding: '12px', borderRadius: '10px',
                        background: '#25D366', color: '#fff', fontSize: '13px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>📲</span> Send on WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(message, 'all')}
                      style={{ padding: '12px 16px', borderRadius: '10px', background: 'transparent', color: t.text, border: `1px solid ${t.border}`, fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {copied === 'all' ? 'Copied ✓' : 'Copy message'}
                    </button>
                  </div>

                  <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '10px', lineHeight: 1.6 }}>
                    {digits
                      ? `Opens WhatsApp to ${phone} with the message pre-filled — just hit send.`
                      : 'Opens WhatsApp with the message pre-filled — pick the contact and send. (Add a phone number next time to pre-select them.)'}
                    {' '}The employee logs in with these, completes onboarding, then changes their password.
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
            <Field label="Probation period (months)" t={t} hint="Leave blank if no probation.">
              <Input t={t} type="number" value={form.probationMonths} onChange={(v) => set('probationMonths', v)} placeholder="e.g. 2" />
            </Field>
            <Field label="Probation salary (₹/month)" t={t} hint="Reduced monthly pay during probation. Full salary = Annual CTC ÷ 12 after.">
              <Input t={t} type="number" value={form.probationMonthlySalary} onChange={(v) => set('probationMonthlySalary', v)} placeholder="e.g. 20000" />
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
