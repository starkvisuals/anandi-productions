// lib/attendance.js — Jibble CSV import + day classification (Phase 2, chunk 3)
//
// Pure parsing/classification helpers (testable, no I/O) + thin Firestore
// save/read. Day rules confirmed by owner:
//   - Check-in after 11:30 AM  → HALF day
//   - No punch / no hours       → ABSENT
//   - Approved leave on that day→ LEAVE (paid per leave type)
//   - Company holiday           → HOLIDAY (paid)
//   - Otherwise                 → FULL day
//   - Overtime hours (worked beyond the 9h standard day) accrue toward the
//     comp-off bank (10h banked = 1 comp-off day, redeemed via leave flow).

import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { canManageEmployees, creditCompOffHours } from './hr';

export const STANDARD_DAY_HOURS = 9;     // a full working day
export const HALF_DAY_CUTOFF_MIN = 11 * 60 + 30; // 11:30 AM in minutes

// ─── Column auto-detection ───────────────────────────────────────────────────
// Jibble exports vary; match headers fuzzily. Returns { name, date, in, out, hours }
// with the actual header strings (or null if not found).

const COLUMN_HINTS = {
  name:  ['member', 'full name', 'name', 'staff', 'employee'],
  date:  ['date', 'day'],
  in:    ['first in', 'clock in', 'clock-in', 'in time', 'in', 'start'],
  out:   ['last out', 'clock out', 'clock-out', 'out time', 'out', 'end'],
  hours: ['tracked hours', 'total hours', 'worked hours', 'duration', 'hours', 'total', 'tracked'],
};

