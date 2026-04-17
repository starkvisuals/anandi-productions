'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getHrSettings, updateHrSettings, updateHrTemplate, resetHrTemplate, isHrFullAdmin } from '@/lib/hr';

/**
 * Producer-only HR settings view — company details, CTC structure, and per-template editor.
 * HR sub-admins see everything in read-only mode.
 *
 * Props: t — theme tokens
 */
export default function HrSettingsView({ t }) {
  const { userProfile } = useAuth();
  const canEdit = isHrFullAdmin(userProfile);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('company'); // company | templates

  // Per-template save/reset state: { [slug]: 'saving' | 'saved' | 'resetting' | null }
  const [tplStatus, setTplStatus] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      setSettings(await getHrSettings());
    } catch (err) {
      setError(err.message || 'Failed to load HR settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Deep-path setter for nested settings fields (e.g. 'companyDetails.legalName')
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

  const setTemplateBody = (slug, value) => {
    setSettings(s => ({
      ...s,
      templates: {
        ...s.templates,
        [slug]: { ...(s.templates?.[slug] || {}), body: value },
      },
    }));
  };

  const saveCompany = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateHrSettings(userProfile, {
        companyDetails: settings.companyDetails,
        termsAndConditionsText: settings.termsAndConditionsText,
        defaultCtcStructure: settings.defaultCtcStructure,
      });
      setNotice('Settings saved.');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async (slug) => {
    setTplStatus(s => ({ ...s, [slug]: 'saving' }));
    try {
      await updateHrTemplate(userProfile, slug, { body: settings.templates?.[slug]?.body || '' });
      setTplStatus(s => ({ ...s, [slug]: 'saved' }));
      setTimeout(() => setTplStatus(s => ({ ...s, [slug]: null })), 2500);
    } catch (err) {
      setTplStatus(s => ({ ...s, [slug]: null }));
      setError(err.message || `Failed to save ${slug}`);
    }
  };

  const handleResetTemplate = async (slug) => {
    if (!confirm(`Reset "${slug}" to the default template? Your edits will be lost.`)) return;
    setTplStatus(s => ({ ...s, [slug]: 'resetting' }));
    try {
      await resetHrTemplate(userProfile, slug);
      const fresh = await getHrSettings();
      setSettings(fresh);
      setTplStatus(s => ({ ...s, [slug]: null }));
    } catch (err) {
      setTplStatus(s => ({ ...s, [slug]: null }));
      setError(err.message || `Failed to reset ${slug}`);
    }
  };

  // ── Shared style primitives ──────────────────────────────────────────────
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
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
      {children}
    </label>
  );

  const Card = ({ title, subtitle, children, action }) => (
    <div style={{ padding: '22px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: t.text }}>{title}</h3>
          {subtitle && <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '3px' }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );

  const SettingsTab = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '9px 18px',
        background: activeTab === id ? t.bgCard : 'transparent',
        color: activeTab === id ? t.text : t.textMuted,
        border: activeTab === id ? `1px solid ${t.border}` : '1px solid transparent',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  if (loading || !settings) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>
        Loading settings…
      </div>
    );
  }

  // Templates config: slug → display info
  const TEMPLATES = [
    {
      slug: 'offerLetterEmployee',
      title: 'Offer Letter — Employee',
      subtitle: 'Sent to full-time, part-time, and intern hires',
      badge: { label: 'Employee', color: '#6366f1' },
      rows: 14,
    },
    {
      slug: 'offerLetterContractor',
      title: 'Engagement Letter — Contractor',
      subtitle: 'Sent to independent contractors and freelancers',
      badge: { label: 'Contractor', color: '#f59e0b' },
      rows: 14,
    },
    {
      slug: 'employeeAgreement',
      title: 'Employee Agreement',
      subtitle: 'Signed during onboarding by full-time / part-time employees',
      badge: { label: 'Employee', color: '#6366f1' },
      rows: 16,
    },
    {
      slug: 'contractorAgreement',
      title: 'Contractor Agreement',
      subtitle: 'Signed during onboarding by contractors and freelancers',
      badge: { label: 'Contractor', color: '#f59e0b' },
      rows: 16,
    },
  ];

  const PLACEHOLDERS = [
    '{{name}}', '{{firstName}}', '{{email}}', '{{designation}}',
    '{{department}}', '{{dateOfJoining}}', '{{annualCtc}}', '{{employeeId}}',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Read-only banner */}
      {!canEdit && (
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', color: t.warning || '#f59e0b', fontSize: '12px' }}>
          👁 Read-only — only the primary producer can edit HR settings.
        </div>
      )}

      {notice && <Banner color="#22c55e">{notice}</Banner>}
      {error  && <Banner color={t.danger || '#ef4444'} onDismiss={() => setError('')}>{error}</Banner>}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <SettingsTab id="company"   label="Company & CTC" />
        <SettingsTab id="templates" label="Document Templates" />
      </div>

      {/* ── Company & CTC tab ───────────────────────────────────────────── */}
      {activeTab === 'company' && (
        <>
          <Card title="Company Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                ['Legal Name',   'companyDetails.legalName'],
                ['Address',      'companyDetails.address'],
                ['CIN',          'companyDetails.cin'],
                ['PAN',          'companyDetails.pan'],
                ['TAN',          'companyDetails.tan'],
                ['GSTIN',        'companyDetails.gstin'],
              ].map(([label, path]) => (
                <div key={path}>
                  <Label>{label}</Label>
                  <input
                    style={inputStyle}
                    value={settings.companyDetails?.[path.split('.')[1]] || ''}
                    onChange={e => set(path, e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Default CTC Structure"
            subtitle="Percentage split used when auto-calculating monthly salary components. Should sum to 100."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {[
                ['Basic %',      'defaultCtcStructure.basicPct'],
                ['HRA %',        'defaultCtcStructure.hraPct'],
                ['Conveyance %', 'defaultCtcStructure.conveyancePct'],
                ['Special %',    'defaultCtcStructure.specialPct'],
              ].map(([label, path]) => (
                <div key={path}>
                  <Label>{label}</Label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={settings.defaultCtcStructure?.[path.split('.')[1]] ?? 0}
                    onChange={e => set(path, Number(e.target.value) || 0)}
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>
            {/* Sum indicator */}
            {(() => {
              const s = settings.defaultCtcStructure || {};
              const sum = (s.basicPct || 0) + (s.hraPct || 0) + (s.conveyancePct || 0) + (s.specialPct || 0);
              const ok = sum === 100;
              return (
                <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 600, color: ok ? '#22c55e' : '#ef4444' }}>
                  {ok ? `✓ Total: ${sum}%` : `⚠ Total: ${sum}% (must equal 100)`}
                </div>
              );
            })()}
          </Card>

          <Card title="Terms & Conditions">
            <textarea
              value={settings.termsAndConditionsText || ''}
              onChange={e => set('termsAndConditionsText', e.target.value)}
              disabled={!canEdit}
              rows={8}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Enter your terms and conditions text…"
            />
          </Card>

          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={saveCompany}
                disabled={saving}
                style={{
                  padding: '11px 24px',
                  background: t.gradientPrimary || t.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                  transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Templates tab ─────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <>
          {/* Placeholder reference */}
          <div style={{ padding: '12px 16px', background: t.bgInput, borderRadius: '10px', border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Available Placeholders</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PLACEHOLDERS.map(p => (
                <code key={p} style={{ fontSize: '11px', padding: '2px 8px', background: `${t.primary}18`, color: t.primary, borderRadius: '5px', fontFamily: 'ui-monospace, monospace' }}>{p}</code>
              ))}
            </div>
          </div>

          {TEMPLATES.map(({ slug, title, subtitle, badge, rows }) => {
            const status = tplStatus[slug];
            const isBusy = status === 'saving' || status === 'resetting';
            const body = settings.templates?.[slug]?.body || '';

            return (
              <Card
                key={slug}
                title={title}
                subtitle={subtitle}
                action={
                  <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: badge.color, background: `${badge.color}18`, letterSpacing: '0.3px', flexShrink: 0 }}>
                    {badge.label}
                  </span>
                }
              >
                <textarea
                  value={body}
                  onChange={e => setTemplateBody(slug, e.target.value)}
                  disabled={!canEdit || isBusy}
                  rows={rows}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'ui-monospace, "SFMono-Regular", monospace',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    opacity: isBusy ? 0.6 : 1,
                  }}
                  placeholder={`Enter the ${title} template text…`}
                />

                {canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleResetTemplate(slug)}
                      disabled={isBusy}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: t.textMuted,
                        border: `1px solid ${t.border}`,
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.5 : 1,
                      }}
                    >
                      {status === 'resetting' ? 'Resetting…' : '↺ Reset to default'}
                    </button>
                    <button
                      onClick={() => saveTemplate(slug)}
                      disabled={isBusy}
                      style={{
                        padding: '8px 18px',
                        background: status === 'saved' ? '#22c55e' : t.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.7 : 1,
                        transition: 'background 0.2s',
                        minWidth: '80px',
                      }}
                    >
                      {status === 'saving' ? 'Saving…' : status === 'saved' ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Banner ──────────────────────────────────────────────────────────────────
const Banner = ({ color, children, onDismiss }) => (
  <div style={{
    padding: '10px 14px',
    background: `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: '10px',
    color,
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  }}>
    <span>{children}</span>
    {onDismiss && (
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: 0 }}>×</button>
    )}
  </div>
);
