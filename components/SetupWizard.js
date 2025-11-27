'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function SetupWizard() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      <div className="w-full max-w-lg bg-card rounded-xl border border-border p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl font-extrabold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            ANANDI
          </div>
          <div className="text-xs text-gray-500 mt-1">Productions</div>
          <h2 className="text-xl font-semibold mt-6">Welcome! Let's set up your account</h2>
          <p className="text-gray-400 text-sm mt-2">This is a one-time setup to create your admin account</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= s ? 'bg-primary text-white' : 'bg-border text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-1 mx-2 rounded ${step > s ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {step === 1 && (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">👑</div>
                <h3 className="font-semibold">Admin Details</h3>
                <p className="text-sm text-gray-400">Enter your basic information</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full Name *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-3 bg-background border border-border rounded-lg text-white"
                  placeholder="Harnesh Joshi"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email *</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-3 bg-background border border-border rounded-lg text-white"
                  placeholder="harnesh@anandi.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone (Optional)</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-3 bg-background border border-border rounded-lg text-white"
                  placeholder="+91 98765 43210"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">🔐</div>
                <h3 className="font-semibold">Create Password</h3>
                <p className="text-sm text-gray-400">Choose a secure password</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Password *</label>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full p-3 bg-background border border-border rounded-lg text-white"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Confirm Password *</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full p-3 bg-background border border-border rounded-lg text-white"
                  placeholder="Re-enter password"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">🏢</div>
                <h3 className="font-semibold">Company Setup</h3>
                <p className="text-sm text-gray-400">Configure your production house</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Company Name</label>
                <input
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full p-3 bg-background border border-border rounded-lg text-white"
                  placeholder="Anandi Productions"
                />
              </div>
              
              <div className="bg-background rounded-lg p-4 border border-border mt-4">
                <h4 className="font-semibold text-sm mb-3">Review Your Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span>{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span>{formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span>{formData.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Role:</span>
                    <span className="text-primary">👑 Producer (Admin)</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 p-3 bg-border rounded-lg text-white font-semibold hover:bg-gray-700"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="flex-1 p-3 bg-primary rounded-lg text-white font-semibold"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 p-3 bg-green-500 rounded-lg text-white font-semibold disabled:opacity-50"
              >
                {loading ? '⏳ Setting up...' : '🚀 Complete Setup'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          You can add team members and clients after setup
        </p>
      </div>
    </div>
  );
}
