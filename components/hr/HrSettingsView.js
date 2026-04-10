'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getHrSettings, updateHrSettings, isHrFullAdmin } from '@/lib/hr';

/**
 * Producer-only view for editing company-wide HR settings.
 * HR sub-admins see this in read-only mode.
 *
 * Props:
 *  - t : theme tokens
 */
export default function HrSettingsView({ t }) {
  const { userProfile } = useAuth();
  const canEdit = isHrFullAdmin(userProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getHrSettings();
      setSettings(data);
    } catch (err) {
      setError(err.message || 'Failed to load HR settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (path, value) => {
    setSettings(s => {
      const copy = { ...s };
      const keys = path.split('.');
      let cursor = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        cursor[keys[i]] = { ...(cursor[keys[i]] || {}) };
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateHrSettings(userProfile, {
        companyDetails: settings.companyDetails,
        termsAndConditionsText: settings.termsAndConditionsText,
        offerLetterTemplate: settings.offerLetterTemplate,
        employeeAgreementTemplate: settings.employeeAgreementTemplate,
        defaultCtcStructure: settings.defaultCtcStructure,
      });
      setNotice('Saved.');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>
        Loading settings...
      </div>
    );
  }

  const inputStyle = {
    padding: '11px 13px',
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    borderRadius: '10px',
    color: t.text,
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
  };

  const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
      {children}
    </label>
  );

  const Card = ({ title, children }) => (
    <div style={{ padding: '22px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: t.text }}>{title}</h3>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {!canEdit && (
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', color: t.warning || '#f59e0b', fontSize: '12px' }}>
          Read-only: only the primary producer can edit HR settings.
        </div>
      )}
      {notice && <Banner color="#22c55e" t={t}>{notice}</Banner>}
      {error && <Banner color={t.danger} t={t}>{error}</Banner>}

      <Card title="Company Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <Label>Legal name</Label>
            <input style={inputStyle} value={settings.companyDetails?.legalName || ''} onChange={(e) => set('companyDetails.legalName', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Address</Label>
            <input style={inputStyle} value={settings.companyDetails?.address || ''} onChange={(e) => set('companyDetails.address', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>CIN</Label>
            <input style={inputStyle} value={settings.companyDetails?.cin || ''} onChange={(e) => set('companyDetails.cin', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>PAN</Label>
            <input style={inputStyle} value={settings.companyDetails?.pan || ''} onChange={(e) => set('companyDetails.pan', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>TAN</Label>
            <input style={inputStyle} value={settings.companyDetails?.tan || ''} onChange={(e) => set('companyDetails.tan', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>GSTIN</Label>
            <input style={inputStyle} value={settings.companyDetails?.gstin || ''} onChange={(e) => set('companyDetails.gstin', e.target.value)} disabled={!canEdit} />
          </div>
        </div>
      </Card>

      <Card title="Default CTC Structure (% split)">
        <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '12px' }}>
          Used as the default breakdown when calculating monthly salary components. Must sum to 100.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          <div>
            <Label>Basic %</Label>
            <input type="number" style={inputStyle} value={settings.defaultCtcStructure?.basicPct || 0} onChange={(e) => set('defaultCtcStructure.basicPct', Number(e.target.value) || 0)} disabled={!canEdit} />
          </div>
          <div>
            <Label>HRA %</Label>
            <input type="number" style={inputStyle} value={settings.defaultCtcStructure?.hraPct || 0} onChange={(e) => set('defaultCtcStructure.hraPct', Number(e.target.value) || 0)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Conveyance %</Label>
            <input type="number" style={inputStyle} value={settings.defaultCtcStructure?.conveyancePct || 0} onChange={(e) => set('defaultCtcStructure.conveyancePct', Number(e.target.value) || 0)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Special %</Label>
            <input type="number" style={inputStyle} value={settings.defaultCtcStructure?.specialPct || 0} onChange={(e) => set('defaultCtcStructure.specialPct', Number(e.target.value) || 0)} disabled={!canEdit} />
          </div>
        </div>
      </Card>

      <Card title="Offer Letter Template">
        <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>
          Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{designation}}'}</code>, <code>{'{{department}}'}</code>, <code>{'{{dateOfJoining}}'}</code>, <code>{'{{annualCtc}}'}</code>
        </div>
        <textarea
          value={settings.offerLetterTemplate || ''}
          onChange={(e) => set('offerLetterTemplate', e.target.value)}
          disabled={!canEdit}
          rows={10}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
        />
      </Card>

      <Card title="Employee Agreement Template">
        <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>
          Same placeholders as offer letter.
        </div>
        <textarea
          value={settings.employeeAgreementTemplate || ''}
          onChange={(e) => set('employeeAgreementTemplate', e.target.value)}
          disabled={!canEdit}
          rows={12}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
        />
      </Card>

      <Card title="Terms & Conditions">
        <textarea
          value={settings.termsAndConditionsText || ''}
          onChange={(e) => set('termsAndConditionsText', e.target.value)}
          disabled={!canEdit}
          rows={8}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Card>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '11px 22px',
              background: t.gradientPrimary || t.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            }}
          >
            {saving ? 'Saving...' : 'Save HR Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

const Banner = ({ color, children, t }) => (
  <div style={{
    padding: '10px 14px',
    background: `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: '10px',
    color,
    fontSize: '12px',
  }}>
    {children}
  </div>
);
