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
 *  {{annualCtc}}, {{monthlyCtc}}, {{probationMonths}}, {{probationMonthlySalary}},
 *  {{compensationClause}}, {{employmentType}}, {{noticePeriodMonths}},
 *  {{companyLegalName}}, {{companyAddress}}, {{companyEmail}}, {{companyPhone}},
 *  {{companyOwner}}, {{effectiveDate}}
 */
export function buildTemplateData(userProfile, hrSettings) {
  const annual = Number(userProfile?.ctc?.annual) || 0;
  const fmt = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // Probation: { months, monthlySalary }. Post-probation monthly = annual/12.
  const probMonths = Number(userProfile?.probation?.months) || 0;
  const probSalary = Number(userProfile?.probation?.monthlySalary) || 0;
  const postProbMonthly = annual ? annual / 12 : 0;

  // A single ready-to-drop compensation sentence that adapts to whether a
  // probation salary exists. Templates can use {{compensationClause}} and not
  // worry about the conditional logic.
  let compensationClause;
  if (probMonths > 0 && probSalary > 0) {
    compensationClause = `${fmt(probSalary)} per month during the probation period of ${probMonths} month(s), and ${postProbMonthly ? fmt(postProbMonthly) : '—'} per month thereafter`;
  } else if (postProbMonthly) {
    compensationClause = `${fmt(postProbMonthly)} per month`;
  } else {
    compensationClause = '—';
  }

  return {
    employeeName: userProfile?.name || '',
    email: userProfile?.email || '',
    jobTitle: userProfile?.designation || '',
    department: userProfile?.department || '',
    startDate: userProfile?.dateOfJoining || '',
    annualCtc: annual ? fmt(annual) : '',
    monthlyCtc: annual ? fmt(annual / 12) : '',
    probationMonths: probMonths ? String(probMonths) : '',
    probationMonthlySalary: probSalary ? fmt(probSalary) : '',
    compensationClause,
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
