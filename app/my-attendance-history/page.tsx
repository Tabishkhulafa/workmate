import Link from 'next/link';
import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';
import { normalizeAttendanceRow } from '@/lib/attendance-rules';
import styles from './attendance-history.module.css';
import {workStatus,isEarlyClockOut} from '@/lib/attendance-early-clockout';

type View = 'me' | 'team' | 'department' | 'organisation';
type Status = 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'IN_PROGRESS' | 'NOT_MARKED' | 'MISSING_CHECKOUT' | 'HOLIDAY' | 'WEEKLY_OFF';
type Filters = { view?: string; date?: string; from?: string; to?: string; status?: string; department?: string; search?: string };
type Punch = {
  attendance_date?: string | null;
  clock_in_at?: string | null;
  clock_in_location_id?: string | null;
  clock_out_at?: string | null;
  attendance_status?: string | null;
  clock_in_method?: string | null;
  clock_out_method?: string | null;
  late_minutes?: number | null;
  worked_minutes?: number | null;
  required_work_minutes?: number | null;
  half_day_minutes?: number | null;
  missing_checkout?: boolean | null;
};
type RecordItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  code: string;
  department: string;
  date: string;
  status: Status;
  punch: Punch | null;
};
type OrganisationResponse = {
  success?: boolean;
  error?: string;
  rows?: {
    employee_id: string;
    full_name?: string | null;
    employee_code?: string | null;
    department_id?: string | null;
    department_name?: string | null;
    day_type?: string | null;
    effective_status: string;
    attendance: Punch | null;
  }[];
  departments?: { id: string; name: string }[];
};
type DepartmentResponse = {
  success?: boolean;
  error?: string;
  department?: { id?: string; name?: string };
  rows?: {
    employee?: { id: string; full_name?: string | null; employee_code?: string | null };
    day_type?: string | null;
    effective_status: string;
    attendance: Punch | null;
  }[];
};

const STATUS_ORDER: Status[] = ['PRESENT', 'HALF_DAY', 'ABSENT', 'IN_PROGRESS', 'NOT_MARKED', 'MISSING_CHECKOUT'];
const LABELS: Record<Status, string> = {
  PRESENT: 'Present', HALF_DAY: 'Half day', ABSENT: 'Absent', IN_PROGRESS: 'In progress',
  NOT_MARKED: 'Not marked', MISSING_CHECKOUT: 'Missing checkout', HOLIDAY: 'Holiday', WEEKLY_OFF: 'Weekly off',
};
const TONE: Record<Status, string> = {
  PRESENT: styles.present, HALF_DAY: styles.half, ABSENT: styles.absent,
  IN_PROGRESS: styles.progress, NOT_MARKED: styles.neutral, MISSING_CHECKOUT: styles.missing,
  HOLIDAY: styles.holiday, WEEKLY_OFF: styles.neutral,
};
const timeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
});
const dateFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
});
const isoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});