export function detectColumns(headers = []) {
  const lower = headers.map(h => String(h || '').trim().toLowerCase());
  const find = (hints) => {
    for (const hint of hints) {
      const idx = lower.findIndex(h => h === hint);
      if (idx >= 0) return headers[idx];
    }
    for (const hint of hints) {
      const idx = lower.findIndex(h => h.includes(hint));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };
  return {
    name:  find(COLUMN_HINTS.name),
    date:  find(COLUMN_HINTS.date),
    in:    find(COLUMN_HINTS.in),
    out:   find(COLUMN_HINTS.out),
    hours: find(COLUMN_HINTS.hours),
  };
}

// ─── Value parsers ───────────────────────────────────────────────────────────

/** Parse a time string to minutes-since-midnight. Handles "9:15 AM",
 *  "09:15", "2026-05-01 18:30:00", "6:05 pm". Returns null if unparseable. */
export function parseTimeToMinutes(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || /^(--|n\/?a|absent|-)$/i.test(s)) return null;
  // Grab the last HH:MM[:SS] occurrence (handles datetimes) + optional am/pm
  const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ap = m[3] ? m[3].toLowerCase().replace(/\./g, '') : null;
  if (ap === 'pm' && hh < 12) hh += 12;
  if (ap === 'am' && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Parse worked-hours to a decimal. Handles "8.5", "8:30", "8h 30m", "08:30:00". */
export function parseHoursWorked(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s || /^(--|n\/?a|-)$/i.test(s)) return 0;
  // "8h 30m" / "8 hr 30 min"
  const hm = s.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|r)?\s*(?:(\d+)\s*m)?/i);
  if (hm) return parseFloat(hm[1]) + (hm[2] ? parseInt(hm[2], 10) / 60 : 0);
  // "8:30" or "08:30:00"
  const cm = s.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
  if (cm) return parseInt(cm[1], 10) + parseInt(cm[2], 10) / 60;
  // plain decimal
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Normalize a date cell to YYYY-MM-DD (best effort). */
export function normalizeDate(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // already ISO
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = '20' + y;
    // Assume DD/MM/YYYY (Indian convention); if a>12 it's clearly day-first
    const day = a.padStart(2, '0');
    const mon = b.padStart(2, '0');
    return `${y}-${mon}-${day}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * Classify a single employee-day.
 *   { inMinutes, hoursWorked, isHoliday, onLeave } → { status, otHours }
 * status ∈ 'full' | 'half' | 'absent' | 'holiday' | 'leave'
 */
export function classifyDay({ inMinutes, hoursWorked = 0, isHoliday = false, onLeave = false }) {
  if (onLeave) return { status: 'leave', otHours: 0 };
  if (isHoliday) return { status: 'holiday', otHours: 0 };
  const hasPunch = inMinutes != null || hoursWorked > 0;
  if (!hasPunch) return { status: 'absent', otHours: 0 };
  const otHours = Math.max(0, +(hoursWorked - STANDARD_DAY_HOURS).toFixed(2));
  if (inMinutes != null && inMinutes > HALF_DAY_CUTOFF_MIN) {
    return { status: 'half', otHours };
  }
  return { status: 'full', otHours };
}

// ─── Build monthly attendance from parsed rows ───────────────────────────────
//
//   rows      — array of CSV row objects
//   mapping   — { name, date, in, out, hours } header names
//   employees — [{ id, jibbleName, name }]
//   holidays  — Set of 'YYYY-MM-DD'
//   leaveByKey— Set of `${employeeId}|${YYYY-MM-DD}` for approved leave days
//   month     — 'YYYY-MM' to scope to (optional; rows outside are ignored)
//
// Returns { matched: { uid: summary }, unmatchedNames: [...], totalRows }

export function buildMonthlyAttendance({ rows, mapping, employees, holidays = new Set(), leaveByKey = new Set(), month = null }) {
  // Index employees by normalized jibble name
  const byName = new Map();
  employees.forEach(e => {
    const key = String(e.jibbleName || e.name || '').trim().toLowerCase();
    if (key) byName.set(key, e);
  });

  const matched = {};
  const unmatched = new Set();
  let totalRows = 0;

  for (const row of rows) {
    const rawName = String(row[mapping.name] || '').trim();
    if (!rawName) continue;
    const date = normalizeDate(row[mapping.date]);
    if (month && date.slice(0, 7) !== month) continue;
    totalRows++;

    const emp = byName.get(rawName.toLowerCase());
    if (!emp) { unmatched.add(rawName); continue; }

    const inMinutes = mapping.in ? parseTimeToMinutes(row[mapping.in]) : null;
    const hoursWorked = mapping.hours ? parseHoursWorked(row[mapping.hours]) : 0;
    const isHoliday = holidays.has(date);
    const onLeave = leaveByKey.has(`${emp.id}|${date}`);

    const { status, otHours } = classifyDay({ inMinutes, hoursWorked, isHoliday, onLeave });

    if (!matched[emp.id]) {
      matched[emp.id] = {
        employeeId: emp.id, employeeName: emp.name || rawName,
        full: 0, half: 0, absent: 0, holiday: 0, leave: 0,
        otHours: 0, totalHours: 0, days: [],
      };
    }
    const sum = matched[emp.id];
    sum[status] = (sum[status] || 0) + 1;
    sum.otHours = +(sum.otHours + otHours).toFixed(2);
    sum.totalHours = +(sum.totalHours + hoursWorked).toFixed(2);
    sum.days.push({ date, status, inMinutes, hoursWorked, otHours });
  }

  // payableDays = full + 0.5*half + holiday + leave (leave/holiday are paid)
  Object.values(matched).forEach(s => {
    s.payableDays = +(s.full + s.half * 0.5 + s.holiday + s.leave).toFixed(1);
    s.compOffDaysEarned = Math.floor(s.otHours / 10);
  });

  return { matched, unmatchedNames: Array.from(unmatched), totalRows };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/** Save a month's attendance summary. Doc id = 'YYYY-MM'. Admin only. */
export async function saveAttendance(actor, month, matched, meta = {}) {
  if (!canManageEmployees(actor)) throw new Error('HR: only admins can save attendance');
  if (!month) throw new Error('HR: month (YYYY-MM) required');
  await setDoc(doc(db, 'hr_attendance', month), {
    month,
    employees: matched,
    importedBy: actor.id,
    importedAt: serverTimestamp(),
    ...meta,
  });
  return { saved: true, month };
}

export async function getAttendance(actor, month) {
  if (!canManageEmployees(actor)) throw new Error('HR: access denied');
  const snap = await getDoc(doc(db, 'hr_attendance', month));
  return snap.exists() ? snap.data() : null;
}

/**
 * After confirming an import, credit each employee's overtime to their
 * comp-off bank. Returns a list of { employeeId, hours } credited.
 * Idempotency note: call once per import (the UI gates this behind a confirm).
 */
export async function creditCompOffFromAttendance(actor, matched) {
  if (!canManageEmployees(actor)) throw new Error('HR: only admins can credit comp-off');
  const credited = [];
  for (const sum of Object.values(matched)) {
    if (sum.otHours > 0) {
      await creditCompOffHours(actor, sum.employeeId, sum.otHours, `Overtime from attendance import`);
      credited.push({ employeeId: sum.employeeId, hours: sum.otHours });
    }
  }
  return credited;
}
