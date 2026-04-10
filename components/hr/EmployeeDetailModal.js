'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
  addCtcIncrement,
  canEditEmployee,
  canDeleteEmployee,
  isHrFullAdmin,
  EMPLOYMENT_TYPES,
  DEPARTMENTS,
} from '@/lib/hr';

/**
 * Admin modal showing an employee's full profile across tabs.
 *
 * Props:
 *  - t        : theme tokens
 *  - uid      : employee uid
 *  - onClose  : close handler
 *  - onChange : called after any mutation so parent can refresh
 */
export default function EmployeeDetailModal({ t, uid, onClose, onChange }) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState({});
  const [ctcForm, setCtcForm] = useState({ annual: '', effectiveFrom: '', reason: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const e = await getEmployee(userProfile, uid);
      setEmployee(e);
      setForm({
        name: e?.name || '',
        phone: e?.phone || '',
        designation: e?.designation || '',
        department: e?.department || '',
        employmentType: e?.employmentType || 'full-time',
        dateOfJoining: e?.dateOfJoining || '',
        workLocation: e?.workLocation || '',
        reportingManager: e?.reportingManager || '',
        jibbleName: e?.jibbleName || '',
        pfEnabled: e?.pfEnabled || false,
        pfNumber: e?.pfNumber || '',
        esiEnabled: e?.esiEnabled || false,
        esiNumber: e?.esiNumber || '',
        uanNumber: e?.uanNumber || '',
        ptApplicable: e?.ptApplicable ?? true,
        tdsMonthly: e?.tdsMonthly || 0,
      });
    } catch (err) {
      setError(err.message || 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveProfile = async (fields) => {
    if (!employee) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const patch = {};
      for (const f of fields) patch[f] = form[f];
      const result = await updateEmployee(userProfile, uid, patch);
      if (result?.pendingApprovalId) {
        setNotice('Change submitted for producer approval.');
      } else {
        setNotice('Saved.');
      }
      await load();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const submitCtc = async () => {
    setError('');
    setNotice('');
    const annual = parseFloat(ctcForm.annual);
    if (!annual || annual <= 0) {
      setError('Enter a valid annual CTC amount.');
      return;
    }
    if (!ctcForm.effectiveFrom) {
      setError('Effective-from date is required.');
      return;
    }
    setSaving(true);
    try {
      const result = await addCtcIncrement(userProfile, uid, {
        annual,
        effectiveFrom: ctcForm.effectiveFrom,
        reason: ctcForm.reason,
        structure: null,
      });
      if (result?.pendingApprovalId) {
        setNotice('Increment submitted for producer approval.');
      } else {
        setNotice('Increment applied.');
      }
      setCtcForm({ annual: '', effectiveFrom: '', reason: '' });
      await load();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Failed to add increment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    const check = canDeleteEmployee(userProfile, employee);
    if (!check.allowed && !check.requiresApproval) {
      setError(check.reason);
      return;
    }
    const confirmMsg = check.requiresApproval
      ? `Request deletion of ${employee.name}? This will be sent to the primary producer for approval.`
      : `Permanently delete ${employee.name}? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;
    setSaving(true);
    setError('');
    try {
      const result = await deleteEmployee(userProfile, uid);
      if (result?.pendingApprovalId) {
        setNotice('Deletion request submitted for approval.');
        onChange?.();
      } else {
        onChange?.();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteCheck = employee ? canDeleteEmployee(userProfile, employee) : { allowed: false };
  const isPrimary = employee?.isPrimaryProducer === true;

  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '10px 16px',
        background: tab === id ? t.bgCard : 'transparent',
        color: tab === id ? t.text : t.textMuted,
        border: tab === id ? `1px solid ${t.border}` : '1px solid transparent',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <Overlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.modalBg || '#14141c',
          borderRadius: '16px',
          border: `1px solid ${t.border}`,
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: employee?.documents?.profilePhoto?.url ? `url(${employee.documents.profilePhoto.url}) center/cover` : t.gradientPrimary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '18px',
              flexShrink: 0,
            }}>
              {!employee?.documents?.profilePhoto?.url && (employee?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {employee?.name || '—'}
                {isPrimary && <span title="Primary Admin — permanent" style={{ fontSize: '14px' }}>👑</span>}
              </h2>
              <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
                {employee?.employeeId || '—'} · {employee?.designation || '—'} · {employee?.email || '—'}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'rgba(128,128,128,0.15)', border: 'none', color: t.textMuted, width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 22px', borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap' }}>
          <TabBtn id="profile" label="Profile" />
          <TabBtn id="documents" label="Documents" />
          <TabBtn id="ctc" label="CTC & Compensation" />
          <TabBtn id="statutory" label="Statutory" />
          <TabBtn id="onboarding" label="Onboarding" />
          {!isPrimary && <TabBtn id="danger" label="Danger Zone" />}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>Loading...</div>
          ) : !employee ? (
            <div style={{ padding: '40px', textAlign: 'center', color: t.danger, fontSize: '13px' }}>Employee not found.</div>
          ) : (
            <>
              {notice && <Banner color="#22c55e" t={t}>{notice}</Banner>}
              {error && <Banner color={t.danger} t={t}>{error}</Banner>}

              {tab === 'profile' && (
                <ProfileTab
                  t={t}
                  form={form}
                  set={set}
                  saving={saving}
                  employee={employee}
                  actor={userProfile}
                  onSave={() => saveProfile(['name', 'phone', 'designation', 'department', 'employmentType', 'dateOfJoining', 'workLocation', 'reportingManager', 'jibbleName'])}
                />
              )}

              {tab === 'documents' && <DocumentsTab t={t} employee={employee} />}

              {tab === 'ctc' && (
                <CtcTab
                  t={t}
                  employee={employee}
                  form={ctcForm}
                  setForm={setCtcForm}
                  saving={saving}
                  onSubmit={submitCtc}
                  actor={userProfile}
                />
              )}

              {tab === 'statutory' && (
                <StatutoryTab
                  t={t}
                  form={form}
                  set={set}
                  saving={saving}
                  employee={employee}
                  actor={userProfile}
                  onSave={() => saveProfile(['pfEnabled', 'pfNumber', 'esiEnabled', 'esiNumber', 'uanNumber', 'ptApplicable', 'tdsMonthly'])}
                />
              )}

              {tab === 'onboarding' && <OnboardingTab t={t} employee={employee} />}

              {tab === 'danger' && !isPrimary && (
                <DangerTab
                  t={t}
                  employee={employee}
                  deleteCheck={deleteCheck}
                  saving={saving}
                  onDelete={handleDelete}
                />
              )}
            </>
          )}
        </div>
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

const Banner = ({ color, children, t }) => (
  <div style={{
    padding: '10px 14px',
    background: `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: '10px',
    color,
    fontSize: '12px',
    marginBottom: '16px',
  }}>
    {children}
  </div>
);

const Row = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>{children}</div>
);

const Field = ({ label, t, children, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: '10px', color: t.textMuted }}>{hint}</div>}
  </div>
);

