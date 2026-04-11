// lib/hrRender.js — template rendering engine for HR legal documents.
//
// Contract: substitutes {{key}} placeholders with values from a data object.
// Missing or null values render as empty strings (never undefined, never the
// literal {{key}}). Only 15 placeholders are supported — see buildTemplateData
// for the full list.

/**
 * Replace {{key}} placeholders in `text` with values from `data`.
 * Unknown keys render as empty strings — a missing placeholder should never
 * leak into a signed legal document.
 */
export function renderTemplate(text, data) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data?.[key];
    return v == null || v === '' ? '' : String(v);
  });
}

/**
 * Build the full placeholder data object from a user profile + HR settings.
 * This is the SINGLE source of truth for which placeholders are valid. Any
 * placeholder used in a template that's not returned here will render empty.
 *
 * Supported placeholders:
 *  {{employeeName}}, {{email}}, {{jobTitle}}, {{department}}, {{startDate}},
 *  {{annualCtc}}, {{monthlyCtc}}, {{employmentType}}, {{noticePeriodMonths}},
 *  {{companyLegalName}}, {{companyAddress}}, {{companyEmail}}, {{companyPhone}},
 *  {{companyOwner}}, {{effectiveDate}}
 */
export function buildTemplateData(userProfile, hrSettings) {
  const annual = Number(userProfile?.ctc?.annual) || 0;
  const fmt = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  return {
    employeeName: userProfile?.name || '',
    email: userProfile?.email || '',
    jobTitle: userProfile?.designation || '',
    department: userProfile?.department || '',
    startDate: userProfile?.dateOfJoining || '',
    annualCtc: annual ? fmt(annual) : '',
    monthlyCtc: annual ? fmt(annual / 12) : '',
    employmentType: userProfile?.workerClass === 'contractor' ? 'Independent Contractor' : 'Full-time Employee',
    noticePeriodMonths: String(hrSettings?.noticePeriodMonths ?? 2),
    companyLegalName: hrSettings?.companyDetails?.legalName || 'Anandi Productions',
    companyAddress: hrSettings?.companyDetails?.address || '',
    companyEmail: hrSettings?.companyDetails?.adminEmail || '',
    companyPhone: hrSettings?.companyDetails?.phone || '',
    companyOwner: hrSettings?.companyDetails?.ownerName || 'Harnesh Joshi',
    effectiveDate: new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    }),
  };
}
