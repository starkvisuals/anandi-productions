'use client';
/**
 * PayrollSheet — admin runs monthly payroll. Picks a month, the engine loads
 * saved attendance + salaries, computes net pay (probation salary applied
 * automatically, LOP deducted), and shows a reviewable table. Save to finalize.
 *
 * Props: actor (admin), t (theme, optional)
 */

import { useCallback, useEffect, useState } from 'react';
import { buildPayrollSheet, savePayroll, workingDaysInMonth } from '@/lib/payroll';
import { getEmployees, getHrSettings } from '@/lib/hr';
import { buildPayslip } from '@/lib/payslip';
import PayslipView from './PayslipView';

const thisMonthStr = () => new Date().toISOString().slice(0, 7);
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function PayrollSheet({ actor, t }) {
  const [month, setMonth] = useState(thisMonthStr());
  const [excludeSundays, setExcludeSundays] = useState(true);
  const [workingDays, setWorkingDays] = useState(workingDaysInMonth(thisMonthStr()));
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);
  const [empById, setEmpById] = useState({});
  const [company, setCompany] = useState(null);
  const [payslip, setPayslip] = useState(null);

  // Load full employee objects + company details (for payslips)
  useEffect(() => {
    (async () => {
      try {
        const [emps, settings] = await Promise.all([
          getEmployees(actor),
          getHrSettings().catch(() => null),
        ]);
        setEmpById(Object.fromEntries(emps.map(e => [e.id, e])));
        setCompany(settings?.companyDetails || null);
      } catch { /* non-fatal */ }
    })();
  }, [actor]);

  const openPayslip = (row) => {
    const employee = empById[row.employeeId] || { name: row.employeeName, id: row.employeeId };
    setPayslip(buildPayslip({ row, employee, company, month }));
  };

  // Recompute default working days when month / Sunday toggle changes
  useEffect(() => {
    setWorkingDays(workingDaysInMonth(month, { excludeSundays }));
  }, [month, excludeSundays]);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setSavedMsg(null);
    try {
      const s = await buildPayrollSheet(actor, month, { workingDays });
      setSheet(s);
    } catch (e) {
      setError(e.message || 'Failed to build payroll');
    } finally {
      setLoading(false);
    }
  }, [actor, month, workingDays]);

  const finalize = async () => {
    if (!sheet) return;
    setSaving(true); setError(null);
    try {
      await savePayroll(actor, month, sheet);
      setSavedMsg(`Payroll for ${month} finalized.`);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputS = { padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' };

  return (
    <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700 }}>Monthly Payroll</h3>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
          Net = monthly salary − LOP − TDS. Probation salary auto-applies within the probation window.
          Contractors are excluded (paid by fees, not payroll days).
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Month<br />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputS, marginTop: '4px' }} />
        </label>
        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Working days (divisor)<br />
          <input type="number" value={workingDays} onChange={e => setWorkingDays(Number(e.target.value))} style={{ ...inputS, marginTop: '4px', width: '90px' }} />
        </label>
        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={excludeSundays} onChange={e => setExcludeSundays(e.target.checked)} />
          Exclude Sundays
        </label>
        <button onClick={run} disabled={loading} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Computing…' : 'Run Payroll'}
        </button>
      </div>

      {error && <div style={{ fontSize: '12px', color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>⚠ {error}</div>}
      {savedMsg && <div style={{ fontSize: '12px', color: '#22c55e', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px' }}>✓ {savedMsg}</div>}

      {sheet && (
        <div>
          {!sheet.hasAttendance && (
            <div style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
              ⚠ No attendance imported for {sheet.month} — everyone is assumed fully present (no LOP). Import via /test/attendance for accurate LOP.
            </div>
          )}
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Employee', 'Salary', 'Payable / WD', 'LOP days', 'LOP ₹', 'TDS', 'Net Pay', ''].map((h, i) => (
                    <th key={h || `c${i}`} style={{ textAlign: h === 'Employee' ? 'left' : 'center', padding: '8px 10px', fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map(r => (
                  <tr key={r.employeeId} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{r.employeeName}</div>
                      {r.isProbation && <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 600 }}>PROBATION RATE</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{inr(r.monthlyRate)}</td>
                    <td style={{ textAlign: 'center' }}>{r.payableDays} / {r.workingDays}</td>
                    <td style={{ textAlign: 'center', color: r.lopDays > 0 ? '#ef4444' : 'inherit' }}>{r.lopDays}</td>
                    <td style={{ textAlign: 'center', color: r.lopAmount > 0 ? '#ef4444' : 'inherit' }}>{r.lopAmount ? `−${inr(r.lopAmount)}` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{r.tds ? `−${inr(r.tds)}` : '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#22c55e' }}>{inr(r.net)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openPayslip(r)} style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(99,102,241,0.4)', background: 'transparent', color: '#6366f1', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Payslip</button>
                    </td>
                  </tr>
                ))}
                {sheet.rows.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No payroll employees (contractors are excluded).</td></tr>
                )}
              </tbody>
              {sheet.rows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>Totals</td>
                    <td style={{ textAlign: 'center' }}>{inr(sheet.totals.gross)}</td>
                    <td></td><td></td>
                    <td style={{ textAlign: 'center', color: '#ef4444' }}>{sheet.totals.lop ? `−${inr(sheet.totals.lop)}` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{sheet.totals.tds ? `−${inr(sheet.totals.tds)}` : '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#22c55e' }}>{inr(sheet.totals.net)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {sheet.rows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button onClick={finalize} disabled={saving} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: saving ? 'rgba(34,197,94,0.4)' : '#22c55e', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : `Finalize ${sheet.month}`}
              </button>
            </div>
          )}
        </div>
      )}

      {payslip && <PayslipView payslip={payslip} onClose={() => setPayslip(null)} />}
    </div>
  );
}
