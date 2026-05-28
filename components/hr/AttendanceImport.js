'use client';
/**
 * AttendanceImport — upload a Jibble CSV, auto-detect columns (override if
 * needed), preview the classified month, then confirm to save + credit
 * overtime to comp-off banks.
 *
 * Props: actor (admin profile), t (theme, optional)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { getEmployees, getLeaveRequests, getHrSettings } from '@/lib/hr';
import {
  detectColumns, buildMonthlyAttendance, saveAttendance, creditCompOffFromAttendance,
  HALF_DAY_CUTOFF_MIN, STANDARD_DAY_HOURS,
} from '@/lib/attendance';

const STATUS_COLOR = { full: '#22c55e', half: '#f59e0b', absent: '#ef4444', holiday: '#6366f1', leave: '#06b6d4' };
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

const sel = {
  padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none',
};

export default function AttendanceImport({ actor, t }) {
  const [employees, setEmployees] = useState([]);
  const [holidays, setHolidays] = useState(new Set());
  const [leaveByKey, setLeaveByKey] = useState(new Set());
  const [month, setMonth] = useState(thisMonthStr());

  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({ name: '', date: '', in: '', out: '', hours: '' });
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  // Load employees + approved leave + holidays
  const loadContext = useCallback(async () => {
    try {
      const [emps, leaves, settings] = await Promise.all([
        getEmployees(actor),
        getLeaveRequests(actor, null),
        getHrSettings().catch(() => null),
      ]);
      setEmployees(emps);
      // Expand approved leave into per-day keys
      const keys = new Set();
      leaves.filter(l => l.status === 'approved').forEach(l => {
        const a = new Date((l.fromDate || '') + 'T00:00:00');
        const b = new Date((l.toDate || l.fromDate || '') + 'T00:00:00');
        for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
          keys.add(`${l.employeeId}|${d.toISOString().slice(0, 10)}`);
        }
      });
      setLeaveByKey(keys);
      const hol = new Set((settings?.holidayCalendar || []).map(h => h.date).filter(Boolean));
      setHolidays(hol);
    } catch (e) {
      setError(e.message || 'Failed to load HR context');
    }
  }, [actor]);

  useEffect(() => { loadContext(); }, [loadContext]);

  const handleFile = (file) => {
    if (!file) return;
    setError(null); setSavedMsg(null);
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const hdrs = res.meta.fields || [];
        setHeaders(hdrs);
        setRows(res.data);
        setMapping(detectColumns(hdrs));
      },
      error: (err) => setError(err.message || 'CSV parse failed'),
    });
  };

  const preview = useMemo(() => {
    if (!rows.length || !mapping.name || !mapping.date) return null;
    return buildMonthlyAttendance({ rows, mapping, employees, holidays, leaveByKey, month });
  }, [rows, mapping, employees, holidays, leaveByKey, month]);

  const confirmImport = async () => {
    if (!preview) return;
    setSaving(true); setError(null);
    try {
      await saveAttendance(actor, month, preview.matched, { unmatchedNames: preview.unmatchedNames });
      const credited = await creditCompOffFromAttendance(actor, preview.matched);
      const totalOt = credited.reduce((s, c) => s + c.hours, 0);
      setSavedMsg(`Saved ${month}. Credited ${totalOt.toFixed(1)}h overtime across ${credited.length} employee(s).`);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const matchedList = preview ? Object.values(preview.matched) : [];

  return (
    <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700 }}>Import Jibble Attendance</h3>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
          Rules: check-in after 11:30 = half day · no punch = absent · approved leave & holidays = paid ·
          hours beyond {STANDARD_DAY_HOURS}h/day bank as overtime → comp-off.
        </p>
      </div>

      {/* Upload + month */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          Month<br />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...sel, marginTop: '4px' }} />
        </label>
        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          Jibble CSV<br />
          <input type="file" accept=".csv,text/csv" onChange={e => handleFile(e.target.files?.[0])} style={{ ...sel, marginTop: '4px', padding: '5px' }} />
        </label>
        {fileName && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{fileName} · {rows.length} rows</span>}
      </div>

      {/* Column mapping */}
      {headers.length > 0 && (
        <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>Column mapping (auto-detected — adjust if wrong)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
            {['name', 'date', 'in', 'out', 'hours'].map(field => (
              <label key={field} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                {field}{(field === 'name' || field === 'date') && <span style={{ color: '#ef4444' }}> *</span>}<br />
                <select value={mapping[field] || ''} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))} style={{ ...sel, marginTop: '4px', width: '100%' }}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: '12px', color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>⚠ {error}</div>}
      {savedMsg && <div style={{ fontSize: '12px', color: '#22c55e', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px' }}>✓ {savedMsg}</div>}

      {/* Preview */}
      {preview && (
        <div>
          {preview.unmatchedNames.length > 0 && (
            <div style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
              ⚠ {preview.unmatchedNames.length} name(s) in the CSV don't match any employee's Jibble name:
              <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.6)' }}>{preview.unmatchedNames.join(', ')}</div>
              <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.4)' }}>Fix each employee's "Jibble name" field so it matches exactly, then re-import.</div>
            </div>
          )}

          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Employee', 'Full', 'Half', 'Absent', 'Holiday', 'Leave', 'OT hrs', 'Payable days', 'Comp-off earned'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Employee' ? 'left' : 'center', padding: '8px 10px', fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchedList.map(s => (
                  <tr key={s.employeeId} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.employeeName}</td>
                    <td style={{ textAlign: 'center', color: STATUS_COLOR.full }}>{s.full}</td>
                    <td style={{ textAlign: 'center', color: STATUS_COLOR.half }}>{s.half}</td>
                    <td style={{ textAlign: 'center', color: STATUS_COLOR.absent }}>{s.absent}</td>
                    <td style={{ textAlign: 'center', color: STATUS_COLOR.holiday }}>{s.holiday}</td>
                    <td style={{ textAlign: 'center', color: STATUS_COLOR.leave }}>{s.leave}</td>
                    <td style={{ textAlign: 'center' }}>{s.otHours}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.payableDays}</td>
                    <td style={{ textAlign: 'center', color: '#22c55e' }}>{s.compOffDaysEarned} ({s.otHours}h)</td>
                  </tr>
                ))}
                {matchedList.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No rows matched for {month}. Check the month and column mapping.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {matchedList.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button onClick={confirmImport} disabled={saving} style={{
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: saving ? 'rgba(99,102,241,0.4)' : '#6366f1',
                color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              }}>{saving ? 'Saving…' : `Confirm & Save ${month} (credits overtime)`}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
