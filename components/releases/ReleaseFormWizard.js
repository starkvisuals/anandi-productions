'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import SignaturePad from '@/components/hr/SignaturePad';
import WebcamCapture from '@/components/hr/WebcamCapture';
import { MODEL_RELEASE_TEXT, DOS_AND_DONTS_TEXT } from '@/lib/releaseTexts';
import { uploadReleasePhoto, uploadReleaseSignature, createSubmission } from '@/lib/releases';

// ─── Light theme for public page ────────────────────────────────────────────
const T = {
  bg: '#f8f9fa',
  cardBg: '#ffffff',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  success: '#22c55e',
  danger: '#ef4444',
  bgInput: '#f3f4f6',
};

// ─── Anandi logo (inline SVG placeholder — uses text) ───────────────────────
const Logo = () => (
  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
    <div style={{ fontSize: '22px', fontWeight: 800, color: T.text, letterSpacing: '2px' }}>
      ANANDI PRODUCTIONS
    </div>
  </div>
);

// ─── Step indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'photo', label: 'Photo' },
  { id: 'release', label: 'Model Release' },
  { id: 'conduct', label: "Do's & Don'ts" },
];

const StepIndicator = ({ current }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '16px 0 24px' }}>
    {STEPS.map((s, i) => (
      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700,
          background: i <= current ? T.primary : T.bgInput,
          color: i <= current ? '#fff' : T.textMuted,
          transition: 'all 0.2s',
        }}>
          {i < current ? '✓' : i + 1}
        </div>
        {i < STEPS.length - 1 && (
          <div style={{ width: '24px', height: '2px', background: i < current ? T.primary : T.border }} />
        )}
      </div>
    ))}
  </div>
);

// ─── Reusable field ─────────────────────────────────────────────────────────
const Field = ({ label, required, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted }}>
      {label} {required && <span style={{ color: T.danger }}>*</span>}
    </label>
    {children}
  </div>
);

const inputStyle = {
  padding: '12px 14px',
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  borderRadius: '10px',
  color: T.text,
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

// ─── Scroll-to-bottom gate ──────────────────────────────────────────────────
function ScrollableAgreement({ text, onScrolledToBottom }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onScrolledToBottom(); },
      { root: containerRef.current, threshold: 0.9 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onScrolledToBottom]);

  return (
    <div
      ref={containerRef}
      style={{
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '20px',
        background: '#fafafa',
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        fontSize: '13px',
        lineHeight: 1.7,
        color: T.text,
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit',
      }}
    >
      {text}
      <div ref={bottomRef} style={{ height: '1px' }} />
    </div>
  );
}

