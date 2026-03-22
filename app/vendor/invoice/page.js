'use client';
import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Logo from '@/components/Logo';

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

export default function VendorInvoice() {
  const [step, setStep] = useState('lookup'); // lookup, form, submitted
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendor, setVendor] = useState(null);
  const [projects, setProjects] = useState([]);
  const [lookupError, setLookupError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    projectId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: '',
    gstAmount: '',
    totalAmount: '',
    description: '',
    attachmentUrl: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFocus = (e) => {
    e.target.style.borderColor = 'rgba(99,102,241,0.6)';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
  };
  const handleBlur = (e) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
    e.target.style.boxShadow = 'none';
  };

  // Lookup vendor by email
  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupError('');
    setLoading(true);
    try {
      const vendorsSnap = await getDocs(collection(db, 'vendors'));
      const found = vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .find(v => v.email.toLowerCase() === vendorEmail.toLowerCase() && v.approved);

      if (!found) {
        setLookupError('No approved vendor found with this email. Please register first or contact us.');
        setLoading(false);
        return;
      }

      setVendor(found);

      // Fetch active projects
      const projectsSnap = await getDocs(collection(db, 'projects'));
      const allProjects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.status === 'active');
      setProjects(allProjects);
      setStep('form');
    } catch (err) {
      setLookupError('Something went wrong. Please try again.');
      console.error(err);
    }
    setLoading(false);
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fileRef = ref(storage, `vendor-invoices/${vendor.id}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (error) => {
        setError('File upload failed');
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setForm(prev => ({ ...prev, attachmentUrl: url }));
        setUploading(false);
      }
    );
  };

  // Calculate total
  useEffect(() => {
    const amount = parseFloat(form.amount) || 0;
    const gst = parseFloat(form.gstAmount) || 0;
    setForm(prev => ({ ...prev, totalAmount: (amount + gst).toFixed(2) }));
  }, [form.amount, form.gstAmount]);

  // Submit invoice
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.projectId || !form.invoiceNumber || !form.amount) {
      setError('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const project = projects.find(p => p.id === form.projectId);
      await addDoc(collection(db, 'invoices'), {
        vendorId: vendor.id,
        vendorName: vendor.companyName,
        vendorEmail: vendor.email,
        projectId: form.projectId,
        projectName: project?.name || '',
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        amount: parseFloat(form.amount),
        gstAmount: parseFloat(form.gstAmount) || 0,
        totalAmount: parseFloat(form.totalAmount),
        description: form.description,
        attachmentUrl: form.attachmentUrl,
        status: 'pending', // pending, approved, paid, rejected
        createdAt: serverTimestamp(),
      });
      setStep('submitted');
    } catch (err) {
      setError('Failed to submit invoice. Please try again.');
      console.error(err);
    }
    setSubmitting(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a14 0%, #12121e 50%, #0a0a14 100%)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Logo variant="full" size={36} theme="dark" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>
            Submit Invoice
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
            Submit invoices for projects you have worked on
          </p>
        </div>

        {/* Step: Lookup */}
        {step === 'lookup' && (
          <form onSubmit={handleLookup} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '40px 32px',
            textAlign: 'center',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '24px' }}>
              Enter your registered email to continue
            </p>
            {lookupError && (
              <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '12px', marginBottom: '16px' }}>
                {lookupError}
              </div>
            )}
            <input
              type="email"
              value={vendorEmail}
              onChange={e => setVendorEmail(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={{ ...INPUT_STYLE, maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}
              placeholder="your@email.com"
              required
            />
            <div style={{ marginTop: '16px' }}>
              <button type="submit" disabled={loading} style={{
                padding: '12px 40px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Looking up...' : 'Continue'}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '20px' }}>
              Not registered? <a href="/vendor/register" style={{ color: '#6366f1' }}>Register here</a>
            </p>
          </form>
        )}

        {/* Step: Invoice Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '32px',
          }}>
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', marginBottom: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              Submitting as: <strong style={{ color: '#fff' }}>{vendor.companyName}</strong> ({vendor.email})
            </div>

            {error && (
              <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '12px', marginBottom: '16px' }}>{error}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={LABEL_STYLE}>Project *</label>
                <select
                  value={form.projectId}
                  onChange={e => setForm(prev => ({ ...prev, projectId: e.target.value }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                  required
                >
                  <option value="">Select project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Invoice Number *</label>
                <input
                  value={form.invoiceNumber}
                  onChange={e => setForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={INPUT_STYLE}
                  placeholder="INV-001"
                  required
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Invoice Date</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={e => setForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Amount (before GST) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={INPUT_STYLE}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>GST Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.gstAmount}
                  onChange={e => setForm(prev => ({ ...prev, gstAmount: e.target.value }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={INPUT_STYLE}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Total Amount</label>
                <input
                  type="text"
                  value={form.totalAmount}
                  readOnly
                  style={{ ...INPUT_STYLE, background: 'rgba(255,255,255,0.02)', fontWeight: '600' }}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={INPUT_STYLE}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: '80px' }}
                rows={3}
                placeholder="Describe the work done..."
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={LABEL_STYLE}>Attach Invoice (PDF)</label>
              <div style={{
                padding: '20px',
                border: `2px dashed rgba(255,255,255,0.1)`,
                borderRadius: '10px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
                onClick={() => document.getElementById('invoice-file').click()}
              >
                <input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => handleFileUpload(e.target.files[0])}
                />
                {uploading ? (
                  <div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#6366f1', borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>Uploading... {uploadProgress}%</div>
                  </div>
                ) : form.attachmentUrl ? (
                  <div style={{ fontSize: '12px', color: '#22c55e' }}>File uploaded. Click to replace.</div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Click to upload invoice PDF</div>
                )}
              </div>
            </div>

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
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Invoice'}
            </button>
          </form>
        )}

        {/* Step: Submitted */}
        {step === 'submitted' && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '60px 32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
            <h2 style={{ color: '#fff', fontSize: '22px', marginBottom: '8px' }}>Invoice Submitted</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px' }}>
              Your invoice has been submitted for review.
              You will be notified once it is approved.
            </p>
            <button
              onClick={() => { setStep('form'); setForm(prev => ({ ...prev, invoiceNumber: '', amount: '', gstAmount: '', totalAmount: '', description: '', attachmentUrl: '', dueDate: '' })); }}
              style={{
                padding: '12px 32px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Submit Another Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