const Input = ({ t, type = 'text', value, onChange, placeholder, disabled }) => (
  <input
    type={type}
    value={value ?? ''}
    disabled={disabled}
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
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
    }}
  />
);

const Select = ({ t, value, onChange, children, disabled }) => (
  <select
    value={value ?? ''}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: '11px 13px',
      background: t.bgInput,
      border: `1px solid ${t.border}`,
      borderRadius: '10px',
      color: t.text,
      fontSize: '13px',
      outline: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </select>
);

const Checkbox = ({ t, checked, onChange, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: t.text, fontSize: '13px' }}>
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

const Button = ({ t, children, onClick, disabled, variant = 'primary' }) => {
  const styles = {
    primary: { background: t.gradientPrimary || t.primary, color: '#fff', border: 'none' },
    danger:  { background: t.danger, color: '#fff', border: 'none' },
    ghost:   { background: 'transparent', color: t.text, border: `1px solid ${t.border}` },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '11px 22px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
};

// ─── Profile tab ─────────────────────────────────────────────────────────

const ProfileTab = ({ t, form, set, saving, employee, actor, onSave }) => {
  const check = canEditEmployee(actor, employee, ['name', 'phone', 'designation', 'department']);
  const readOnly = !check.allowed;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Row>
        <Field t={t} label="Full name">
          <Input t={t} value={form.name} onChange={(v) => set('name', v)} disabled={readOnly} />
        </Field>
        <Field t={t} label="Phone">
          <Input t={t} value={form.phone} onChange={(v) => set('phone', v)} disabled={readOnly} />
        </Field>
      </Row>
      <Row>
        <Field t={t} label="Designation">
          <Input t={t} value={form.designation} onChange={(v) => set('designation', v)} disabled={readOnly} />
        </Field>
        <Field t={t} label="Department">
          <Select t={t} value={form.department} onChange={(v) => set('department', v)} disabled={readOnly}>
            <option value="">—</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
      </Row>
      <Row>
        <Field t={t} label="Employment type">
          <Select t={t} value={form.employmentType} onChange={(v) => set('employmentType', v)} disabled={readOnly}>
            {Object.entries(EMPLOYMENT_TYPES).map(([k, meta]) => (
              <option key={k} value={k}>{meta.label}</option>
            ))}
          </Select>
        </Field>
        <Field t={t} label="Date of joining">
          <Input t={t} type="date" value={form.dateOfJoining} onChange={(v) => set('dateOfJoining', v)} disabled={readOnly} />
        </Field>
      </Row>
      <Row>
        <Field t={t} label="Work location">
          <Input t={t} value={form.workLocation} onChange={(v) => set('workLocation', v)} disabled={readOnly} />
        </Field>
        <Field t={t} label="Reporting manager">
          <Input t={t} value={form.reportingManager} onChange={(v) => set('reportingManager', v)} disabled={readOnly} />
        </Field>
      </Row>
      <Field t={t} label="Jibble name (for attendance match)">
        <Input t={t} value={form.jibbleName} onChange={(v) => set('jibbleName', v)} disabled={readOnly} />
      </Field>

      {check.requiresApproval && (
        <div style={{ fontSize: '11px', color: t.warning || '#f59e0b' }}>
          Some fields you touched are sensitive — saving will submit a request for producer approval.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
        <Button t={t} onClick={onSave} disabled={saving || readOnly}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
};

// ─── Documents tab ───────────────────────────────────────────────────────

const DocumentsTab = ({ t, employee }) => {
  const docs = employee.documents || {};
  const entries = [
    ['Profile photo',      docs.profilePhoto],
    ['PAN card',           docs.panCard],
    ['Aadhaar card',       docs.aadharCard],
    ['Cancelled cheque',   docs.cancelledCheque],
    ['Signed offer letter', docs.signedOfferLetter],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {entries.map(([label, doc]) => (
        <div key={label} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          background: t.bgInput,
          border: `1px solid ${t.border}`,
          borderRadius: '10px',
          fontSize: '13px',
        }}>
          <div style={{ color: t.text }}>{label}</div>
          {doc?.url ? (
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: t.primary, fontSize: '12px', fontWeight: 600 }}>
              View / Download
            </a>
          ) : (
            <span style={{ color: t.textMuted, fontSize: '11px' }}>Not uploaded</span>
          )}
        </div>
      ))}
      {Array.isArray(docs.qualificationCerts) && docs.qualificationCerts.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Qualification certificates</div>
          {docs.qualificationCerts.map((d, i) => (
            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.primary, fontSize: '12px', marginBottom: '6px' }}>
              {d.name || `Certificate ${i + 1}`}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CTC tab ─────────────────────────────────────────────────────────────

const CtcTab = ({ t, employee, form, setForm, saving, onSubmit, actor }) => {
  const ctc = employee.ctc || null;
  const history = (ctc && ctc.history) || [];
  const check = canEditEmployee(actor, employee, ['ctc']);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{
        padding: '18px 20px',
        background: t.bgInput,
        border: `1px solid ${t.border}`,
        borderRadius: '12px',
      }}>
        <div style={{ fontSize: '11px', color: t.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Current Annual CTC</div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: t.text }}>
          {ctc?.annual ? `₹${Number(ctc.annual).toLocaleString('en-IN')}` : '—'}
        </div>
        {ctc?.effectiveFrom && (
          <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '4px' }}>
            Effective from {ctc.effectiveFrom}
          </div>
        )}
      </div>

      {check.allowed && (
        <div style={{ padding: '18px 20px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '14px' }}>Add Increment</div>
          <Row>
            <Field t={t} label="New annual CTC (₹)">
              <Input t={t} type="number" value={form.annual} onChange={(v) => setForm(f => ({ ...f, annual: v }))} placeholder="e.g. 720000" />
            </Field>
            <Field t={t} label="Effective from">
              <Input t={t} type="date" value={form.effectiveFrom} onChange={(v) => setForm(f => ({ ...f, effectiveFrom: v }))} />
            </Field>
          </Row>
          <div style={{ marginTop: '12px' }}>
            <Field t={t} label="Reason (optional)">
              <Input t={t} value={form.reason} onChange={(v) => setForm(f => ({ ...f, reason: v }))} placeholder="Annual appraisal, promotion, etc." />
            </Field>
          </div>
          {check.requiresApproval && (
            <div style={{ fontSize: '11px', color: t.warning || '#f59e0b', marginTop: '10px' }}>
              You are an HR sub-admin — this change will be sent to the primary producer for approval.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <Button t={t} onClick={onSubmit} disabled={saving}>
              {saving ? 'Submitting...' : (check.requiresApproval ? 'Request Increment' : 'Apply Increment')}
            </Button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>Increment History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.slice().reverse().map((h, i) => (
              <div key={i} style={{ padding: '12px 14px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>₹{Number(h.annual).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '11px', color: t.textMuted }}>{h.effectiveFrom}{h.reason ? ` · ${h.reason}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Statutory tab ───────────────────────────────────────────────────────

const StatutoryTab = ({ t, form, set, saving, employee, actor, onSave }) => {
  const check = canEditEmployee(actor, employee, ['pfEnabled', 'pfNumber', 'esiEnabled', 'esiNumber', 'tdsMonthly']);
  const readOnly = !check.allowed;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ padding: '16px 18px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '12px' }}>Provident Fund (PF)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Checkbox t={t} label="PF applicable" checked={form.pfEnabled} onChange={(v) => set('pfEnabled', v)} />
          <Row>
            <Field t={t} label="PF number">
              <Input t={t} value={form.pfNumber} onChange={(v) => set('pfNumber', v)} disabled={readOnly || !form.pfEnabled} />
            </Field>
            <Field t={t} label="UAN number">
              <Input t={t} value={form.uanNumber} onChange={(v) => set('uanNumber', v)} disabled={readOnly} />
            </Field>
          </Row>
        </div>
      </div>

      <div style={{ padding: '16px 18px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '12px' }}>ESI</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Checkbox t={t} label="ESI applicable" checked={form.esiEnabled} onChange={(v) => set('esiEnabled', v)} />
          <Field t={t} label="ESI number">
            <Input t={t} value={form.esiNumber} onChange={(v) => set('esiNumber', v)} disabled={readOnly || !form.esiEnabled} />
          </Field>
        </div>
      </div>

      <div style={{ padding: '16px 18px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '12px' }}>Professional Tax & TDS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Checkbox t={t} label="Professional Tax applicable" checked={form.ptApplicable} onChange={(v) => set('ptApplicable', v)} />
          <Field t={t} label="Monthly TDS (₹)">
            <Input t={t} type="number" value={form.tdsMonthly} onChange={(v) => set('tdsMonthly', Number(v) || 0)} disabled={readOnly} />
          </Field>
        </div>
      </div>

      {check.requiresApproval && (
        <div style={{ fontSize: '11px', color: t.warning || '#f59e0b' }}>
          Statutory changes are sensitive — saving will submit a request for producer approval.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button t={t} onClick={onSave} disabled={saving || readOnly}>
          {saving ? 'Saving...' : (check.requiresApproval ? 'Request Changes' : 'Save Changes')}
        </Button>
      </div>
    </div>
  );
};

// ─── Onboarding tab ──────────────────────────────────────────────────────

const OnboardingTab = ({ t, employee }) => {
  const status = employee.onboardingStatus || 'pending';
  const completedAt = employee.onboardingCompletedAt;
  const sigs = employee.signatures || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ padding: '16px 18px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
        <div style={{ fontSize: '11px', color: t.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: t.text, textTransform: 'capitalize' }}>
          {status.replace('-', ' ')}
        </div>
        {completedAt && (
          <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '4px' }}>
            Completed {completedAt?.toDate ? completedAt.toDate().toLocaleString() : String(completedAt)}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>Signed Documents</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['offerLetter', 'employeeAgreement', 'handbookAcceptance', 'termsAndConditions'].map(key => {
            const sig = sigs[key];
            const labels = {
              offerLetter: 'Offer letter',
              employeeAgreement: 'Employee agreement',
              handbookAcceptance: 'Employee handbook',
              termsAndConditions: 'Terms & conditions',
            };
            return (
              <div key={key} style={{ padding: '12px 14px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', color: t.text, fontWeight: 600 }}>{labels[key]}</div>
                  {sig?.signed ? (
                    <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
                      Signed by {sig.typedName} · {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : ''} · IP {sig.ipAddress || '—'}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>Not signed</div>
                  )}
                </div>
                {sig?.signatureUrl && (
                  <a href={sig.signatureUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.primary, fontSize: '12px', fontWeight: 600 }}>View</a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Danger zone tab ─────────────────────────────────────────────────────

const DangerTab = ({ t, employee, deleteCheck, saving, onDelete }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        padding: '20px 22px',
        background: 'rgba(239,68,68,0.08)',
        border: `1px solid rgba(239,68,68,0.3)`,
        borderRadius: '12px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: t.danger, marginBottom: '8px' }}>
          {deleteCheck.requiresApproval ? 'Request Employee Deletion' : 'Delete Employee'}
        </div>
        <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '16px', lineHeight: 1.6 }}>
          {deleteCheck.requiresApproval
            ? `You are an HR sub-admin. Deletion requests are sent to the primary producer for approval. All records including signatures and documents will be removed if approved.`
            : `This will permanently remove ${employee.name} from the HR system. All their documents, signatures, and HR data will be deleted. This cannot be undone.`}
        </div>
        <Button t={t} variant="danger" onClick={onDelete} disabled={saving || (!deleteCheck.allowed && !deleteCheck.requiresApproval)}>
          {saving ? 'Processing...' : (deleteCheck.requiresApproval ? 'Request Deletion' : 'Delete Permanently')}
        </Button>
      </div>
    </div>
  );
};
