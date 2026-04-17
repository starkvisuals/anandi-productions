'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import AppLogo from '@/components/Logo';
import SignaturePad from '@/components/hr/SignaturePad';
import WebcamCapture from '@/components/hr/WebcamCapture';
import { MODEL_RELEASE_TEXT, DOS_AND_DONTS_TEXT } from '@/lib/releaseTexts';
import {
  uploadReleasePhoto, uploadReleaseSignature,
  uploadReleaseAadhar, createSubmission,
} from '@/lib/releases';

// ─── Light theme for public page ────────────────────────────────────────────
const T = {
  bg: '#f0f2f5',
  cardBg: '#ffffff',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  borderFocus: '#6366f1',
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  success: '#22c55e',
  danger: '#ef4444',
  bgInput: '#f9fafb',
  bgSection: '#fafafa',
};

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'photo',   label: 'Photo'   },
  { id: 'release', label: 'Release' },
  { id: 'conduct', label: "Conduct" },
];

// ─── Step indicator ──────────────────────────────────────────────────────────
const StepIndicator = ({ current }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0', margin: '20px 0 28px' }}>
    {STEPS.map((s, i) => (
      <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
        {/* Connector line before step (skip first) */}
        {i > 0 && (
          <div style={{
            width: '32px', height: '2px',
            background: i <= current ? T.primary : T.border,
            transition: 'background 0.3s',
          }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700,
            background: i < current ? T.primary : i === current ? T.primary : T.border,
            color: i <= current ? '#fff' : T.textMuted,
            boxShadow: i === current ? `0 0 0 4px rgba(99,102,241,0.18)` : 'none',
            transition: 'all 0.25s',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          <span style={{
            fontSize: '10px', fontWeight: i === current ? 700 : 500,
            color: i === current ? T.primary : T.textMuted,
            letterSpacing: '0.3px',
            transition: 'color 0.25s',
          }}>
            {s.label}
          </span>
        </div>
      </div>
    ))}
  </div>
);

// ─── Reusable field label ─────────────────────────────────────────────────────
const Field = ({ label, required, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted, letterSpacing: '0.2px' }}>
      {label}{required && <span style={{ color: T.danger, marginLeft: '2px' }}>*</span>}
    </label>
    {children}
    {hint && <span style={{ fontSize: '11px', color: T.textMuted }}>{hint}</span>}
  </div>
);

const inputStyle = {
  padding: '12px 14px',
  background: T.bgInput,
  border: `1.5px solid ${T.border}`,
  borderRadius: '10px',
  color: T.text,
  fontSize: '15px',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

// ─── Aadhar image upload tile ─────────────────────────────────────────────────
const AadharUpload = ({ label, file, preview, onChange }) => (
  <Field label={label} required>
    {preview ? (
      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: `1.5px solid ${T.border}` }}>
        <img
          src={preview}
          alt={label}
          style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }}
        />
        <label style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
          color: '#fff', fontSize: '11px', fontWeight: 600,
          textAlign: 'center', padding: '5px 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        }}>
          <span>📷 Change</span>
          <input type="file" accept="image/*" capture="environment" onChange={onChange} style={{ display: 'none' }} />
        </label>
      </div>
    ) : (
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '6px', padding: '18px 12px', cursor: 'pointer',
        background: T.bgInput, border: `1.5px dashed ${T.border}`,
        borderRadius: '10px', minHeight: '80px', transition: 'border-color 0.15s',
      }}>
        <span style={{ fontSize: '22px' }}>📷</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted, textAlign: 'center', lineHeight: 1.3 }}>
          Tap to upload<br />{label}
        </span>
        <input type="file" accept="image/*" capture="environment" onChange={onChange} style={{ display: 'none' }} />
      </label>
    )}
  </Field>
);

