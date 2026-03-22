'use client';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Logo from '@/components/Logo';

const VENDOR_CATEGORIES = [
  'Photographer',
  'Videographer',
  'Editor',
  'Colorist',
  'Sound Designer',
  'Motion Graphics',
  'VFX Artist',
  'Makeup Artist',
  'Stylist',
  'Set Designer',
  'Lighting',
  'Equipment Rental',
  'Location',
  'Catering',
  'Transport',
  'Post Production',
  'Printing',
  'Other'
];

const INPUT_STYLE = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '500',
  color: 'rgba(255,255,255,0.6)',
  marginBottom: '6px',
};

export default function VendorRegister() {
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    category: '',
    gstNumber: '',
    panNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    address: '',
    city: '',
    state: '',
    website: '',
    portfolio: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = 'rgba(99,102,241,0.6)';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
  };

  const handleBlur = (e) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
    e.target.style.boxShadow = 'none';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.companyName || !form.contactPerson || !form.email || !form.phone || !form.category) {
      setError('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'vendors'), {
        ...form,
        status: 'pending',
        createdAt: serverTimestamp(),
        approved: false,
      });
      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit. Please try again.');
      console.error(err);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a14 0%, #12121e 50%, #0a0a14 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          padding: '60px 40px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
        }}>
          <div style={{ marginBottom: '24px' }}>
            <Logo variant="full" size={40} theme="dark" />
          </div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
          <h2 style={{ color: '#fff', fontSize: '22px', marginBottom: '8px' }}>Registration Submitted</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: '1.6' }}>
            Thank you for registering as a vendor with Anandi Productions.
            Our team will review your details and get back to you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a14 0%, #12121e 50%, #0a0a14 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Logo variant="full" size={36} theme="dark" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>
            Vendor Registration
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
            Register as a vendor to work with Anandi Productions
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '32px',
        }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '20px',
            }}>{error}</div>
          )}

          {/* Company Details */}
          <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            Company Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={LABEL_STYLE}>Company / Business Name *</label>
              <input
                value={form.companyName}
                onChange={e => handleChange('companyName', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                required
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Contact Person *</label>
              <input
                value={form.contactPerson}
                onChange={e => handleChange('contactPerson', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                required
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                required
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Phone *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                required
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Category *</label>
              <select
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                required
              >
                <option value="">Select category</option>
                {VENDOR_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Website / Portfolio</label>
              <input
                value={form.website}
                onChange={e => handleChange('website', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                placeholder="https://"
              />
            </div>
          </div>

          {/* Tax & Bank Details */}
          <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            Tax & Banking Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={LABEL_STYLE}>GST Number</label>
              <input
                value={form.gstNumber}
                onChange={e => handleChange('gstNumber', e.target.value.toUpperCase())}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>PAN Number</label>
              <input
                value={form.panNumber}
                onChange={e => handleChange('panNumber', e.target.value.toUpperCase())}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
                placeholder="ABCDE1234F"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Bank Name</label>
              <input
                value={form.bankName}
                onChange={e => handleChange('bankName', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Account Number</label>
              <input
                value={form.accountNumber}
                onChange={e => handleChange('accountNumber', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL_STYLE}>IFSC Code</label>
              <input
                value={form.ifscCode}
                onChange={e => handleChange('ifscCode', e.target.value.toUpperCase())}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={{ ...INPUT_STYLE, maxWidth: '300px' }}
              />
            </div>
          </div>

          {/* Address */}
          <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            Address
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL_STYLE}>Address</label>
              <textarea
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: '60px' }}
                rows={2}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>City</label>
              <input
                value={form.city}
                onChange={e => handleChange('city', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>State</label>
              <input
                value={form.state}
                onChange={e => handleChange('state', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '24px' }}>
            <label style={LABEL_STYLE}>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: '80px' }}
              rows={3}
              placeholder="Tell us about your services, experience, or any other relevant details..."
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              background: submitting ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>
            Your details will be reviewed by our team before approval.
          </p>
        </form>
      </div>
    </div>
  );
}
