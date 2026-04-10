'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import {
  ONBOARDING_STEPS, GENDERS, BLOOD_GROUPS,
  updateEmployeeOnboarding, completeOnboarding,
  uploadEmployeeDocument, uploadEmployeeBlob, saveSignatureImage,
  getHrSettings,
} from '@/lib/hr';
import WebcamCapture from './WebcamCapture';
import SignaturePad from './SignaturePad';

/**
 * Full-screen multi-step onboarding wizard. Shown when a logged-in user has
 * isEmployee === true and onboardingStatus !== 'completed'. Progress is
 * persisted after each step so the flow can be resumed.
 *
 * Props:
 *  - t : theme tokens (passed from MainApp)
 */
export default function OnboardingFlow({ t }) {
  const { userProfile, fetchUserProfile, signOut } = useAuth();

  // Determine starting step from onboardingStatus — if user has progress,
  // resume at the next incomplete step.
  const computeInitialStep = () => {
    if (!userProfile) return 0;
    if (userProfile.dateOfBirth && !userProfile.addressCurrent) return 2;
    if (userProfile.addressCurrent && !userProfile.panNumber) return 3;
    if (userProfile.panNumber && !(userProfile.bankAccount && userProfile.bankAccount.accountNumber)) return 4;
    if (userProfile.bankAccount?.accountNumber && !userProfile.documents?.profilePhoto?.url) return 5;
    if (userProfile.documents?.profilePhoto?.url && !userProfile.signatures?.offerLetter?.signed) return 6;
    if (userProfile.signatures?.offerLetter?.signed && !userProfile.signatures?.employeeAgreement?.signed) return 7;
    if (userProfile.signatures?.employeeAgreement?.signed && !userProfile.signatures?.handbookAcceptance?.signed) return 8;
    if (userProfile.signatures?.handbookAcceptance?.signed && !userProfile.signatures?.termsAndConditions?.signed) return 9;
    if (userProfile.signatures?.termsAndConditions?.signed) return 10;
    return 0;
  };

  const [stepIndex, setStepIndex] = useState(computeInitialStep);
  const [formData, setFormData] = useState(() => ({
    dateOfBirth: userProfile?.dateOfBirth || '',
    gender: userProfile?.gender || '',
    maritalStatus: userProfile?.maritalStatus || '',
    bloodGroup: userProfile?.bloodGroup || '',
    emergencyContact: userProfile?.emergencyContact || { name: '', relation: '', phone: '' },
    addressCurrent: userProfile?.addressCurrent || { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
    addressPermanent: userProfile?.addressPermanent || { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
    sameAddress: false,
    panNumber: userProfile?.panNumber || '',
    aadharNumber: userProfile?.aadharNumber || '',
    passportNumber: userProfile?.passportNumber || '',
    bankAccount: userProfile?.bankAccount || { accountNumber: '', ifsc: '', bankName: '', accountHolderName: userProfile?.name || '', branch: '' },
  }));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hrSettings, setHrSettings] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getHrSettings();
        setHrSettings(s);
      } catch {}
    })();
  }, []);

  const step = ONBOARDING_STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);

  const update = (patch) => setFormData(d => ({ ...d, ...patch }));
  // Nested-object updater — always reads from the latest state, never from a
  // closure. Use this for emergencyContact, addressCurrent, addressPermanent,
  // bankAccount, etc. so fast typing never drops characters.
  const updateNested = (key, subPatch) => setFormData(d => ({
    ...d,
    [key]: { ...(d[key] || {}), ...subPatch },
  }));

  // If userProfile loads after the component mounted (auth resolves late), or
  // changes under us (e.g. after a save), rehydrate any empty form fields with
  // the fresh values without clobbering anything the user has already typed.
  useEffect(() => {
    if (!userProfile) return;
    setFormData(d => ({
      dateOfBirth: d.dateOfBirth || userProfile.dateOfBirth || '',
      gender: d.gender || userProfile.gender || '',
      maritalStatus: d.maritalStatus || userProfile.maritalStatus || '',
      bloodGroup: d.bloodGroup || userProfile.bloodGroup || '',
      emergencyContact: {
        name: d.emergencyContact?.name || userProfile.emergencyContact?.name || '',
        relation: d.emergencyContact?.relation || userProfile.emergencyContact?.relation || '',
        phone: d.emergencyContact?.phone || userProfile.emergencyContact?.phone || '',
      },
      addressCurrent: {
        line1: d.addressCurrent?.line1 || userProfile.addressCurrent?.line1 || '',
        line2: d.addressCurrent?.line2 || userProfile.addressCurrent?.line2 || '',
        city: d.addressCurrent?.city || userProfile.addressCurrent?.city || '',
        state: d.addressCurrent?.state || userProfile.addressCurrent?.state || '',
        pincode: d.addressCurrent?.pincode || userProfile.addressCurrent?.pincode || '',
        country: d.addressCurrent?.country || userProfile.addressCurrent?.country || 'India',
      },
      addressPermanent: {
        line1: d.addressPermanent?.line1 || userProfile.addressPermanent?.line1 || '',
        line2: d.addressPermanent?.line2 || userProfile.addressPermanent?.line2 || '',
        city: d.addressPermanent?.city || userProfile.addressPermanent?.city || '',
        state: d.addressPermanent?.state || userProfile.addressPermanent?.state || '',
        pincode: d.addressPermanent?.pincode || userProfile.addressPermanent?.pincode || '',
        country: d.addressPermanent?.country || userProfile.addressPermanent?.country || 'India',
      },
      sameAddress: d.sameAddress || false,
      panNumber: d.panNumber || userProfile.panNumber || '',
      aadharNumber: d.aadharNumber || userProfile.aadharNumber || '',
      passportNumber: d.passportNumber || userProfile.passportNumber || '',
      bankAccount: {
        accountNumber: d.bankAccount?.accountNumber || userProfile.bankAccount?.accountNumber || '',
        ifsc: d.bankAccount?.ifsc || userProfile.bankAccount?.ifsc || '',
        bankName: d.bankAccount?.bankName || userProfile.bankAccount?.bankName || '',
        accountHolderName: d.bankAccount?.accountHolderName || userProfile.bankAccount?.accountHolderName || userProfile.name || '',
        branch: d.bankAccount?.branch || userProfile.bankAccount?.branch || '',
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  const goNext = () => setStepIndex(i => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  // Persist step data to Firestore then move forward
  const saveAndNext = async (patch) => {
    setSaving(true);
    setErrorMsg('');
    try {
      await updateEmployeeOnboarding(userProfile, patch);
      if (fetchUserProfile) await fetchUserProfile(userProfile.id);
      goNext();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Could not save progress');
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await completeOnboarding(userProfile);
      if (fetchUserProfile) await fetchUserProfile(userProfile.id);
      // Notify admin via email (best-effort)
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: hrSettings?.companyDetails?.adminEmail || 'admin@anandi-productions.com',
            subject: `${userProfile.name || 'Employee'} completed onboarding`,
            body: `${userProfile.name} has finished onboarding and is ready to start.`,
            type: 'employee_onboarding_complete_admin',
            data: { employeeName: userProfile.name, email: userProfile.email },
          }),
        });
      } catch {}
    } catch (err) {
      setErrorMsg(err.message || 'Could not complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    borderRadius: '8px',
    color: t.text,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: t.textMuted,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  };

  const fieldRow = { marginBottom: '14px' };
  const sectionHeading = {
    fontSize: '18px',
    fontWeight: 700,
    color: t.text,
    margin: '0 0 6px 0',
  };
  const sectionDesc = {
    fontSize: '13px',
    color: t.textSecondary,
    margin: '0 0 20px 0',
    lineHeight: 1.5,
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: t.bg,
      zIndex: 9000,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: t.text,
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 28px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: t.bgSecondary,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: t.gradientPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🎬</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>Anandi Productions</div>
            <div style={{ fontSize: '11px', color: t.textMuted }}>Employee Onboarding</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '11px', color: t.textMuted }}>Step {stepIndex + 1} of {ONBOARDING_STEPS.length}</div>
          <button
            onClick={signOut}
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textMuted,
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: t.border }}>
        <div style={{ width: `${progress}%`, height: '100%', background: t.gradientPrimary, transition: 'width 0.3s ease' }} />
      </div>

      {/* Step body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '640px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              {/* 0. Welcome */}
              {step.id === 'welcome' && (
                <div>
                  <div style={{ fontSize: '34px', marginBottom: '10px' }}>👋</div>
                  <h1 style={sectionHeading}>Welcome, {userProfile?.firstName || userProfile?.name || 'there'}</h1>
                  <p style={sectionDesc}>
                    Let's get you onboarded at Anandi Productions. This takes about 10 minutes and covers:
                  </p>
                  <ul style={{ color: t.textSecondary, fontSize: '13px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '24px' }}>
                    <li>Personal details &amp; emergency contact</li>
                    <li>Current and permanent address</li>
                    <li>PAN, Aadhar &amp; banking details</li>
                    <li>Profile photo (webcam)</li>
                    <li>Offer letter, employee agreement, handbook acceptance &amp; T&amp;C signature</li>
                  </ul>
                  <p style={{ ...sectionDesc, fontSize: '12px' }}>
                    You can pause anytime — your progress is saved automatically after each step.
                  </p>
                  <NavButtons t={t} onNext={goNext} nextLabel="Let's start →" backDisabled />
                </div>
              )}

              {/* 1. Personal Details */}
              {step.id === 'personal' && (
                <div>
                  <h1 style={sectionHeading}>Personal Details</h1>
                  <p style={sectionDesc}>Basic information about you.</p>

                  <div style={fieldRow}>
                    <label style={labelStyle}>Date of Birth</label>
                    <input type="date" value={formData.dateOfBirth} onChange={e => update({ dateOfBirth: e.target.value })} style={inputStyle} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Gender</label>
                      <select value={formData.gender} onChange={e => update({ gender: e.target.value })} style={inputStyle}>
                        <option value="">Select</option>
                        {GENDERS.map(g => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1).replace(/-/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Blood Group</label>
                      <select value={formData.bloodGroup} onChange={e => update({ bloodGroup: e.target.value })} style={inputStyle}>
                        <option value="">Select</option>
                        {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={fieldRow}>
                    <label style={labelStyle}>Marital Status</label>
                    <select value={formData.maritalStatus} onChange={e => update({ maritalStatus: e.target.value })} style={inputStyle}>
                      <option value="">Select</option>
                      <option>Single</option>
                      <option>Married</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: t.text, marginTop: '20px', marginBottom: '10px' }}>
                    Emergency Contact
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <input placeholder="Name" value={formData.emergencyContact.name} onChange={e => updateNested('emergencyContact', { name: e.target.value })} style={inputStyle} />
                    <input placeholder="Relation" value={formData.emergencyContact.relation} onChange={e => updateNested('emergencyContact', { relation: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={fieldRow}>
                    <input placeholder="Phone" value={formData.emergencyContact.phone} onChange={e => updateNested('emergencyContact', { phone: e.target.value })} style={inputStyle} />
                  </div>

                  {errorMsg && <div style={{ color: t.danger, fontSize: '12px', marginTop: '8px' }}>{errorMsg}</div>}
                  <NavButtons
                    t={t}
                    onBack={goBack}
                    onNext={() => saveAndNext({
                      dateOfBirth: formData.dateOfBirth,
                      gender: formData.gender,
                      maritalStatus: formData.maritalStatus,
                      bloodGroup: formData.bloodGroup,
                      emergencyContact: formData.emergencyContact,
                    })}
                    nextDisabled={saving || !formData.dateOfBirth || !formData.gender}
                    nextLabel={saving ? 'Saving...' : 'Continue'}
                  />
                </div>
              )}

              {/* 2. Address */}
              {step.id === 'address' && (
                <div>
                  <h1 style={sectionHeading}>Address</h1>
                  <p style={sectionDesc}>Where do you live now, and your permanent address?</p>

                  <AddressFields
                    t={t} inputStyle={inputStyle} labelStyle={labelStyle}
                    title="Current Address"
                    value={formData.addressCurrent}
                    setField={(k, v) => updateNested('addressCurrent', { [k]: v })}
                  />

                  <div style={{ margin: '10px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: t.textSecondary, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.sameAddress}
                        onChange={e => {
                          const checked = e.target.checked;
                          setFormData(d => ({
                            ...d,
                            sameAddress: checked,
                            addressPermanent: checked ? { ...d.addressCurrent } : d.addressPermanent,
                          }));
                        }}
                      />
                      Permanent address is the same as current
                    </label>
                  </div>

                  {!formData.sameAddress && (
                    <AddressFields
                      t={t} inputStyle={inputStyle} labelStyle={labelStyle}
                      title="Permanent Address"
                      value={formData.addressPermanent}
                      setField={(k, v) => updateNested('addressPermanent', { [k]: v })}
                    />
                  )}

                  {errorMsg && <div style={{ color: t.danger, fontSize: '12px', marginTop: '8px' }}>{errorMsg}</div>}
                  <NavButtons
                    t={t}
                    onBack={goBack}
                    onNext={() => saveAndNext({
                      addressCurrent: formData.addressCurrent,
                      addressPermanent: formData.sameAddress ? formData.addressCurrent : formData.addressPermanent,
                    })}
                    nextDisabled={saving || !formData.addressCurrent.city || !formData.addressCurrent.pincode}
                    nextLabel={saving ? 'Saving...' : 'Continue'}
                  />
                </div>
              )}

              {/* 3. Identity Documents */}
              {step.id === 'identity' && (
                <IdentityStep
                  userProfile={userProfile}
                  t={t}
                  inputStyle={inputStyle}
                  labelStyle={labelStyle}
                  formData={formData}
                  update={update}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 4. Banking */}
              {step.id === 'banking' && (
                <BankingStep
                  userProfile={userProfile}
                  t={t}
                  inputStyle={inputStyle}
                  labelStyle={labelStyle}
                  formData={formData}
                  update={update}
                  setFormData={setFormData}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 5. Photo */}
              {step.id === 'photo' && (
                <PhotoStep
                  userProfile={userProfile}
                  t={t}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 6. Offer Letter */}
              {step.id === 'offerLetter' && (
                <SignedDocumentStep
                  docKey="offerLetter"
                  title="Offer Letter"
                  template={fillTemplate(hrSettings?.offerLetterTemplate, userProfile)}
                  userProfile={userProfile}
                  t={t}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 7. Employee Agreement */}
              {step.id === 'agreement' && (
                <SignedDocumentStep
                  docKey="employeeAgreement"
                  title="Employee Agreement"
                  template={fillTemplate(hrSettings?.employeeAgreementTemplate, userProfile)}
                  userProfile={userProfile}
                  t={t}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 8. Handbook */}
              {step.id === 'handbook' && (
                <SignedDocumentStep
                  docKey="handbookAcceptance"
                  title="Employee Handbook"
                  template={`I acknowledge that I have received and read the Anandi Productions Employee Handbook (${hrSettings?.handbookVersion || 'v1'}). I understand and agree to comply with all policies, procedures, and guidelines contained within.`}
                  handbookUrl={hrSettings?.handbookUrl}
                  userProfile={userProfile}
                  t={t}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 9. Terms & Conditions */}
              {step.id === 'terms' && (
                <SignedDocumentStep
                  docKey="termsAndConditions"
                  title="Terms &amp; Conditions"
                  template={hrSettings?.termsAndConditionsText || ''}
                  userProfile={userProfile}
                  t={t}
                  saveAndNext={saveAndNext}
                  goBack={goBack}
                  sectionHeading={sectionHeading}
                  sectionDesc={sectionDesc}
                />
              )}

              {/* 10. Complete */}
              {step.id === 'complete' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
                  <h1 style={{ ...sectionHeading, fontSize: '26px' }}>Welcome to the team!</h1>
                  <p style={sectionDesc}>
                    You&apos;ve completed all onboarding steps. Click below to enter Anandi Productions.
                  </p>
                  {errorMsg && <div style={{ color: t.danger, fontSize: '12px', marginBottom: '10px' }}>{errorMsg}</div>}
                  <button
                    onClick={finish}
                    disabled={saving}
                    style={{
                      marginTop: '20px',
                      padding: '14px 32px',
                      background: t.gradientSuccess,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Finalizing...' : 'Enter Anandi Productions'}
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function NavButtons({ t, onBack, onNext, backDisabled, nextDisabled, nextLabel = 'Continue' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
      <button
        onClick={onBack}
        disabled={backDisabled}
        style={{
          padding: '10px 18px',
          background: 'transparent',
          color: backDisabled ? t.textMuted : t.text,
          border: `1px solid ${t.border}`,
          borderRadius: '8px',
          fontSize: '13px',
          cursor: backDisabled ? 'not-allowed' : 'pointer',
          opacity: backDisabled ? 0.4 : 1,
        }}
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          padding: '10px 22px',
          background: nextDisabled ? t.bgCard : t.gradientPrimary,
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: nextDisabled ? 'not-allowed' : 'pointer',
          opacity: nextDisabled ? 0.5 : 1,
        }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function AddressFields({ t, title, value, setField, inputStyle, labelStyle }) {
  // Each input calls setField(key, newValue). The parent resolves the patch
  // against the LATEST state via a functional updater, so fast typing can
  // never drop characters across multiple fields.
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: t.text, marginBottom: '10px' }}>{title}</div>
      <div style={{ marginBottom: '10px' }}>
        <input placeholder="Address line 1" value={value.line1 || ''} onChange={e => setField('line1', e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <input placeholder="Address line 2 (optional)" value={value.line2 || ''} onChange={e => setField('line2', e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <input placeholder="City" value={value.city || ''} onChange={e => setField('city', e.target.value)} style={inputStyle} />
        <input placeholder="State" value={value.state || ''} onChange={e => setField('state', e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <input placeholder="Pincode" value={value.pincode || ''} onChange={e => setField('pincode', e.target.value)} style={inputStyle} />
        <input placeholder="Country" value={value.country || ''} onChange={e => setField('country', e.target.value)} style={inputStyle} />
      </div>
    </div>
  );
}

function IdentityStep({ userProfile, t, inputStyle, labelStyle, formData, update, saveAndNext, goBack, sectionHeading, sectionDesc }) {
  const [panFile, setPanFile] = useState(null);
  const [aadharFile, setAadharFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handleNext = async () => {
    setErr('');
    if (!formData.panNumber.trim()) return setErr('PAN is required');
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.trim().toUpperCase())) return setErr('Invalid PAN format');
    if (!formData.aadharNumber.trim()) return setErr('Aadhar is required');
    setUploading(true);
    try {
      const docs = { ...(userProfile.documents || {}) };
      if (panFile) {
        const res = await uploadEmployeeDocument(userProfile.id, 'panCard', panFile);
        docs.panCard = { url: res.url, path: res.path, uploadedAt: new Date().toISOString() };
      }
      if (aadharFile) {
        const res = await uploadEmployeeDocument(userProfile.id, 'aadharCard', aadharFile);
        docs.aadharCard = { url: res.url, path: res.path, uploadedAt: new Date().toISOString() };
      }
      await saveAndNext({
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.trim(),
        passportNumber: formData.passportNumber.trim(),
        documents: docs,
      });
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 style={sectionHeading}>Identity Documents</h1>
      <p style={sectionDesc}>PAN and Aadhar are mandatory. Upload clear photos of both.</p>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>PAN Number</label>
        <input placeholder="ABCDE1234F" value={formData.panNumber} onChange={e => update({ panNumber: e.target.value.toUpperCase() })} style={{ ...inputStyle, textTransform: 'uppercase' }} />
      </div>
      <FileInput t={t} label="Upload PAN Card" file={panFile} existingUrl={userProfile.documents?.panCard?.url} onChange={setPanFile} accept="image/*,application/pdf" />

      <div style={{ marginBottom: '14px', marginTop: '14px' }}>
        <label style={labelStyle}>Aadhar Number</label>
        <input placeholder="XXXX XXXX XXXX" value={formData.aadharNumber} onChange={e => update({ aadharNumber: e.target.value })} style={inputStyle} />
      </div>
      <FileInput t={t} label="Upload Aadhar Card" file={aadharFile} existingUrl={userProfile.documents?.aadharCard?.url} onChange={setAadharFile} accept="image/*,application/pdf" />

      <div style={{ marginBottom: '14px', marginTop: '14px' }}>
        <label style={labelStyle}>Passport Number (optional)</label>
        <input value={formData.passportNumber} onChange={e => update({ passportNumber: e.target.value })} style={inputStyle} />
      </div>

      {err && <div style={{ color: t.danger, fontSize: '12px', marginTop: '8px' }}>{err}</div>}
      <NavButtons t={t} onBack={goBack} onNext={handleNext} nextDisabled={uploading} nextLabel={uploading ? 'Uploading...' : 'Continue'} />
    </div>
  );
}

function BankingStep({ userProfile, t, inputStyle, labelStyle, formData, update, setFormData, saveAndNext, goBack, sectionHeading, sectionDesc }) {
  const [chequeFile, setChequeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const b = formData.bankAccount || {};
  // Functional updater so rapid keystrokes across different bank fields don't
  // overwrite each other via a stale closure.
  const set = (patch) => setFormData(d => ({
    ...d,
    bankAccount: { ...(d.bankAccount || {}), ...patch },
  }));

  const handleNext = async () => {
    setErr('');
    if (!b.accountNumber || !b.ifsc || !b.bankName || !b.accountHolderName) return setErr('All bank fields are required');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.ifsc.toUpperCase())) return setErr('Invalid IFSC format');
    setUploading(true);
    try {
      const docs = { ...(userProfile.documents || {}) };
      if (chequeFile) {
        const res = await uploadEmployeeDocument(userProfile.id, 'cancelledCheque', chequeFile);
        docs.cancelledCheque = { url: res.url, path: res.path, uploadedAt: new Date().toISOString() };
      }
      await saveAndNext({
        bankAccount: { ...b, ifsc: b.ifsc.toUpperCase() },
        documents: docs,
      });
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 style={sectionHeading}>Banking Details</h1>
      <p style={sectionDesc}>Your salary will be deposited to this account.</p>

      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Account Holder Name</label>
        <input value={b.accountHolderName} onChange={e => set({ accountHolderName: e.target.value })} style={inputStyle} />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Account Number</label>
        <input value={b.accountNumber} onChange={e => set({ accountNumber: e.target.value })} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={labelStyle}>IFSC Code</label>
          <input value={b.ifsc} onChange={e => set({ ifsc: e.target.value.toUpperCase() })} style={{ ...inputStyle, textTransform: 'uppercase' }} />
        </div>
        <div>
          <label style={labelStyle}>Bank Name</label>
          <input value={b.bankName} onChange={e => set({ bankName: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Branch</label>
        <input value={b.branch} onChange={e => set({ branch: e.target.value })} style={inputStyle} />
      </div>

      <FileInput t={t} label="Upload Cancelled Cheque" file={chequeFile} existingUrl={userProfile.documents?.cancelledCheque?.url} onChange={setChequeFile} accept="image/*,application/pdf" />

      {err && <div style={{ color: t.danger, fontSize: '12px', marginTop: '8px' }}>{err}</div>}
      <NavButtons t={t} onBack={goBack} onNext={handleNext} nextDisabled={uploading} nextLabel={uploading ? 'Saving...' : 'Continue'} />
    </div>
  );
}

function PhotoStep({ userProfile, t, saveAndNext, goBack, sectionHeading, sectionDesc }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const existingUrl = userProfile.documents?.profilePhoto?.url;

  const handleCapture = async (blob) => {
    setUploading(true);
    setErr('');
    try {
      const res = await uploadEmployeeBlob(userProfile.id, `profile-photo-${Date.now()}.jpg`, blob);
      const docs = { ...(userProfile.documents || {}) };
      docs.profilePhoto = { url: res.url, path: res.path, uploadedAt: new Date().toISOString() };
      // NOTE: don't write the URL into `avatar` — that field is used by the
      // header Avatar component as a text/emoji fallback and rendering a raw
      // URL there leaks the full storage link into the UI. The photo lives in
      // documents.profilePhoto.url; the Avatar component should read from
      // there when it wants to display an image.
      await saveAndNext({ documents: docs });
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 style={sectionHeading}>Profile Photo</h1>
      <p style={sectionDesc}>Take a clear selfie using your webcam. We&apos;ll use this as your profile picture.</p>

      {existingUrl && (
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Current photo</div>
          <img src={existingUrl} alt="Current" style={{ width: '120px', height: '120px', borderRadius: '12px', objectFit: 'cover', border: `1px solid ${t.border}` }} />
        </div>
      )}

      <WebcamCapture t={t} onCapture={handleCapture} />

      {uploading && <div style={{ textAlign: 'center', color: t.textMuted, fontSize: '12px', marginTop: '10px' }}>Uploading...</div>}
      {err && <div style={{ color: t.danger, fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>{err}</div>}

      <NavButtons t={t} onBack={goBack} onNext={() => existingUrl && saveAndNext({})} nextDisabled={!existingUrl || uploading} nextLabel="Continue" />
    </div>
  );
}

function SignedDocumentStep({ docKey, title, template, handbookUrl, userProfile, t, saveAndNext, goBack, sectionHeading, sectionDesc }) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSign = async (result) => {
    setSubmitting(true);
    setErr('');
    try {
      const sig = await saveSignatureImage(userProfile.id, docKey, result.signatureDataUrl);
      const signatures = { ...(userProfile.signatures || {}) };
      signatures[docKey] = {
        signed: true,
        signedAt: result.signedAt,
        typedName: result.typedName,
        signatureUrl: sig.url,
        signaturePath: sig.path,
        ipAddress: result.ipAddress,
      };
      await saveAndNext({ signatures });
    } catch (e) {
      setErr(e.message || 'Failed to save signature');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 style={sectionHeading}>{title}</h1>
      <p style={sectionDesc}>Please read carefully and sign below to continue.</p>

      <div style={{
        background: t.bgCard,
        border: `1px solid ${t.border}`,
        borderRadius: '12px',
        padding: '18px',
        marginBottom: '18px',
        maxHeight: '280px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        fontSize: '12.5px',
        lineHeight: 1.65,
        color: t.textSecondary,
      }}>
        {template || '(document text pending)'}
      </div>

      {handbookUrl && (
        <div style={{ marginBottom: '14px' }}>
          <a href={handbookUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.primary, fontSize: '12px', textDecoration: 'underline' }}>
            Download full handbook PDF →
          </a>
        </div>
      )}

      <SignaturePad t={t} expectedName={userProfile.name} onSign={handleSign} />

      {submitting && <div style={{ color: t.textMuted, fontSize: '12px', marginTop: '10px' }}>Saving signature...</div>}
      {err && <div style={{ color: t.danger, fontSize: '12px', marginTop: '8px' }}>{err}</div>}

      <div style={{ marginTop: '12px' }}>
        <button
          onClick={goBack}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: t.textMuted,
            border: `1px solid ${t.border}`,
            borderRadius: '8px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function FileInput({ t, label, file, existingUrl, onChange, accept }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
      </div>
      <div style={{
        border: `1px dashed ${t.border}`,
        borderRadius: '8px',
        padding: '14px',
        background: t.bgInput,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '12px', color: t.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {file ? file.name : existingUrl ? 'Previously uploaded ✓' : 'No file selected'}
        </div>
        <label style={{
          padding: '6px 14px',
          background: t.primary,
          color: '#fff',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          {existingUrl ? 'Replace' : 'Choose file'}
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      {existingUrl && (
        <a href={existingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: t.primary, textDecoration: 'underline' }}>
          View current upload →
        </a>
      )}
    </div>
  );
}

function fillTemplate(tpl, user) {
  if (!tpl) return '';
  const replacements = {
    '{{name}}': user?.name || '',
    '{{firstName}}': user?.firstName || '',
    '{{email}}': user?.email || '',
    '{{designation}}': user?.designation || '',
    '{{department}}': user?.department || '',
    '{{dateOfJoining}}': user?.dateOfJoining || '',
    '{{annualCtc}}': user?.ctc?.annual ? Number(user.ctc.annual).toLocaleString('en-IN') : '—',
    '{{employeeId}}': user?.employeeId || '',
  };
  let out = tpl;
  for (const [k, v] of Object.entries(replacements)) {
    out = out.split(k).join(v);
  }
  return out;
}
