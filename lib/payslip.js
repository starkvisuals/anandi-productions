// lib/payslip.js — payslip data + Indian rupee-to-words (Phase 2, chunk 5)
//
// Pure helpers. The payslip itself is rendered as branded HTML in
// components/hr/PayslipView.js (print-to-PDF + email), so no PDF dependency.

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

/** Indian-system rupees in words: "Rupees One Lakh Twenty Thousand Only". */
export function rupeesInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;
  const parts = [];
  if (crore) parts.push(twoDigits(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (hundred) parts.push(ONES[hundred] + ' Hundred');
  if (n) parts.push((parts.length ? 'and ' : '') + twoDigits(n));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(month) {
  if (!month) return '';
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Build structured payslip data from a finalized payroll row + employee +
 * company details. Earnings/deductions are simple at this size (no PF/ESI).
 */
export function buildPayslip({ row, employee, company, month }) {
  const earnings = [
    { label: row.isProbation ? 'Salary (probation rate)' : 'Monthly Salary', amount: row.monthlyRate },
  ];
  const deductions = [];
  if (row.lopAmount > 0) deductions.push({ label: `Loss of Pay (${row.lopDays} day${row.lopDays === 1 ? '' : 's'})`, amount: row.lopAmount });
  if (row.tds > 0) deductions.push({ label: 'TDS', amount: row.tds });

  const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const net = Math.max(0, grossEarnings - totalDeductions);

  return {
    company: {
      name: company?.legalName || 'Anandi Productions',
      address: company?.address || '',
      email: company?.adminEmail || company?.email || '',
      phone: company?.phone || '',
    },
    employee: {
      name: employee?.name || row.employeeName,
      employeeId: employee?.employeeId || '—',
      designation: employee?.designation || '',
      department: employee?.department || '',
      email: employee?.email || '',
      pan: employee?.panNumber || '',
      bankAccount: employee?.bankAccount?.accountNumber || '',
      bankName: employee?.bankAccount?.bankName || '',
    },
    month,
    monthLabel: monthLabel(month),
    workingDays: row.workingDays,
    payableDays: row.payableDays,
    lopDays: row.lopDays,
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    net,
    netInWords: rupeesInWords(net),
  };
}
