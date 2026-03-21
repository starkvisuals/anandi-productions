'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Logo from './Logo';

// SVG Step Icons
const UserIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 10-16 0" />
  </svg>
);

const ShieldIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <rect x="9" y="11" width="6" height="5" rx="1" />
    <path d="M10 11V9a2 2 0 014 0v2" />
  </svg>
);

const BuildingIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22V18h6v4" />
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// Review field icons
const ReviewUserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 10-16 0" />
  </svg>
);
const ReviewEmailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 4L12 13L2 4" />
  </svg>
);
const ReviewPhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
);
const ReviewRoleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function SetupWizard() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slideDir, setSlideDir] = useState('right');
  const [animKey, setAnimKey] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    company: 'Anandi Productions',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setSlideDir('right');
      setAnimKey(k => k + 1);
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setSlideDir('right');
      setAnimKey(k => k + 1);
      setStep(3);
    }
  };

  const handleBack = () => {
    setSlideDir('left');
    setAnimKey(k => k + 1);
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      await completeSetup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        company: formData.company,
      });
    } catch (err) {
      console.error('Setup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else {
        setError(err.message || 'Setup failed. Please try again.');
      }
    }

    setLoading(false);
  };

  const stepIcons = [UserIcon, ShieldIcon, BuildingIcon];
  const stepLabels = ['Details', 'Security', 'Company'];

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    boxSizing: 'border-box',
  };

  const inputFocusGlow = {
    borderColor: 'rgba(99,102,241,0.6)',
    boxShadow: '0 0 0 3px rgba(99,102,241,0.15)',
  };

  const slideAnimation = slideDir === 'right' ? 'slideInRight' : 'slideInLeft';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 40% 40%, rgba(99,102,241,0.06) 0%, transparent 70%), radial-gradient(ellipse at 60% 70%, rgba(168,85,247,0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Film grain overlay (subtle) */}
      <div style={{
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        opacity: 0.02,
        pointerEvents: 'none',
        animation: 'grain 8s steps(10) infinite',
      }} />

      {/* Card */}
      <div className="glass animate-scaleIn" style={{
        width: '100%',
        maxWidth: '480px',
        borderRadius: '16px',
        padding: '40px 36px',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '32px',
        }}>
          <div style={{ animation: 'fadeIn 0.6s ease forwards' }}>
            <Logo variant="full" size={50} animated={true} />
          </div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#fff',
            margin: '24px 0 6px 0',
            animation: 'fadeInUp 0.5s ease 0.1s both',
          }}>
            Welcome! Let&apos;s set up your account
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.4)',
            margin: 0,
            animation: 'fadeInUp 0.5s ease 0.2s both',
          }}>
            This is a one-time setup to create your admin account
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          marginBottom: '32px',
          animation: 'fadeInUp 0.5s ease 0.3s both',
        }}>
          {[1, 2, 3].map((s) => {
            const Icon = stepIcons[s - 1];
            const isCompleted = step > s;
            const isActive = step >= s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive
                      ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                      : 'rgba(255,255,255,0.06)',
                    border: isActive
                      ? 'none'
                      : '1px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.4s ease',
                    boxShadow: isActive ? '0 0 16px rgba(99,102,241,0.3)' : 'none',
                  }}>
                    {isCompleted ? <CheckIcon /> : <Icon active={isActive} />}
                  </div>
                  <span style={{
                    fontSize: '10px',
                    color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'color 0.3s ease',
                  }}>
                    {stepLabels[s - 1]}
                  </span>
                </div>
                {s < 3 && (
                  <div style={{
                    width: '48px',
                    height: '2px',
                    margin: '0 8px',
                    marginBottom: '20px',
                    borderRadius: '1px',
                    background: 'rgba(255,255,255,0.08)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: step > s ? '100%' : '0%',
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                      borderRadius: '1px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div key={animKey} className={slideDir === 'right' ? 'animate-slideInRight' : 'animate-slideInLeft'}>
          <div style={{ minHeight: '240px' }}>
            {step === 1 && (
              <div className="stagger-children">
                <div style={{ textAlign: 'center', marginBottom: '24px', animation: 'fadeInUp 0.4s ease both' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>Admin Details</h3>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Enter your basic information</p>
                </div>
                <div style={{ marginBottom: '14px', animation: 'fadeInUp 0.4s ease both' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: 500 }}>Full Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="Harnesh Joshi"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusGlow)}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ marginBottom: '14px', animation: 'fadeInUp 0.4s ease both' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: 500 }}>Email *</label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="harnesh@anandi.com"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusGlow)}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ marginBottom: '14px', animation: 'fadeInUp 0.4s ease both' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: 500 }}>Phone (Optional)</label>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="+91 98765 43210"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusGlow)}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="stagger-children">
                <div style={{ textAlign: 'center', marginBottom: '24px', animation: 'fadeInUp 0.4s ease both' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>Create Password</h3>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Choose a secure password</p>
                </div>
                <div style={{ marginBottom: '14px', animation: 'fadeInUp 0.4s ease both' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: 500 }}>Password *</label>
                  <input
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="At least 6 characters"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusGlow)}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ marginBottom: '14px', animation: 'fadeInUp 0.4s ease both' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: 500 }}>Confirm Password *</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="Re-enter password"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusGlow)}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="stagger-children">
                <div style={{ textAlign: 'center', marginBottom: '24px', animation: 'fadeInUp 0.4s ease both' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>Company Setup</h3>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Configure your production house</p>
                </div>
                <div style={{ marginBottom: '16px', animation: 'fadeInUp 0.4s ease both' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: 500 }}>Company Name</label>
                  <input
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="Anandi Productions"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusGlow)}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Review section */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginTop: '8px',
                  animation: 'fadeInUp 0.4s ease 0.1s both',
                }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 14px 0' }}>Review Your Details</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { icon: <ReviewUserIcon />, label: 'Name', value: formData.name },
                      { icon: <ReviewEmailIcon />, label: 'Email', value: formData.email },
                      { icon: <ReviewPhoneIcon />, label: 'Phone', value: formData.phone || 'Not provided' },
                      { icon: <ReviewRoleIcon />, label: 'Role', value: 'Producer (Admin)', highlight: true },
                    ].map((item, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.45)' }}>
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        <span style={{
                          color: item.highlight ? '#a855f7' : 'rgba(255,255,255,0.8)',
                          fontWeight: item.highlight ? 500 : 400,
                        }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px',
            marginBottom: '8px',
            animation: 'scaleIn 0.3s ease forwards',
          }}>
            <ErrorIcon />
            <span style={{ color: '#f87171', fontSize: '13px' }}>{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                flex: 1,
                padding: '13px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.25)';
                e.target.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                e.target.style.color = 'rgba(255,255,255,0.7)';
              }}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              style={{
                flex: 1,
                padding: '13px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 0 24px rgba(99,102,241,0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = 'none';
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 1,
                padding: '13px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'scale(1.02)';
                  e.target.style.boxShadow = '0 0 24px rgba(99,102,241,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = 'none';
              }}
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          )}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.25)',
          marginTop: '24px',
          animation: 'fadeIn 1s ease forwards',
        }}>
          You can add team members and clients after setup
        </p>
      </div>
    </div>
  );
}