// ─── Scroll-to-bottom gate ────────────────────────────────────────────────────
function ScrollableAgreement({ text, onScrolledToBottom }) {
  const bottomRef  = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onScrolledToBottom(); },
      { root: containerRef.current, threshold: 0.9 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onScrolledToBottom]);

  return (
    <div
      ref={containerRef}
      style={{
        maxHeight: '380px',
        overflowY: 'auto',
        padding: '20px',
        background: T.bgSection,
        border: `1.5px solid ${T.border}`,
        borderRadius: '12px',
        fontSize: '13px',
        lineHeight: 1.75,
        color: T.text,
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit',
        scrollBehavior: 'smooth',
      }}
    >
      {text}
      <div ref={bottomRef} style={{ height: '1px', marginTop: '8px' }} />
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export default function ReleaseFormWizard({ campaign, campaignId }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // GPS — capture on mount
  const [gps, setGps] = useState({ lat: null, lng: null });
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
      );
    }
  }, []);

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ name: '', phone: '', address: '', aadhar: '', dob: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Profile photo
  const [photoBlob, setPhotoBlob]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoMode, setPhotoMode]       = useState(null); // null | 'camera'

  // Aadhar images
  const [aadharFrontFile, setAadharFrontFile]       = useState(null);
  const [aadharFrontPreview, setAadharFrontPreview] = useState(null);
  const [aadharBackFile, setAadharBackFile]         = useState(null);
  const [aadharBackPreview, setAadharBackPreview]   = useState(null);

  // Agreement state
  const [releaseScrolled, setReleaseScrolled] = useState(false);
  const [releaseAgreed,   setReleaseAgreed]   = useState(false);
  const [conductScrolled, setConductScrolled] = useState(false);
  const [conductAgreed,   setConductAgreed]   = useState(false);
  const [signatureResult, setSignatureResult] = useState(null);

  // ─── Text substitutions ──────────────────────────────────────────────────────
  const today = (() => {
    const d = new Date();
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const sub = (text) => text
    .replace(/\{\{companyLegalName\}\}/g, 'Anandi Productions')
    .replace(/\{\{companyOwner\}\}/g, 'Harnesh Joshi')
    .replace(/\{\{campaignLabel\}\}/g, campaign?.label || '')
    .replace(/\{\{submissionDate\}\}/g, today);

  // ─── Aadhar upload helpers ────────────────────────────────────────────────
  const handleAadharFront = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAadharFrontFile(file);
    if (aadharFrontPreview) URL.revokeObjectURL(aadharFrontPreview);
    setAadharFrontPreview(URL.createObjectURL(file));
  };

  const handleAadharBack = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAadharBackFile(file);
    if (aadharBackPreview) URL.revokeObjectURL(aadharBackPreview);
    setAadharBackPreview(URL.createObjectURL(file));
  };

  // ─── Step 1: validate & advance ──────────────────────────────────────────
  const validateDetails = () => {
    if (!form.name.trim())    return 'Full name is required';
    if (!form.phone.trim())   return 'Phone number is required';
    if (!form.address.trim()) return 'Address is required';
    if (!form.aadhar.trim())  return 'Aadhar card number is required';
    if (!/^\d{12}$/.test(form.aadhar.replace(/\s/g, '')))
      return 'Aadhar must be exactly 12 digits';
    if (!form.dob) return 'Date of birth is required';
    if (!aadharFrontFile) return 'Please upload the front of your Aadhar card';
    if (!aadharBackFile)  return 'Please upload the back of your Aadhar card';
    return null;
  };

  const nextFromDetails = () => {
    const err = validateDetails();
    if (err) { setError(err); return; }
    setError('');
    setStep(1);
  };

  // ─── Step 2: photo ───────────────────────────────────────────────────────
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

  // ─── Step 3: model release ────────────────────────────────────────────────
  const onReleaseScrolled = useCallback(() => setReleaseScrolled(true), []);

  const handleSignature = (result) => {
    setSignatureResult(result);
    setError('');
    setStep(3);
  };

  // ─── Step 4: conduct + final submit ──────────────────────────────────────
  const onConductScrolled = useCallback(() => setConductScrolled(true), []);

  const handleFinalSubmit = async () => {
    if (!conductAgreed) { setError('Please agree to the production conduct guidelines'); return; }
    setError('');
    setSubmitting(true);
    try {
      // Parallel uploads
      const [photoRes, sigRes, aadharFrontRes, aadharBackRes] = await Promise.all([
        uploadReleasePhoto(campaignId, photoBlob),
        uploadReleaseSignature(campaignId, signatureResult.signatureDataUrl),
        uploadReleaseAadhar(campaignId, aadharFrontFile, 'front'),
        uploadReleaseAadhar(campaignId, aadharBackFile,  'back'),
      ]);

      await createSubmission(campaignId, {
        name:    form.name.trim(),
        phone:   form.phone.trim(),
        address: form.address.trim(),
        aadhar:  form.aadhar.replace(/\s/g, ''),
        dob:     form.dob,
        photoUrl:          photoRes.url,
        photoPath:         photoRes.path,
        signatureUrl:      sigRes.url,
        signaturePath:     sigRes.path,
        signatureTypedName: signatureResult.typedName,
        signatureIp:       signatureResult.ipAddress,
        aadharFrontUrl:    aadharFrontRes.url,
        aadharFrontPath:   aadharFrontRes.path,
        aadharBackUrl:     aadharBackRes.url,
        aadharBackPath:    aadharBackRes.path,
        gpsLat:  gps.lat,
        gpsLng:  gps.lng,
        agreedReleaseAt:  signatureResult.signedAt,
        agreedDosDontsAt: new Date().toISOString(),
        userAgent:     typeof navigator !== 'undefined' ? navigator.userAgent : '',
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

  // ─── Submitted ──────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <PageWrapper>
        <LogoHeader />
        <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${T.success}, #16a34a)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', color: '#fff', margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
          }}>✓</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: T.text, margin: '0 0 10px' }}>
            Thank You, {form.name.split(' ')[0]}!
          </h2>
          <p style={{ fontSize: '14px', color: T.textMuted, margin: 0, lineHeight: 1.7, maxWidth: '340px', marginInline: 'auto' }}>
            Your model release and production conduct agreement have been submitted
            successfully for <strong style={{ color: T.text }}>{campaign?.label}</strong>.
          </p>
          <div style={{
            marginTop: '24px', padding: '14px 20px',
            background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0',
            fontSize: '13px', color: '#166534',
          }}>
            🎬 You're all set — see you on set!
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <LogoHeader />

      {/* Campaign label */}
      <div style={{
        textAlign: 'center', marginBottom: '4px',
        fontSize: '13px', fontWeight: 600, color: T.primary,
        background: 'rgba(99,102,241,0.07)', borderRadius: '6px',
        padding: '5px 12px', display: 'inline-block',
        width: '100%', boxSizing: 'border-box',
      }}>
        {campaign?.label}
      </div>

      <StepIndicator current={step} />

      {error && (
        <div style={{
          padding: '11px 14px', background: '#fef2f2',
          border: '1.5px solid #fecaca', borderRadius: '10px',
          color: T.danger, fontSize: '13px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── Step 1: Personal Details ── */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <SectionHeading>Personal Details</SectionHeading>

          <Field label="Full Name" required>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Enter your full legal name"
              autoComplete="name"
            />
          </Field>

          <Field label="Phone Number" required>
            <input
              style={inputStyle}
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+91 98765 43210"
              autoComplete="tel"
            />
          </Field>

          <Field label="Residential Address" required>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Full residential address"
              autoComplete="street-address"
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Aadhar Card Number" required>
              <input
                style={inputStyle}
                value={form.aadhar}
                onChange={e => set('aadhar', e.target.value)}
                placeholder="1234 5678 9012"
                maxLength={14}
                inputMode="numeric"
              />
            </Field>
            <Field label="Date of Birth" required>
              <input style={inputStyle} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
            </Field>
          </div>

          {/* Aadhar card photos */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted, marginBottom: '10px' }}>
              AADHAR CARD PHOTOS <span style={{ color: T.danger }}>*</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AadharUpload
                label="Front Side"
                file={aadharFrontFile}
                preview={aadharFrontPreview}
                onChange={handleAadharFront}
              />
              <AadharUpload
                label="Back Side"
                file={aadharBackFile}
                preview={aadharBackPreview}
                onChange={handleAadharBack}
              />
            </div>
          </div>

          <button onClick={nextFromDetails} style={btnPrimary}>
            Continue →
          </button>
        </div>
      )}

      {/* ── Step 2: Photo ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
          <SectionHeading style={{ alignSelf: 'flex-start' }}>Your Photo</SectionHeading>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0, alignSelf: 'flex-start', lineHeight: 1.5 }}>
            Please take a clear, well-lit photo of your face. This will be part of your release documentation.
          </p>

          {photoPreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
              <img
                src={photoPreview}
                alt="Your photo"
                style={{
                  width: '200px', height: '200px', borderRadius: '14px',
                  objectFit: 'cover', border: `2px solid ${T.border}`,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                }}
              />
              <button
                onClick={() => { setPhotoBlob(null); setPhotoPreview(null); setPhotoMode(null); }}
                style={btnSecondary}
              >
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
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              <button
                onClick={() => setPhotoMode('camera')}
                style={{ ...btnSecondary, padding: '20px 28px', fontSize: '14px', flex: 1, minWidth: '140px' }}
              >
                📸 Take Selfie
              </button>
              <label style={{
                ...btnSecondary,
                padding: '20px 28px', fontSize: '14px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flex: 1, minWidth: '140px',
              }}>
                📁 Upload Photo
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '4px' }}>
            <button onClick={() => { setError(''); setStep(0); }} style={btnSecondary}>← Back</button>
            <button onClick={nextFromPhoto} style={{ ...btnPrimary, flex: 1 }}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Model Release ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SectionHeading>Model Release Agreement</SectionHeading>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
            Please read the entire agreement carefully. Scroll to the bottom to agree and sign.
          </p>

          <ScrollableAgreement text={sub(MODEL_RELEASE_TEXT)} onScrolledToBottom={onReleaseScrolled} />

          {!releaseScrolled && (
            <div style={{
              textAlign: 'center', fontSize: '12px', color: T.textMuted,
              fontStyle: 'italic', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '5px',
            }}>
              <span>↓</span> Scroll to the bottom to continue
            </div>
          )}

          {releaseScrolled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                cursor: 'pointer', fontSize: '13px', color: T.text, lineHeight: 1.5,
                padding: '14px', background: '#f0fdf4', borderRadius: '10px',
                border: '1.5px solid #bbf7d0',
              }}>
                <input
                  type="checkbox"
                  checked={releaseAgreed}
                  onChange={e => setReleaseAgreed(e.target.checked)}
                  style={{ marginTop: '1px', width: '18px', height: '18px', accentColor: T.primary, flexShrink: 0 }}
                />
                <span>I have read and agree to the Model Release Agreement. I understand this is a legally binding document.</span>
              </label>

              {releaseAgreed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: T.text }}>Sign below:</div>
                  <SignaturePad
                    expectedName={form.name}
                    onSign={handleSignature}
                    t={T}
                    width={420}
                    height={140}
                  />
                </div>
              )}
            </div>
          )}

          <button onClick={() => { setError(''); setStep(1); }} style={btnSecondary}>← Back</button>
        </div>
      )}

      {/* ── Step 4: Production Conduct ── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SectionHeading>Production Conduct Guidelines</SectionHeading>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
            A few simple guidelines to help us all have a great shoot. Please scroll through and agree below.
          </p>

          <ScrollableAgreement text={sub(DOS_AND_DONTS_TEXT)} onScrolledToBottom={onConductScrolled} />

          {!conductScrolled && (
            <div style={{
              textAlign: 'center', fontSize: '12px', color: T.textMuted,
              fontStyle: 'italic', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '5px',
            }}>
              <span>↓</span> Scroll to the bottom to continue
            </div>
          )}

          {conductScrolled && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              cursor: 'pointer', fontSize: '13px', color: T.text, lineHeight: 1.5,
              padding: '14px', background: '#f0fdf4', borderRadius: '10px',
              border: '1.5px solid #bbf7d0',
            }}>
              <input
                type="checkbox"
                checked={conductAgreed}
                onChange={e => setConductAgreed(e.target.checked)}
                style={{ marginTop: '1px', width: '18px', height: '18px', accentColor: T.primary, flexShrink: 0 }}
              />
              <span>I have read and agree to follow the production conduct guidelines throughout and after the shoot.</span>
            </label>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={() => { setError(''); setStep(2); }} style={btnSecondary}>← Back</button>
            <button
              onClick={handleFinalSubmit}
              disabled={!conductAgreed || submitting}
              style={{
                ...btnPrimary, flex: 1,
                background: conductAgreed && !submitting
                  ? `linear-gradient(135deg, ${T.success}, #16a34a)`
                  : T.border,
                color: conductAgreed && !submitting ? '#fff' : T.textMuted,
                cursor: (!conductAgreed || submitting) ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, color 0.2s',
                boxShadow: conductAgreed && !submitting ? '0 4px 14px rgba(34,197,94,0.3)' : 'none',
              }}
            >
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Spinner /> Submitting…
                </span>
              ) : '✓ Submit Release'}
            </button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

// ─── Layout wrapper ────────────────────────────────────────────────────────────
function PageWrapper({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      justifyContent: 'center',
      padding: '28px 16px 48px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '540px',
        background: T.cardBg,
        borderRadius: '20px',
        border: `1px solid ${T.border}`,
        padding: '32px 28px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.07)',
        alignSelf: 'flex-start',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Logo header ───────────────────────────────────────────────────────────────
function LogoHeader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
      <AppLogo size={36} variant="full" theme="light" />
    </div>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ children, style }) {
  return (
    <h3 style={{
      fontSize: '17px', fontWeight: 700, color: T.text,
      margin: 0, letterSpacing: '-0.2px', ...style,
    }}>
      {children}
    </h3>
  );
}

// ─── Mini spinner ──────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '14px', height: '14px',
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ─── Button styles ─────────────────────────────────────────────────────────────
const btnPrimary = {
  padding: '14px 24px',
  background: `linear-gradient(135deg, #6366f1, #4f46e5)`,
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
  transition: 'opacity 0.15s',
  width: '100%',
};

const btnSecondary = {
  padding: '12px 18px',
  background: 'transparent',
  color: T.textMuted,
  border: `1.5px solid ${T.border}`,
  borderRadius: '12px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
