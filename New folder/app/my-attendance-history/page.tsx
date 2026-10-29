import Link from 'next/link';
import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';

const IST = 'Asia/Kolkata';

type AttendanceRow = {
  attendance_date: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  attendance_status: string | null;
  clock_in_method: string | null;
  clock_out_method: string | null;
  late_minutes: number | null;
  worked_minutes: number | null;
};

function formatPunchTime(value: string | null | undefined, compact = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', compact ? {
    timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true,
  } : {
    timeZone: IST, day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
}

function formatAttendanceDate(value: string | null | undefined): string {
  if (!value) return '—';
  // attendance_date is an IST calendar date, not a timestamp.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function statusText(raw: string | null): string {
  return (raw || 'NOT_MARKED').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

function statusTone(raw: string | null): string {
  const status = (raw || '').toUpperCase();
  if (status === 'PRESENT') return 'wm-history-badge--present';
  if (status === 'HALF_DAY') return 'wm-history-badge--half';
  if (status === 'ABSENT') return 'wm-history-badge--absent';
  if (status === 'IN_PROGRESS') return 'wm-history-badge--progress';
  if (status === 'MISSING_CHECKOUT') return 'wm-history-badge--missing';
  return 'wm-history-badge--neutral';
}

function minutesText(value: number | null): string {
  if (value === null || value === undefined) return '—';
  const minutes = Math.max(0, value);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

export default async function Page() {
  const { profile, supabase } = await requireProfile();
  const { data, error } = await supabase
    .from('attendance')
    .select('attendance_date,clock_in_at,clock_out_at,attendance_status,clock_in_method,clock_out_method,late_minutes,worked_minutes')
    .eq('employee_id', profile.id)
    .order('attendance_date', { ascending: false })
    .limit(100);
  const records = (data || []) as AttendanceRow[];
  const summary = [
    { label: 'Present', count: records.filter(r => r.attendance_status === 'PRESENT').length, tone: 'present' },
    { label: 'Half day', count: records.filter(r => r.attendance_status === 'HALF_DAY').length, tone: 'half' },
    { label: 'Absent', count: records.filter(r => r.attendance_status === 'ABSENT').length, tone: 'absent' },
    { label: 'Pending / missing out', count: records.filter(r => ['IN_PROGRESS','MISSING_CHECKOUT'].includes(r.attendance_status || '')).length, tone: 'progress' },
  ];
  const canSeeTeam = ['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role);

  return (
    <Shell name={profile.full_name || 'Team member'} role={profile.role}>
      <div className="wm-history">
        <div className="eyebrow">YOUR ATTENDANCE</div>
        <div className="wm-history-heading">
          <div>
            <h1>My attendance history</h1>
            <p className="muted">Your recorded Clock In and Clock Out times, shown in Indian Standard Time.</p>
          </div>
          {canSeeTeam && <Link className="wm-history-leave-link" href="/on-leave-today">Who's on leave today <span aria-hidden="true">↗</span></Link>}
        </div>
        {error ? <p className="notice error">Unable to load attendance: {error.message}</p> : <>
          <div className="wm-history-stats" aria-label="Attendance breakdown for the most recent 100 records">
            {summary.map(item => <div key={item.label} className={`wm-history-stat wm-history-stat--${item.tone}`}>
              <span>{item.label}</span><strong>{item.count}</strong>
            </div>)}
          </div>
          <div className="wm-history-table-frame">
            <div className="tablewrap wm-history-desktop">
              <table className="wm-history-table">
                <thead><tr><th>Date</th><th>Clock In (IST)</th><th>Clock Out (IST)</th><th>Status</th><th>Method</th><th>Worked</th><th>Late</th></tr></thead>
                <tbody>
                  {records.map((r, i) => <tr key={`${r.attendance_date || 'unknown'}-${i}`}>
                    <td><strong>{formatAttendanceDate(r.attendance_date)}</strong></td>
                    <td>{formatPunchTime(r.clock_in_at)}</td>
                    <td>{formatPunchTime(r.clock_out_at)}</td>
                    <td><span className={`wm-history-badge ${statusTone(r.attendance_status)}`}>{statusText(r.attendance_status)}</span></td>
                    <td><span className="wm-history-method">{[r.clock_in_method, r.clock_out_method].filter(Boolean).join(' / ') || '—'}</span></td>
                    <td>{minutesText(r.worked_minutes)}</td>
                    <td>{r.late_minutes && r.late_minutes > 0 ? <span className="wm-history-late">{r.late_minutes} min</span> : '—'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="wm-history-mobile">
              {records.map((r,i) => <article className="wm-history-mobile-card" key={`${r.attendance_date||'unknown'}-${i}`}>
                <div className="wm-history-mobile-top"><strong>{formatAttendanceDate(r.attendance_date)}</strong><span className={`wm-history-badge ${statusTone(r.attendance_status)}`}>{statusText(r.attendance_status)}</span></div>
                <div className="wm-history-time-pair"><div><span>Clock In</span><strong>{formatPunchTime(r.clock_in_at, true)}</strong></div><div><span>Clock Out</span><strong>{formatPunchTime(r.clock_out_at, true)}</strong></div></div>
                <div className="wm-history-mobile-foot"><span>Worked: {minutesText(r.worked_minutes)}</span><span>Method: {[r.clock_in_method,r.clock_out_method].filter(Boolean).join(' / ') || '—'}</span>{Boolean(r.late_minutes && r.late_minutes>0) && <span>Late: {r.late_minutes} min</span>}</div>
              </article>)}
            </div>
            {records.length === 0 && <div className="wm-history-empty">No attendance records found yet.</div>}
          </div>
        </>}
        <p className="muted small">Showing up to 100 recent records from the same Supabase attendance table as the Android app.</p>
      </div>
    </Shell>
  );
}
