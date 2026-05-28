'use client';
/**
 * PayslipView — modal showing a branded payslip for one employee/month.
 * Print-to-PDF (opens a clean print window via Blob URL) + Email (Resend).
 *
 * Props:
 *   payslip  — structured data from lib/payslip.buildPayslip
 *   onClose  — () => void
 */

import { useState } from 'react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Standalone HTML for the print window + live preview iframe. */
function payslipHtml(p) {
  const row = (label, amount, color) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${label}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:${color || '#111'}">${inr(amount)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${p.monthLabel} — ${p.employee.name}</title>
  <style>body{font-family:-apple-system,system-ui,Arial,sans-serif;color:#111;margin:0;padding:32px;background:#fff}
  .wrap{max-width:680px;margin:0 auto;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden}
  .hd{background:#0f0f10;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start}
  .hd h1{margin:0;font-size:18px} .hd .sub{font-size:11px;color:#bbb;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;padding:18px 24px;font-size:12px;background:#fafafa;border-bottom:1px solid #eee}
  .meta b{color:#555;font-weight:600} table{width:100%;border-collapse:collapse;font-size:12px}
  .sec{padding:14px 24px} .sec h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888;margin:0 0 8px}
  .net{padding:18px 24px;background:#f0fdf4;border-top:2px solid #22c55e;display:flex;justify-content:space-between;align-items:center}
  .net .amt{font-size:22px;font-weight:800;color:#16a34a} .words{font-size:11px;color:#555;padding:0 24px 18px}
  .ft{padding:14px 24px;font-size:10px;color:#999;border-top:1px solid #eee;text-align:center}</style></head>
  <body><div class="wrap">
    <div class="hd"><div><h1>${p.company.name}</h1><div class="sub">${p.company.address || ''}</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700">PAYSLIP</div><div class="sub">${p.monthLabel}</div></div></div>
    <div class="meta">
      <div><b>Employee:</b> ${p.employee.name}</div><div><b>Employee ID:</b> ${p.employee.employeeId}</div>
      <div><b>Designation:</b> ${p.employee.designation || '—'}</div><div><b>Department:</b> ${p.employee.department || '—'}</div>
      <div><b>PAN:</b> ${p.employee.pan || '—'}</div><div><b>Bank A/C:</b> ${p.employee.bankAccount || '—'}</div>
      <div><b>Working days:</b> ${p.workingDays}</div><div><b>Payable days:</b> ${p.payableDays}${p.lopDays ? ` (LOP ${p.lopDays})` : ''}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr">
      <div class="sec"><h3>Earnings</h3><table>${p.earnings.map(e => row(e.label, e.amount)).join('')}
        <tr><td style="padding:8px 10px;font-weight:700">Gross</td><td style="padding:8px 10px;text-align:right;font-weight:700">${inr(p.grossEarnings)}</td></tr></table></div>
      <div class="sec"><h3>Deductions</h3><table>${p.deductions.length ? p.deductions.map(d => row(d.label, d.amount, '#dc2626')).join('') : '<tr><td style="padding:6px 10px;color:#999">None</td><td></td></tr>'}
        <tr><td style="padding:8px 10px;font-weight:700">Total</td><td style="padding:8px 10px;text-align:right;font-weight:700;color:#dc2626">${inr(p.totalDeductions)}</td></tr></table></div>
    </div>
    <div class="net"><div style="font-weight:700">NET PAY</div><div class="amt">${inr(p.net)}</div></div>
    <div class="words"><b>In words:</b> ${p.netInWords}</div>
    <div class="ft">This is a computer-generated payslip and does not require a signature. ${p.company.email || ''} ${p.company.phone || ''}</div>
  </div></body></html>`;
}

export default function PayslipView({ payslip, onClose }) {
  const [emailing, setEmailing] = useState(false);
  const [msg, setMsg] = useState(null);

  // Open a clean print window using a Blob URL (no document.write).
  const printIt = () => {
    const blob = new Blob([payslipHtml(payslip)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'width=760,height=900');
    if (!w) { setMsg('Pop-up blocked — allow pop-ups to print.'); URL.revokeObjectURL(url); return; }
    const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
    w.addEventListener?.('load', () => { w.focus(); w.print(); });
    cleanup();
  };

  const emailIt = async () => {
    if (!payslip.employee.email) { setMsg('No email on file for this employee.'); return; }
    setEmailing(true); setMsg(null);
    try {
      const body = `Hi ${payslip.employee.name},\n\nYour payslip for ${payslip.monthLabel} is ready.\n\n` +
        `Gross: ${inr(payslip.grossEarnings)}\nDeductions: ${inr(payslip.totalDeductions)}\nNet Pay: ${inr(payslip.net)}\n(${payslip.netInWords})\n\n` +
        `Payable days: ${payslip.payableDays} of ${payslip.workingDays}.\n\nRegards,\n${payslip.company.name}`;
      const resp = await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: payslip.employee.email, type: 'payslip', subject: `Payslip — ${payslip.monthLabel}`, body }),
      });
      const r = await resp.json().catch(() => ({}));
      if (resp.ok && r.success && !r.skipped) setMsg('Payslip emailed ✓');
      else if (r.skipped) setMsg('Email service not configured (RESEND_API_KEY). Use Print/PDF instead.');
      else setMsg(r.error || 'Email failed');
    } catch (e) {
      setMsg(e.message || 'Email failed');
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '700px', maxHeight: '92vh', background: '#fff', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <iframe title="payslip" style={{ width: '100%', height: '620px', border: 'none' }} srcDoc={payslipHtml(payslip)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderTop: '1px solid #eee', background: '#fafafa' }}>
          {msg ? <span style={{ fontSize: '11px', color: msg.includes('✓') ? '#16a34a' : '#b45309', flex: 1 }}>{msg}</span> : <span style={{ flex: 1 }} />}
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Close</button>
          <button onClick={emailIt} disabled={emailing} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #6366f1', background: '#fff', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{emailing ? 'Emailing…' : '✉ Email payslip'}</button>
          <button onClick={printIt} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>⬇ Print / Save PDF</button>
        </div>
      </div>
    </div>
  );
}