function cleanDay(raw: string | undefined, fallback: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const date = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? fallback : raw;
}
function dayOffset(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function displayDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '—';
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormat.format(parsed);
}
function displayTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : timeFormat.format(parsed);
}
function workedMinutes(punch: Punch | null): number | null {
  if (!punch) return null;
  if (typeof punch.worked_minutes === 'number' && Number.isFinite(punch.worked_minutes) && punch.worked_minutes >= 0) {
    return Math.floor(punch.worked_minutes);
  }
  if (!punch.clock_in_at || !punch.clock_out_at) return null;
  const delta = (Date.parse(punch.clock_out_at) - Date.parse(punch.clock_in_at)) / 60000;
  return Number.isFinite(delta) && delta >= 0 ? Math.floor(delta) : null;
}
function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
function statusOf(punch: Punch | null, holiday = false, weeklyOff = false): Status {
  if (!punch?.clock_in_at) return holiday ? 'HOLIDAY' : weeklyOff ? 'WEEKLY_OFF' : 'NOT_MARKED';
  if (!punch.clock_out_at) return punch.missing_checkout ? 'MISSING_CHECKOUT' : 'IN_PROGRESS';
  const minutes = workedMinutes(punch);
  if (minutes === null) return 'MISSING_CHECKOUT';
  const full = typeof punch.required_work_minutes === 'number' && punch.required_work_minutes > 0
    ? punch.required_work_minutes : 540;
  const half = typeof punch.half_day_minutes === 'number' && punch.half_day_minutes > 0
    ? punch.half_day_minutes : 270;
  // Preserve approved historical statuses: a policy update is not a retroactive payroll edit.
  const recorded = String(punch.attendance_status || '').toUpperCase();
  if (recorded === 'PRESENT' || recorded === 'HALF_DAY' || recorded === 'ABSENT') return recorded;
  return workStatus(minutes, full, half);
}
function methodText(punch: Punch | null): string {
  if (!punch) return '—';
  const methods = [punch.clock_in_method, punch.clock_out_method]
    .filter((method): method is string => Boolean(method))
    .map(method => method.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
  return methods.length > 0 ? methods.join(' / ') : '—';
}
function statusChip(status: Status, punch?: Punch | null) {
  const minutes = workedMinutes(punch ?? null);
  const early = isEarlyClockOut(status,minutes,punch?.required_work_minutes,
    Boolean(punch?.clock_out_at));
  return <span style={{display:'inline-flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
    <span className={`${styles.statusBadge} ${TONE[status]}`}>{LABELS[status]}</span>
    {early && <span title="Worked at least 15 minutes short of scheduled requirement, within attendance grace"
      style={{display:'inline-flex',borderRadius:999,padding:'5px 9px',fontSize:11,fontWeight:700,background:'#FFF4DE',color:'#925500',whiteSpace:'nowrap'}}>
      Early Clock Out
    </span>}
  </span>;
}
function allowedViews(role: string): { key: View; label: string }[] {
  if (role === 'DEPARTMENT_HEAD') return [{ key: 'me', label: 'My attendance' }, { key: 'team', label: 'Team attendance' }];
  if (role === 'HR') return [
    { key: 'me', label: 'My attendance' }, { key: 'department', label: 'Department attendance' },
    { key: 'organisation', label: 'Organisation attendance' },
  ];
  if (role === 'SUPER_ADMIN') return [{ key: 'organisation', label: 'Organisation attendance' }];
  return [{ key: 'me', label: 'My attendance' }];
}

export default async function AttendanceHistory({ searchParams }: { searchParams: Promise<Filters> }) {
  const { profile, supabase } = await requireProfile();
  const params = await searchParams;
  const views = allowedViews(profile.role);
  const view = views.find(tab => tab.key === params.view)?.key ?? views[0].key;
  const isMine = view === 'me';
  const today = isoDay.format(new Date());
  const date = cleanDay(params.date, today);
  const to = cleanDay(params.to, today);
  const from = cleanDay(params.from, dayOffset(to, -29));
  const validRange = from <= to && (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000 <= 92;
  const search = (params.search || '').trim().slice(0, 120);
  const selectedStatus = STATUS_ORDER.includes(params.status as Status) ? params.status as Status : 'ALL';
  const departmentId = params.department || '';
  let rows: RecordItem[] = [];
  let departments: { id: string; name: string }[] = [];
  let message: string | null = null;
  let teamName = '';
  let selectionHint = '';

  if (isMine) {
    if (!validRange) {
      message = 'Choose a valid date range of up to 93 calendar days.';
    } else {
      const { data, error } = await supabase.from('attendance')
        .select('attendance_date,clock_in_at,clock_in_location_id,clock_out_at,attendance_status,clock_in_method,clock_out_method,late_minutes,worked_minutes,required_work_minutes,half_day_minutes,missing_checkout')
        .eq('employee_id', profile.id).gte('attendance_date', from).lte('attendance_date', to)
        .order('attendance_date', { ascending: false }).limit(100);
      if (error) message = `Unable to load your attendance: ${error.message}`;
      else rows = ((data ?? []) as Punch[]).map((punch, index) => ({
        id: `${punch.attendance_date}-${index}`,
        employeeId: profile.id,
        employeeName: profile.full_name || 'You',
        code: profile.employee_code || '', department: '',
        date: punch.attendance_date || '', punch, status: statusOf(punch),
      }));
    }
    selectionHint = 'Your recorded attendance within the selected date range. Days without a saved record are not counted as absent.';
  } else if (view === 'team') {
    // This function enforces department-head scoping on the server.
    const [report, holiday] = await Promise.all([
      supabase.functions.invoke('department-overview', { body: { mode: 'ATTENDANCE', date } }),
      supabase.from('holidays').select('id').eq('holiday_date', date).eq('is_active', true).limit(1),
    ]);
    const response = report.data as DepartmentResponse | null;
    if (report.error || holiday.error || !response?.success) {
      message = response?.error || report.error?.message || holiday.error?.message || 'Unable to load your department attendance.';
    } else {
      const isHoliday = (holiday.data || []).length > 0;
      teamName = response.department?.name || 'My department';
      rows = (response.rows ?? []).map((row, index) => {
        const clean = normalizeAttendanceRow(row, isHoliday);
        const weeklyOff = !isHoliday && row.day_type === 'WEEKLY_OFF';
        return {
          id: row.employee?.id || `team-${index}`,
          employeeId: row.employee?.id || '',
          employeeName: row.employee?.full_name || 'Team member', code: row.employee?.employee_code || '',
          department: teamName, date, punch: row.attendance,
          status: statusOf(clean.attendance, isHoliday, weeklyOff),
        };
      });
    }
    selectionHint = 'Only active employees from your assigned department are shown.';
  } else {
    // HR and Super Admin only. Edge Function independently verifies the caller's role.
    const [report, holiday] = await Promise.all([
      supabase.functions.invoke('organisation-attendance-report', { body: { date } }),
      supabase.from('holidays').select('id').eq('holiday_date', date).eq('is_active', true).limit(1),
    ]);
    const response = report.data as OrganisationResponse | null;
    if (report.error || holiday.error || !response?.success) {
      message = response?.error || report.error?.message || holiday.error?.message || 'Unable to load the authorised attendance report.';
    } else {
      departments = response.departments ?? [];
      const isHoliday = (holiday.data || []).length > 0;
      rows = (response.rows ?? []).filter(row => view !== 'department' || (departmentId && row.department_id === departmentId))
        .map(row => {
          const clean = normalizeAttendanceRow(row, isHoliday);
          const weeklyOff = !isHoliday && row.day_type === 'WEEKLY_OFF';
          return {
            id: row.employee_id, employeeId: row.employee_id, employeeName: row.full_name || 'Employee', code: row.employee_code || '',
            department: row.department_name || 'Unassigned', date, punch: row.attendance,
            status: statusOf(clean.attendance, isHoliday, weeklyOff),
          };
        });
    }
    selectionHint = view === 'department' ? 'Choose a department to see only its employees.' : 'Attendance across all authorised departments.';
  }

  // Presentation-only location comparison. Punch location is recorded by the existing
  // attendance backend; no location selection, GPS validation or attendance write changes.
  // Supabase RLS restricts profile and attendance lookups to the caller's role scope.
  const assignedLocationByEmployee = new Map<string, string>();
  const actualLocationByEmployee = new Map<string, string>();
  const locationNames = new Map<string, string>();
  const employeeIds = [...new Set(rows.map(row => row.employeeId).filter(Boolean))];
  if (employeeIds.length > 0) {
    const [assignments, locations, punches] = await Promise.all([
      supabase.from('profiles').select('id,work_location_id').in('id', employeeIds),
      supabase.from('office_locations').select('id,name').eq('is_active', true),
      isMine
        ? Promise.resolve({ data: [] as { employee_id: string; clock_in_location_id: string | null }[] })
        : supabase.from('attendance').select('employee_id,clock_in_location_id')
            .eq('attendance_date', date).in('employee_id', employeeIds),
    ]);
    for (const item of assignments.data ?? []) {
      if (item.work_location_id) assignedLocationByEmployee.set(item.id, item.work_location_id);
    }
    for (const location of locations.data ?? []) {
      locationNames.set(location.id, location.name);
    }
    for (const punch of punches.data ?? []) {
      if (punch.clock_in_location_id) actualLocationByEmployee.set(punch.employee_id, punch.clock_in_location_id);
    }
  }

  // An off-site punch is a valid GPS-verified punch at another approved site.
  // Absence of either location ID is unknown, NOT off-site.
  function clockInLocation(row: RecordItem) {
    if (!row.punch?.clock_in_at) return null;
    const locationId = row.punch.clock_in_location_id || actualLocationByEmployee.get(row.employeeId);
    if (!locationId) return null; // Older records may not have a location snapshot.
    const name = locationNames.get(locationId);
    if (!name) return null;
    const assignedId = assignedLocationByEmployee.get(row.employeeId);
    const offSite = Boolean(assignedId && assignedId !== locationId);
    return <span className={styles.clockInSite}>
      {offSite && <span className={styles.offSiteBadge}>Off-site Clock In</span>}
      <span className={styles.clockInSiteName}>{name}</span>
    </span>;
  }

  const scopedRows = rows;
  const offSiteCount = scopedRows.filter(row => {
    if (!row.punch?.clock_in_at) return false;
    const actual = row.punch.clock_in_location_id || actualLocationByEmployee.get(row.employeeId);
    const assigned = assignedLocationByEmployee.get(row.employeeId);
    return Boolean(actual && assigned && actual !== assigned && locationNames.has(actual));
  }).length;
  const displayedRows = scopedRows.filter(row =>
    (selectedStatus === 'ALL' || row.status === selectedStatus) &&
    (!search || `${row.employeeName} ${row.code}`.toLowerCase().includes(search.toLowerCase()))
  );
  const counts = Object.fromEntries(STATUS_ORDER.map(status => [status, scopedRows.filter(row => row.status === status).length])) as Record<Status, number>;
  const extraStatuses = scopedRows.filter(row => row.status === 'HOLIDAY' || row.status === 'WEEKLY_OFF').length;
  const totalWorked = scopedRows.reduce((sum, row) => sum + (workedMinutes(row.punch) ?? 0), 0);
  const currentLabel = views.find(tab => tab.key === view)?.label || 'Attendance';
  const hasUnchosenDepartment = view === 'department' && !departmentId;
  const baseFilters = new URLSearchParams({ view, date, from, to, search, department: departmentId });
  const statusLink = (status: Status | 'ALL') => {
    const url = new URLSearchParams(baseFilters);
    if (status !== 'ALL') url.set('status', status);
    return `/my-attendance-history?${url.toString()}#attendance-list`;
  };

  return <Shell name={profile.full_name || 'Team member'} role={profile.role}>
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>WORK MATE / ATTENDANCE</div>
          <h1>{views.length > 1 ? 'Attendance centre' : 'My attendance history'}</h1>
          <p>Your attendance records and authorised team reports, with all times in Indian Standard Time (IST).</p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">WM<span>Attendance</span></div>
      </header>

      {views.length > 1 && <nav className={styles.tabs} aria-label="Attendance views">
        {views.map(tab => <Link key={tab.key}
          href={`/my-attendance-history?view=${tab.key}`}
          aria-current={tab.key === view ? 'page' : undefined}
          className={tab.key === view ? styles.activeTab : ''}>
          {tab.label}
        </Link>)}
      </nav>}

      <section className={styles.toolbar} aria-label="Attendance filters">
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>{isMine ? 'PERSONAL RECORDS' : 'TEAM REPORTING'}</span>
            <h2>{currentLabel}</h2></div>
          <span className={styles.datePill}>{isMine ? `${displayDate(from)} – ${displayDate(to)}` : displayDate(date)}</span>
        </div>
        <form method="GET" action="/my-attendance-history" className={styles.filters}>
          <input type="hidden" name="view" value={view}/>
          {isMine ? <>
            <label>From<input aria-label="From date" type="date" name="from" defaultValue={from} max={today}/></label>
            <label>To<input aria-label="To date" type="date" name="to" defaultValue={to} max={today}/></label>
          </> : <label>Date<input aria-label="Attendance date" type="date" name="date" defaultValue={date} max={today}/></label>}
          {view === 'department' && <label>Department<select name="department" defaultValue={departmentId}>
            <option value="">Select department</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select></label>}
          {!isMine && <label>Search employee<input type="search" name="search" defaultValue={search} maxLength={120} placeholder="Name or employee code"/></label>}
          <label>Status<select name="status" defaultValue={selectedStatus}>
            <option value="ALL">All statuses</option>
            {STATUS_ORDER.map(status => <option key={status} value={status}>{LABELS[status]}</option>)}
          </select></label>
          <button type="submit" className={styles.applyButton}>Apply filters</button>
        </form>
        <p className={styles.helper}>{selectionHint}</p>
      </section>

      {message ? <div className={styles.error} role="alert">{message}</div> : <>
        {!hasUnchosenDepartment && <>
          <section className={styles.stats} aria-label="Attendance status summary">
            <div className={styles.overallStat}><span>{isMine ? 'Recorded days' : 'Employees in scope'}</span>
              <strong>{scopedRows.length}</strong><small>{isMine ? 'Selected period' : teamName || displayDate(date)}</small></div>
            {STATUS_ORDER.slice(0, 5).map(status => <Link key={status}
              href={statusLink(status)} className={`${styles.stat} ${TONE[status]}`} aria-label={`${LABELS[status]}: ${counts[status]}, filter records`}>
              <span>{LABELS[status]}</span><strong>{counts[status]}</strong><small>View records →</small>
            </Link>)}
          </section>
          <div className={styles.insightRow}>
            <span><strong>{formatMinutes(totalWorked)}</strong> worked across {isMine ? 'saved punches' : 'selected employees'}</span>
            {counts.MISSING_CHECKOUT > 0 && <span><strong>{counts.MISSING_CHECKOUT}</strong> missing checkouts</span>}
            {extraStatuses > 0 && <span><strong>{extraStatuses}</strong> holidays / weekly offs</span>}
            {offSiteCount > 0 && <span><strong>{offSiteCount}</strong> off-site clock-ins (at another approved site)</span>}
            {!isMine && <span>{scopedRows.length} employees for {displayDate(date)}</span>}
          </div>
        </>}

        <section id="attendance-list" className={styles.records}>
          <div className={styles.recordHeader}>
            <div><span className={styles.kicker}>DETAILED BREAKDOWN</span><h2>{isMine ? 'My daily punches' : 'Employee attendance'}</h2>
              <p>{hasUnchosenDepartment ? 'Select a department above to view its attendance.' : `${displayedRows.length} of ${scopedRows.length} records shown`}</p></div>
            {(search || selectedStatus !== 'ALL') && <Link className={styles.clear} href={`/my-attendance-history?${new URLSearchParams({ view, date, from, to, department: departmentId }).toString()}#attendance-list`}>Clear filters</Link>}
          </div>
          {!hasUnchosenDepartment && displayedRows.length > 0 ? <>
            <div className={styles.desktopTable}>
              <table className={styles.table}>
                <thead><tr>
                  {isMine ? <th scope="col">Date</th> : <><th scope="col">Employee</th>{view !== 'team' && <th scope="col">Department</th>}</>}
                  <th scope="col">Clock in</th><th scope="col">Clock out</th><th scope="col">Status</th>
                  <th scope="col">Worked</th><th scope="col">Method</th><th scope="col">Late</th>
                </tr></thead>
                <tbody>{displayedRows.map(row => <tr key={row.id}>
                  {isMine ? <td className={styles.emphasis}>{displayDate(row.date)}</td> : <><td><div className={styles.employeeName}>{row.employeeName}</div><small>{row.code || '—'}</small></td>{view !== 'team' && <td>{row.department}</td>}</>}
                  <td><div>{displayTime(row.punch?.clock_in_at)}</div>{clockInLocation(row)}</td><td>{displayTime(row.punch?.clock_out_at)}</td>
                  <td>{statusChip(row.status,row.punch)}</td><td className={styles.emphasis}>{formatMinutes(workedMinutes(row.punch))}</td>
                  <td>{methodText(row.punch)}</td><td>{row.punch?.late_minutes && row.punch.late_minutes > 0 ? `${row.punch.late_minutes} min` : '—'}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className={styles.mobileList}>
              {displayedRows.map(row => <article className={styles.mobileCard} key={row.id}>
                <div className={styles.mobileTop}><div>
                  <strong>{isMine ? displayDate(row.date) : row.employeeName}</strong>
                  {!isMine && <small>{row.code || row.department}</small>}</div>
                  {statusChip(row.status,row.punch)}</div>
                <div className={styles.punchGrid}><div><span>Clock in</span><strong>{displayTime(row.punch?.clock_in_at)}</strong>{clockInLocation(row)}</div>
                  <div><span>Clock out</span><strong>{displayTime(row.punch?.clock_out_at)}</strong></div></div>
                <div className={styles.mobileBottom}><span>Worked <strong>{formatMinutes(workedMinutes(row.punch))}</strong></span>
                  <span>Method <strong>{methodText(row.punch)}</strong></span>
                  <span>Late <strong>{row.punch?.late_minutes && row.punch.late_minutes > 0 ? `${row.punch.late_minutes} min` : '—'}</strong></span></div>
              </article>)}
            </div>
          </> : <div className={styles.empty}>
            <span aria-hidden="true">◎</span>
            <strong>{hasUnchosenDepartment ? 'Choose a department' : 'No attendance records found'}</strong>
            <p>{hasUnchosenDepartment ? 'Select a department and press Apply filters to see its employees.' : 'Try a different date, status or search. Existing attendance records have not been changed.'}</p>
          </div>}
        </section>
        <p className={styles.footnote}>Off-site Clock In means the GPS-verified clock-in location is a different approved site than the employee’s <strong>current</strong> assigned work location. Historical assignment changes can affect older labels. Records without location data are not flagged.</p>
        <p className={styles.footnote}>{isMine ? 'Showing up to 100 saved records. Unrecorded calendar days are not fabricated as absences.' : 'Team data is read-only and limited by the permissions enforced by Supabase.'}</p>
      </>}
    </section>
  </Shell>;
}
