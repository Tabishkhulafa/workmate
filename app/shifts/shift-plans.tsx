'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle2, Clock3, Info, Layers3, ShieldCheck, UserRound, Users, XCircle } from 'lucide-react';
import { resolveEffectiveShiftPreview, type ShiftAssignment, type ShiftDepartment, type ShiftOverride, type ShiftScope, type ShiftStaff, type ShiftTemplate } from '@/lib/effective-shift-preview';
import { shortTime } from './shift-table';
import styles from './shift-management.module.css';

type Props = { shifts: ShiftTemplate[]; staff: ShiftStaff[]; departments: ShiftDepartment[]; assignments: ShiftAssignment[]; overrides: ShiftOverride[]; viewerRole: string; today: string; readOnly: boolean };
const minutesLabel = (value: number) => `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, '0')}m`;
const roleLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (value: string) => /\d{4}-\d{2}-\d{2}/.test(value) ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : value;
const nextYear = (value: string) => {
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

export default function ShiftPlans({ shifts, staff, departments, assignments, overrides, viewerRole, today, readOnly }: Props) {
  const router = useRouter();
  const admin = viewerRole === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'regular' | 'special'>('regular');
  const [scope, setScope] = useState<ShiftScope>('DEPARTMENT');
  const [subject, setSubject] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(nextYear(today));
  const [name, setName] = useState('Ramadan shift');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [full, setFull] = useState(540);
  const [half, setHalf] = useState(270);
  const [previewStaff, setPreviewStaff] = useState('');
  const [previewDate, setPreviewDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const subjects = useMemo(() => scope === 'DEPARTMENT'
    ? departments.map(d => ({ id: d.id, label: d.name }))
    : scope === 'EMPLOYEE'
      ? staff.filter(p => admin || p.role !== 'HR').map(p => ({ id: p.id, label: `${p.full_name || p.employee_code || 'Unnamed staff'} · ${roleLabel(p.role)}` }))
      : [], [scope, departments, staff, admin]);
  const activeShifts = shifts.filter(s => s.is_active === true);
  const selectedEmployee = staff.find(p => p.id === previewStaff);
  const preview = selectedEmployee ? resolveEffectiveShiftPreview({ employee: selectedEmployee, date: previewDate, shifts, assignments, overrides }) : null;
  const scopeName = (kind: ShiftScope, departmentId: string | null, employeeId: string | null) => kind === 'ORGANISATION'
    ? 'All staff' : kind === 'DEPARTMENT'
      ? departments.find(d => d.id === departmentId)?.name || 'Unknown department'
      : staff.find(p => p.id === employeeId)?.full_name || 'Unknown staff';

  function changeScope(value: ShiftScope) { setScope(value); setSubject(''); setMessage(null); }
  async function action(input: Record<string, unknown>) {
    if (busy || readOnly) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/proxy/manage-shift-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || `Could not save shift plan (HTTP ${response.status}).`);
      setMessage({ kind: 'success', text: 'Shift plan saved. Updated assignments will appear after refresh.' });
      router.refresh();
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save shift plan.' }); }
    finally { setBusy(false); }
  }
  function save() {
    if (readOnly || busy) return;
    if (scope === 'ORGANISATION' && !admin) { setMessage({ kind: 'error', text: 'Only Super Admin can assign an organisation-wide shift.' }); return; }
    if (scope !== 'ORGANISATION' && !subject) { setMessage({ kind: 'error', text: 'Select a department or staff member.' }); return; }
    if (!from || !to || from > to || new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime() > 732 * 86400000) { setMessage({ kind: 'error', text: 'Choose an effective date range no longer than two years.' }); return; }
    const target = { scope, department_id: scope === 'DEPARTMENT' ? subject : null, employee_id: scope === 'EMPLOYEE' ? subject : null };
    if (tab === 'regular') {
      if (!shiftId) { setMessage({ kind: 'error', text: 'Choose an active shift template.' }); return; }
      void action({ action: 'CREATE_ASSIGNMENT', ...target, shift_id: shiftId, effective_from: from, effective_to: to });
    } else {
      if (name.trim().length < 2 || !start || !end || start === end || !Number.isInteger(full) || !Number.isInteger(half) || half < 30 || half >= full || full < 60 || full > 1440) { setMessage({ kind: 'error', text: 'Enter valid special shift times and full/half-day minutes.' }); return; }
      void action({ action: 'CREATE_OVERRIDE', ...target, name: name.trim(), start_date: from, end_date: to, start_time: start, end_time: end, required_work_minutes: full, half_day_minutes: half });
    }
  }
  function deactivate(actionName: 'DEACTIVATE_ASSIGNMENT' | 'DEACTIVATE_OVERRIDE', id: string) {
    if (!window.confirm('Deactivate this shift plan? Existing attendance records will stay unchanged.')) return;
    void action({ action: actionName, id });
  }

  return <section className={styles.section} aria-label="Shift assignments and effective timings">
    <div className={styles.panel}>
      <div className={styles.panelHeading}><div><span className={styles.kicker}>02 / ASSIGN SCHEDULES</span><h2>Who works which shift?</h2><p>Set schedules for a department, one employee or the entire organisation. HR staff are included.</p></div><span className={styles.subtlePill}><Layers3 size={15}/> {assignments.length} active assignments</span></div>
      <div className={styles.segmented} role="tablist" aria-label="Shift assignment type">
        <button type="button" role="tab" aria-selected={tab === 'regular'} className={tab === 'regular' ? styles.selectedTab : ''} onClick={() => setTab('regular')}><Clock3 size={17}/> Regular shift</button>
        <button type="button" role="tab" aria-selected={tab === 'special'} className={tab === 'special' ? styles.selectedTab : ''} onClick={() => setTab('special')}><CalendarDays size={17}/> Special / Ramadan</button>
      </div>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Assign to</span><select value={scope} onChange={e => changeScope(e.target.value as ShiftScope)}><option value="DEPARTMENT">Entire department</option><option value="EMPLOYEE">Individual employee / HR</option>{admin && <option value="ORGANISATION">All staff (organisation)</option>}</select></label>
        {scope !== 'ORGANISATION' && <label className={styles.field}><span>{scope === 'DEPARTMENT' ? 'Department' : 'Employee / HR'}</span><select value={subject} onChange={e => setSubject(e.target.value)}><option value="">Select {scope === 'DEPARTMENT' ? 'department' : 'staff member'}</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
        {tab === 'regular'
          ? <label className={styles.field}><span>Assigned shift</span><select value={shiftId} onChange={e => setShiftId(e.target.value)}><option value="">Select active shift</option>{activeShifts.map(s => <option key={s.id} value={s.id}>{s.name} · {shortTime(s.start_time)} – {shortTime(s.end_time)}</option>)}</select></label>
          : <><label className={styles.field}><span>Special shift name</span><input maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label><label className={styles.field}><span>Start time</span><input type="time" value={start} onChange={e => setStart(e.target.value)}/></label><label className={styles.field}><span>End time</span><input type="time" value={end} onChange={e => setEnd(e.target.value)}/></label><label className={styles.field}><span>Full-day minutes</span><input type="number" min={60} max={1440} value={full} onChange={e => setFull(Number(e.target.value))}/></label><label className={styles.field}><span>Half-day minutes</span><input type="number" min={30} max={1439} value={half} onChange={e => setHalf(Number(e.target.value))}/></label></>}
        <label className={styles.field}><span>Effective from</span><input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label>
        <label className={styles.field}><span>Effective until</span><input type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)}/></label>
      </div>
      <div className={styles.formFooter}><p><Info size={16}/> Changes apply to future clock-ins during the selected dates. Existing attendance rows are preserved.</p><button className={styles.primaryButton} disabled={busy || readOnly} type="button" onClick={save}>{busy ? 'Saving…' : tab === 'regular' ? 'Assign shift' : 'Add special shift'}</button></div>
      {message && <p className={`${styles.message} ${message.kind === 'error' ? styles.messageError : styles.messageSuccess}`} role="status">{message.text}</p>}
    </div>

    <div className={styles.panel}>
      <div className={styles.panelHeading}><div><span className={styles.kicker}>03 / VERIFY EMPLOYEE TIMING</span><h2>Check effective shift</h2><p>Preview which schedule the attendance system will use for a staff member on any selected date.</p></div><span className={styles.subtlePill}><ShieldCheck size={15}/> Read-only preview</span></div>
      <div className={styles.inspectorGrid}>
        <label className={styles.field}><span>Employee / HR</span><select value={previewStaff} onChange={e => setPreviewStaff(e.target.value)}><option value="">Select staff member</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.employee_code || 'Unnamed'} · {roleLabel(s.role)}</option>)}</select></label>
        <label className={styles.field}><span>Attendance date (IST)</span><input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)}/></label>
      </div>
      {!selectedEmployee ? <div className={styles.emptyThin}><UserRound size={18}/> Choose an employee to see the applicable shift.</div>
        : preview ? <div className={styles.effectiveCard}>
          <div className={styles.effectiveInfo}><span className={styles.effectiveLabel}>APPLICABLE SHIFT</span><h3>{preview.name}</h3><p>{selectedEmployee.full_name || selectedEmployee.employee_code} · {preview.source} · {roleLabel(preview.level)} assignment</p></div>
          <div className={styles.effectiveTime}><Clock3 size={20}/><strong>{shortTime(preview.start_time)} – {shortTime(preview.end_time)}</strong><span>Full day {minutesLabel(preview.required_work_minutes)} · Half day {minutesLabel(preview.half_day_minutes)}</span></div>
        </div> : <div className={styles.noShift}><XCircle size={20}/><div><strong>No applicable shift for {dateLabel(previewDate)}</strong><p>Clock In will be blocked with “No shift is configured” until a matching active assignment is available.</p></div></div>}
      {preview && preview.end_time < preview.start_time && <div className={styles.overnightNotice}><Clock3 size={18}/><p><strong>Overnight attendance needs a backend fix:</strong> the current server rejects Clock Out after midnight, even if this shift ends the next day.</p></div>}
      <p className={styles.ruleFootnote}><Info size={15}/> Priority: Special Employee → Department → Organisation, then Regular Employee → Department → Organisation. The server makes the final decision at Clock In.</p>
    </div>

    <div className={styles.panel}>
      <div className={styles.panelHeading}><div><span className={styles.kicker}>04 / ACTIVE PLANS</span><h2>Current assignments</h2><p>Deactivation affects future clock-ins only; historical attendance is not rewritten.</p></div><span className={styles.subtlePill}><Users size={15}/> {assignments.length + overrides.length} plans</span></div>
      <h3 className={styles.tableTitle}>Regular assignments <span>{assignments.length}</span></h3>
      <div className={styles.planList}>{assignments.length === 0 && <div className={styles.empty}>No active regular assignments found.</div>}
        {assignments.map(a => { const shift = shifts.find(s => s.id === a.shift_id); return <div className={styles.planRow} key={a.id}>
          <div className={styles.planBody}><strong>{shift?.name || 'Unknown shift'}</strong><span>{scopeName(a.scope, a.department_id, a.employee_id)} <i>· {roleLabel(a.scope)}</i></span><small>{dateLabel(a.effective_from)} — {a.effective_to ? dateLabel(a.effective_to) : 'Ongoing'}{shift ? ` · ${shortTime(shift.start_time)} – ${shortTime(shift.end_time)}` : ''}</small></div>
          <button className={styles.ghostDanger} type="button" disabled={busy || readOnly} onClick={() => deactivate('DEACTIVATE_ASSIGNMENT', a.id)}>Deactivate</button>
        </div>; })}</div>
      <h3 className={styles.tableTitle}>Special shifts <span>{overrides.length}</span></h3>
      <div className={styles.planList}>{overrides.length === 0 && <div className={styles.empty}>No active special shifts found.</div>}
        {overrides.map(a => <div className={styles.planRow} key={a.id}><div className={styles.planBody}><strong>{a.name}</strong><span>{scopeName(a.scope, a.department_id, a.employee_id)} <i>· {roleLabel(a.scope)}</i></span><small>{dateLabel(a.start_date)} — {dateLabel(a.end_date)} · {shortTime(a.start_time)} – {shortTime(a.end_time)}</small></div><button className={styles.ghostDanger} type="button" disabled={busy || readOnly} onClick={() => deactivate('DEACTIVATE_OVERRIDE', a.id)}>Deactivate</button></div>)}</div>
    </div>
    {readOnly && <p className={styles.readonlyNotice}><ShieldCheck size={18}/> Local preview mode: shift changes require a separate staging Supabase project. The production attendance system is unchanged.</p>}
  </section>;
}
