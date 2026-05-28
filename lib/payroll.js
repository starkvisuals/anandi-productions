// lib/payroll.js — monthly payroll computation (Phase 2, chunk 4)
//
// Combines attendance (chunk 3) + salary + probation + LOP into net pay.
// No PF/ESI (sole-prop below thresholds). Only deductions are LOP and an
// optional admin-set monthly TDS.
//
// Working-days divisor defaults to calendar days minus Sundays, but is passed
// in (editable in the UI) so a fixed 26 or scheduled-days basis also works.

import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { canManageEmployees, getEmployees } from './hr';
import { getAttendance } from './attendance';

/** Calendar days in a 'YYYY-MM', optionally excluding Sundays. */
export function workingDaysInMonth(month, { excludeSundays = true } = {}) {
  if (!month) return 0;
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate(); // last day of month
  if (!excludeSundays) return days;
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(y, m - 1, d).getDay() !== 0) count++; // 0 = Sunday
  }
  return count;
}

/** Date (YYYY-MM-DD) when probation ends = DOJ + probation.months. */
export function probationEndDate(employee) {
  const doj = employee?.dateOfJoining;
  const months = Number(employee?.probation?.months) || 0;
  if (!doj || months <= 0) return null;
  const d = new Date(doj + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Is the given payroll month within the employee's probation window? */
export function isProbationMonth(employee, month) {
  const end = probationEndDate(employee);
  if (!end) return false;
  // Month is "in probation" if its first day is before probation end.
  const monthStart = `${month}-01`;
  return monthStart < end;
}

/** The applicable monthly salary for a payroll month. */
export function monthlyRateFor(employee, month) {
  const annual = Number(employee?.ctc?.annual) || 0;
  const fullMonthly = annual ? annual / 12 : 0;
  if (isProbationMonth(employee, month) && employee?.probation?.monthlySalary) {
    return { rate: Number(employee.probation.monthlySalary), isProbation: true, fullMonthly };
  }
  return { rate: fullMonthly, isProbation: false, fullMonthly };
}

/**
 * Compute one employee's payroll for a month.
 *   employee, summary (attendance summary or null), month, workingDays, tdsOverride?
 */
export function computeEmployeePayroll({ employee, summary, month, workingDays, tdsOverride }) {
  const { rate, isProbation, fullMonthly } = monthlyRateFor(employee, month);
  const wd = workingDays || workingDaysInMonth(month);
  const perDay = wd > 0 ? rate / wd : 0;

  // payableDays from attendance (full + 0.5 half + holiday + leave). If no
  // attendance imported, assume full month (no deduction) so payroll still runs.
  const payableRaw = summary ? Number(summary.payableDays) || 0 : wd;
  const payableDays = Math.min(payableRaw, wd);
  const lopDays = +(wd - payableDays).toFixed(1);
  const lopAmount = Math.round(perDay * lopDays);

  const tds = tdsOverride != null ? Number(tdsOverride) : (Number(employee?.tdsMonthly) || 0);
  const gross = Math.round(rate);
  const net = Math.max(0, gross - lopAmount - tds);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    isProbation,
    monthlyRate: gross,
    fullMonthly: Math.round(fullMonthly),
    workingDays: wd,
    payableDays,
    lopDays,
    perDay: Math.round(perDay),
    lopAmount,
    tds,
    net,
    otHours: summary ? Number(summary.otHours) || 0 : 0,
    hasAttendance: !!summary,
  };
}

/**
 * Build the full payroll sheet for a month: loads employees + saved attendance,
 * computes each. Returns { month, workingDays, rows, totals }.
 */
export async function buildPayrollSheet(actor, month, { workingDays, excludeSundays = true } = {}) {
  if (!canManageEmployees(actor)) throw new Error('HR: only admins can run payroll');
  const wd = workingDays || workingDaysInMonth(month, { excludeSundays });
  const [employees, attendance] = await Promise.all([
    getEmployees(actor),
    getAttendance(actor, month).catch(() => null),
  ]);
  const summaries = attendance?.employees || {};
  const rows = employees
    .filter(e => e.workerClass !== 'contractor') // contractors are fees, not payroll-day-based
    .map(e => computeEmployeePayroll({ employee: e, summary: summaries[e.id] || null, month, workingDays: wd }));
  const totals = rows.reduce((acc, r) => ({
    gross: acc.gross + r.monthlyRate,
    lop: acc.lop + r.lopAmount,
    tds: acc.tds + r.tds,
    net: acc.net + r.net,
  }), { gross: 0, lop: 0, tds: 0, net: 0 });
  return { month, workingDays: wd, rows, totals, hasAttendance: !!attendance };
}

/** Persist a reviewed payroll sheet. Doc id = 'YYYY-MM'. */
export async function savePayroll(actor, month, sheet) {
  if (!canManageEmployees(actor)) throw new Error('HR: only admins can save payroll');
  await setDoc(doc(db, 'hr_payroll', month), {
    month,
    workingDays: sheet.workingDays,
    rows: sheet.rows,
    totals: sheet.totals,
    finalizedBy: actor.id,
    finalizedAt: serverTimestamp(),
  });
  return { saved: true, month };
}

export async function getPayroll(actor, month) {
  if (!canManageEmployees(actor)) throw new Error('HR: access denied');
  const snap = await getDoc(doc(db, 'hr_payroll', month));
  return snap.exists() ? snap.data() : null;
}
