'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getEmployees,
  seedHrSettingsIfMissing,
  listPendingApprovals,
  canAccessHr,
  canManageEmployees,
  isHrFullAdmin,
  EMPLOYMENT_TYPES,
  DEPARTMENTS,
} from '@/lib/hr';
import AddEmployeeModal from './AddEmployeeModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import PendingApprovalsPanel from './PendingApprovalsPanel';
import HrSettingsView from './HrSettingsView';
import ImportExistingUserModal from './ImportExistingUserModal';
import LeaveManagementPanel from './LeaveManagementPanel';
import AttendanceImport from './AttendanceImport';
import PayrollSheet from './PayrollSheet';

/**
 * HR admin top-level view. Rendered when view === 'employees' AND canManageEmployees(user).
 *
 * Props:
 *  - t : theme tokens
 */
export default function EmployeeModule({ t }) {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployment, setFilterEmployment] = useState('active'); // active | former | all
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailUid, setDetailUid] = useState(null);
  const [tab, setTab] = useState('list'); // list | approvals | settings
  const [pendingCount, setPendingCount] = useState(0);

  const isFullAdmin = isHrFullAdmin(userProfile);

  const loadEmployees = async () => {
    if (!canManageEmployees(userProfile)) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list = await getEmployees(userProfile);
      setEmployees(list);
    } catch (err) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadPending = async () => {
    if (!isFullAdmin) return;
    try {
      const list = await listPendingApprovals(userProfile);
      setPendingCount(list.length);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!userProfile) return;
    // Seed HR settings on first admin visit (producer only; sub-admins will see existing or default)
    if (isFullAdmin) {
      seedHrSettingsIfMissing(userProfile).catch(() => {});
    }
    loadEmployees();
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter(e => {
        const left = e.employmentStatus === 'terminated' || e.employmentStatus === 'resigned';
        // Active by default; 'former' shows only those who left; 'all' shows both
        if (filterEmployment === 'active' && left) return false;
        if (filterEmployment === 'former' && !left) return false;
        if (filterDept !== 'all' && e.department !== filterDept) return false;
        if (filterStatus !== 'all' && (e.onboardingStatus || 'pending') !== filterStatus) return false;
        if (q) {
          const hay = `${e.name || ''} ${e.email || ''} ${e.employeeId || ''} ${e.designation || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Primary producer first
        if (a.isPrimaryProducer && !b.isPrimaryProducer) return -1;
        if (!a.isPrimaryProducer && b.isPrimaryProducer) return 1;
        return (a.employeeId || '').localeCompare(b.employeeId || '');
      });
  }, [employees, search, filterDept, filterStatus, filterEmployment]);

  // Defense in depth: even though MainApp guards the view, check here too.
  // Placed after all hooks to keep hook order stable.
  if (!canAccessHr(userProfile) || !canManageEmployees(userProfile)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
        You do not have access to the HR module.
      </div>
    );
  }

  const statusBadge = (status) => {
    const map = {
      pending:     { label: 'Pending',     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
      'in-progress': { label: 'In progress', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
      completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    };
    const s = map[status || 'pending'];
    return (
      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, color: s.color, background: s.bg, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {s.label}
      </span>
    );
  };

  const typeBadge = (type) => {
    const meta = EMPLOYMENT_TYPES[type || 'full-time'];
    if (!meta) return null;
    return (
      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, color: meta.color, background: `${meta.color}22`, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {meta.label}
      </span>
    );
  };

  const inr = (n) => {
    if (!n && n !== 0) return '—';
    return `₹${Number(n).toLocaleString('en-IN')}`;
  };

  const TabButton = ({ id, label, badge }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '10px 18px',
        background: tab === id ? t.bgCard : 'transparent',
        color: tab === id ? t.text : t.textMuted,
        border: tab === id ? `1px solid ${t.border}` : '1px solid transparent',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {label}
      {typeof badge === 'number' && badge > 0 && (
        <span style={{ background: t.danger, color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', minWidth: '18px', textAlign: 'center' }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: '12px' }}>
            Employees
            {userProfile?.isPrimaryProducer && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: t.gradientPrimary, color: '#fff', letterSpacing: '0.4px' }}>
                PRIMARY ADMIN
              </span>
            )}
          </h1>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>
            {employees.length} {employees.length === 1 ? 'employee' : 'employees'} · Internal Anandi Productions team
          </div>
        </div>
        {tab === 'list' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowImport(true)}
              title="Convert an existing user (core team, freelancer) into an employee"
              style={{
                padding: '11px 16px',
                background: 'transparent',
                color: t.text,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↻ Import Existing User
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                padding: '11px 20px',
                background: t.gradientPrimary,
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              }}
            >
              + Add Employee
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <TabButton id="list" label="Employees" />
        <TabButton id="leave" label="Leave" />
        <TabButton id="attendance" label="Attendance" />
        <TabButton id="payroll" label="Payroll" />
        {isFullAdmin && <TabButton id="approvals" label="Pending Approvals" badge={pendingCount} />}
        {isFullAdmin && <TabButton id="settings" label="HR Settings" />}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: t.danger, fontSize: '12px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {tab === 'list' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, ID, designation..."
              style={{
                flex: '1 1 280px',
                padding: '10px 14px',
                background: t.bgInput,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                color: t.text,
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{
                padding: '10px 14px',
                background: t.bgInput,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                color: t.text,
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '10px 14px',
                background: t.bgInput,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                color: t.text,
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={filterEmployment}
              onChange={(e) => setFilterEmployment(e.target.value)}
              style={{
                padding: '10px 14px',
                background: t.bgInput,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                color: t.text,
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="active">Active only</option>
              <option value="former">Former (left)</option>
              <option value="all">All (incl. former)</option>
            </select>
          </div>

          {/* Employee table */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: t.cardRadius || '16px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>
                Loading employees...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>
                {employees.length === 0 ? 'No employees yet. Click "+ Add Employee" to get started.' : 'No employees match your filters.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: t.bgInput, borderBottom: `1px solid ${t.border}` }}>
                      <Th t={t}>Employee</Th>
                      <Th t={t}>ID</Th>
                      <Th t={t}>Designation</Th>
                      <Th t={t}>Department</Th>
                      <Th t={t}>Type</Th>
                      <Th t={t}>Onboarding</Th>
                      <Th t={t} align="right">Annual CTC</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr
                        key={e.id}
                        onClick={() => setDetailUid(e.id)}
                        style={{
                          borderBottom: `1px solid ${t.borderLight || t.border}`,
                          cursor: 'pointer',
                          transition: 'background 0.12s',
                          background: e.isPrimaryProducer ? 'rgba(99,102,241,0.05)' : 'transparent',
                        }}
                        onMouseEnter={(ev) => (ev.currentTarget.style.background = t.bgHover)}
                        onMouseLeave={(ev) => (ev.currentTarget.style.background = e.isPrimaryProducer ? 'rgba(99,102,241,0.05)' : 'transparent')}
                      >
                        <Td t={t}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '50%',
                              background: e.documents?.profilePhoto?.url ? `url(${e.documents.profilePhoto.url}) center/cover` : t.gradientPrimary,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 700, fontSize: '13px',
                              flexShrink: 0,
                            }}>
                              {!e.documents?.profilePhoto?.url && (e.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: t.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {e.name || '—'}
                                {e.isPrimaryProducer && <span title="Primary Admin — permanent" style={{ fontSize: '11px' }}>👑</span>}
                                {(e.employmentStatus === 'terminated' || e.employmentStatus === 'resigned') && (
                                  <span title={e.lastWorkingDay ? `Last day: ${e.lastWorkingDay}` : ''} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {e.employmentStatus === 'resigned' ? 'Resigned' : 'Terminated'}
                                  </span>
                                )}
                              </div>
                              <div style={{ color: t.textMuted, fontSize: '11px' }}>{e.email}</div>
                            </div>
                          </div>
                        </Td>
                        <Td t={t}><span style={{ fontFamily: 'ui-monospace, monospace', color: t.textMuted }}>{e.employeeId || '—'}</span></Td>
                        <Td t={t}>{e.designation || '—'}</Td>
                        <Td t={t}>{e.department || '—'}</Td>
                        <Td t={t}>{typeBadge(e.employmentType)}</Td>
                        <Td t={t}>{statusBadge(e.onboardingStatus)}</Td>
                        <Td t={t} align="right"><span style={{ color: t.text, fontWeight: 600 }}>{inr(e.ctc?.annual)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'leave' && (
        <LeaveManagementPanel actor={userProfile} t={t} />
      )}

      {tab === 'attendance' && (
        <AttendanceImport actor={userProfile} t={t} />
      )}

      {tab === 'payroll' && (
        <PayrollSheet actor={userProfile} t={t} />
      )}

      {tab === 'approvals' && isFullAdmin && (
        <PendingApprovalsPanel t={t} onChange={() => { loadPending(); loadEmployees(); }} />
      )}

      {tab === 'settings' && isFullAdmin && (
        <HrSettingsView t={t} />
      )}

      {showAdd && (
        <AddEmployeeModal
          t={t}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadEmployees(); }}
        />
      )}

      {showImport && (
        <ImportExistingUserModal
          onClose={() => setShowImport(false)}
          onCreated={() => { setShowImport(false); loadEmployees(); }}
        />
      )}

      {detailUid && (
        <EmployeeDetailModal
          t={t}
          uid={detailUid}
          onClose={() => setDetailUid(null)}
          onChange={() => { loadEmployees(); loadPending(); }}
        />
      )}
    </div>
  );
}

const Th = ({ children, align, t }) => (
  <th style={{
    textAlign: align || 'left',
    padding: '12px 16px',
    fontSize: '10px',
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }}>
    {children}
  </th>
);

const Td = ({ children, align, t }) => (
  <td style={{
    padding: '14px 16px',
    textAlign: align || 'left',
    color: t.text,
    verticalAlign: 'middle',
  }}>
    {children}
  </td>
);