// ─── Main wizard ────────────────────────────────────────────────────────────
export default function ReleaseFormWizard({ campaign, campaignId }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // GPS
  const [gps, setGps] = useState({ lat: null, lng: null });
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // fail silently
      );
    }
  }, []);

  // Form data across all steps
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    aadhar: '',
    dob: '',
  });
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signatureResult, setSignatureResult] = useState(null);
  const [releaseScrolled, setReleaseScrolled] = useState(false);
  const [releaseAgreed, setReleaseAgreed] = useState(false);
  const [conductScrolled, setConductScrolled] = useState(false);
  const [conductAgreed, setConductAgreed] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Substitute placeholders in legal texts
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const sub = (text) => text
    .replace(/\{\{companyLegalName\}\}/g, 'Anandi Productions')
    .replace(/\{\{companyOwner\}\}/g, 'Harnesh Joshi')
    .replace(/\{\{campaignLabel\}\}/g, campaign?.label || '')
    .replace(/\{\{submissionDate\}\}/g, today);

  // ─── Step 1: Personal details ───────────────────────────────────────────
  const validateDetails = () => {
    if (!form.name.trim()) return 'Name is required';
    if (!form.phone.trim()) return 'Phone number is required';
    if (!form.address.trim()) return 'Address is required';
    if (!form.aadhar.trim()) return 'Aadhar card number is required';
    if (!/^\d{12}$/.test(form.aadhar.replace(/\s/g, ''))) return 'Aadhar must be 12 digits';
    if (!form.dob) return 'Date of birth is required';
    return null;
  };

  const nextFromDetails = () => {
    const err = validateDetails();
    if (err) { setError(err); return; }
    setError('');
    setStep(1);
  };

  // ─── Step 2: Photo ─────────────────────────────────────────────────────
  const [photoMode, setPhotoMode] = useState(null); // null | 'camera' | 'upload'

  const handlePhotoCapture = (blob) => {
    setPhotoBlob(blob);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(blob));
    setPhotoMode(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBlob(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoMode(null);
  };

  const nextFromPhoto = () => {
    if (!photoBlob) { setError('Please take or upload a photo'); return; }
    setError('');
    setStep(2);
  };

  // ─── Step 3: Model Release ─────────────────────────────────────────────
  const onReleaseScrolled = useCallback(() => setReleaseScrolled(true), []);

  const handleSignature = (result) => {
    setSignatureResult(result);
    setError('');
    setStep(3);
  };

  // ─── Step 4: Do's & Don'ts + final submit ──────────────────────────────
  const onConductScrolled = useCallback(() => setConductScrolled(true), []);

  const handleFinalSubmit = async () => {
    if (!conductAgreed) { setError('Please agree to the terms'); return; }
    setError('');
    setSubmitting(true);
    try {
      // Upload photo
      const photoRes = await uploadReleasePhoto(campaignId, photoBlob);
      // Upload signature
      const sigRes = await uploadReleaseSignature(campaignId, signatureResult.signatureDataUrl);

      // Create submission
      await createSubmission(campaignId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        aadhar: form.aadhar.replace(/\s/g, ''),
        dob: form.dob,
        photoUrl: photoRes.url,
        photoPath: photoRes.path,
        signatureUrl: sigRes.url,
        signaturePath: sigRes.path,
        signatureTypedName: signatureResult.typedName,
        signatureIp: signatureResult.ipAddress,
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        agreedReleaseAt: signatureResult.signedAt,
        agreedDosDontsAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        campaignLabel: campaign?.label || '',
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Submitted confirmation ────────────────────────────────────────────
  if (submitted) {
    return (
      <PageWrapper>
        <Logo />
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: T.success, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', color: '#fff', margin: '0 auto 20px',
          }}>✓</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: T.text, margin: '0 0 8px' }}>
            Thank You, {form.name.split(' ')[0]}!
          </h2>
          <p style={{ fontSize: '14px', color: T.textMuted, margin: 0, lineHeight: 1.6 }}>
            Your model release and production conduct agreement have been submitted successfully
            for <strong>{campaign?.label}</strong>.
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Logo />
      <div style={{ fontSize: '14px', fontWeight: 600, color: T.primary, textAlign: 'center', marginBottom: '4px' }}>
        {campaign?.label}
      </div>
      <StepIndicator current={step} />

      {error && (
        <div style={{
          padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '8px', color: T.danger, fontSize: '13px', marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Step 1: Personal Details */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, margin: 0 }}>Personal Details</h3>
          <Field label="Full Name" required>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Enter your full name" />
          </Field>
          <Field label="Phone Number" required>
            <input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Address" required>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Full residential address"
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Aadhar Card Number" required>
              <input style={inputStyle} value={form.aadhar} onChange={e => set('aadhar', e.target.value)} placeholder="1234 5678 9012" maxLength={14} />
            </Field>
            <Field label="Date of Birth" required>
              <input style={inputStyle} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
            </Field>
          </div>
          <button onClick={nextFromDetails} style={btnPrimary}>Continue</button>
        </div>
      )}

      {/* Step 2: Photo */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, margin: 0, alignSelf: 'flex-start' }}>Your Photo</h3>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0, alignSelf: 'flex-start' }}>
            Take a clear photo of your face or upload one.
          </p>

          {photoPreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <img src={photoPreview} alt="Preview" style={{ width: '200px', height: '200px', borderRadius: '12px', objectFit: 'cover', border: `2px solid ${T.border}` }} />
              <button onClick={() => { setPhotoBlob(null); setPhotoPreview(null); setPhotoMode(null); }} style={btnSecondary}>
                Retake / Change
              </button>
            </div>
          ) : photoMode === 'camera' ? (
            <WebcamCapture
              onCapture={handlePhotoCapture}
              onCancel={() => setPhotoMode(null)}
              t={T}
              size={280}
            />
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => setPhotoMode('camera')} style={{ ...btnSecondary, padding: '20px 28px', fontSize: '14px' }}>
                📸 Take Selfie
              </button>
              <label style={{ ...btnSecondary, padding: '20px 28px', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                📁 Upload Photo
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
            <button onClick={() => setStep(0)} style={btnSecondary}>Back</button>
            <button onClick={nextFromPhoto} style={{ ...btnPrimary, flex: 1 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step 3: Model Release */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, margin: 0 }}>Model Release Agreement</h3>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0 }}>
            Please read the entire agreement below. You must scroll to the bottom to proceed.
          </p>

          <ScrollableAgreement text={sub(MODEL_RELEASE_TEXT)} onScrolledToBottom={onReleaseScrolled} />

          {releaseScrolled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: T.text }}>
                <input
                  type="checkbox"
                  checked={releaseAgreed}
                  onChange={e => setReleaseAgreed(e.target.checked)}
                  style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: T.primary }}
                />
                <span>I have read and agree to the terms of the Model Release Agreement. I understand that this is a legally binding document.</span>
              </label>

              {releaseAgreed && (
                <>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: T.text }}>Please sign below:</div>
                  <SignaturePad
                    expectedName={form.name}
                    onSign={handleSignature}
                    t={T}
                    width={380}
                    height={140}
                  />
                </>
              )}
            </div>
          )}

          {!releaseScrolled && (
            <div style={{ fontSize: '12px', color: T.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
              ↓ Scroll to the bottom of the agreement to continue
            </div>
          )}

          <button onClick={() => setStep(1)} style={btnSecondary}>Back</button>
        </div>
      )}

      {/* Step 4: Do's & Don'ts */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, margin: 0 }}>Production Conduct — Do's & Don'ts</h3>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0 }}>
            Please read the entire production conduct agreement below. You must scroll to the bottom to proceed.
          </p>

          <ScrollableAgreement text={sub(DOS_AND_DONTS_TEXT)} onScrolledToBottom={onConductScrolled} />

          {conductScrolled && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: T.text }}>
              <input
                type="checkbox"
                checked={conductAgreed}
                onChange={e => setConductAgreed(e.target.checked)}
                style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: T.primary }}
              />
              <span>I have read, understood, and agree to comply with all the Do's & Don'ts set out in this Production Conduct Agreement.</span>
            </label>
          )}

          {!conductScrolled && (
            <div style={{ fontSize: '12px', color: T.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
              ↓ Scroll to the bottom of the agreement to continue
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setStep(2)} style={btnSecondary}>Back</button>
            <button
              onClick={handleFinalSubmit}
              disabled={!conductAgreed || submitting}
              style={{
                ...btnPrimary,
                flex: 1,
                opacity: (!conductAgreed || submitting) ? 0.5 : 1,
                cursor: (!conductAgreed || submitting) ? 'not-allowed' : 'pointer',
                background: T.success,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Release'}
            </button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

// ─── Layout wrapper ─────────────────────────────────────────────────────────
function PageWrapper({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: T.cardBg,
        borderRadius: '16px',
        border: `1px solid ${T.border}`,
        padding: '28px 24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        alignSelf: 'flex-start',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Button styles ──────────────────────────────────────────────────────────
const btnPrimary = {
  padding: '13px 24px',
  background: T.primary,
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnSecondary = {
  padding: '11px 18px',
  background: 'transparent',
  color: T.text,
  border: `1px solid ${T.border}`,
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
