import styles from './responsive-attendance-list.module.css';
import {isEarlyClockOut} from '@/lib/attendance-early-clockout';

/** This is presentation-only: employee visibility and date filtering are enforced by the report page. */
type Row = {
  employee_id: string;
  full_name: string | null;
  employee_code: string | null;
  department_name: string | null;
  effective_status: string;
  attendance: Record<string, unknown> | null;
};

type Punch = { time: string; dateNote?: string };
const istTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
});
const istDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
const shortIstDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
});

function indiaDateKey(value: Date): string {
  const parts = istDate.formatToParts(value);
  const read = (name: string) => parts.find(part => part.type === name)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

function wallClock(hour: number, minute: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

function punch(value: unknown, selectedDate: string): Punch {
  if (typeof value !== 'string' || !value.trim()) return { time: '—' };
  const v = value.trim();
  // Time-only database values have no timezone: do not apply UTC conversion.
  const timeOnly = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v);
  if (timeOnly) return { time: wallClock(Number(timeOnly[1]), Number(timeOnly[2])) };
  // Only ISO values WITH timezone information represent UTC instants.
  if (/^\d{4}-\d{2}-\d{2}T/.test(v) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v)) {
    const date = new Date(v);
    if (Number.isFinite(date.getTime())) {
      const localDate = indiaDateKey(date);
      return {
        time: istTime.format(date),
        dateNote: localDate !== selectedDate ? shortIstDate.format(date) : undefined,
      };
    }
  }
  // A timezone-less ISO timestamp is already a wall time; preserve its hours.
  const localDateTime = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(v);
  if (localDateTime) return {
    time: wallClock(Number(localDateTime[2]), Number(localDateTime[3])),
    dateNote: localDateTime[1] !== selectedDate ? localDateTime[1] : undefined,
  };
  return { time: v };
}

function text(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '—';
}

function displayStatus(value: string): string {
  return text(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function statusTone(value: string): string {
  switch (value.toUpperCase()) {
    case 'PRESENT': return styles.present;
    case 'HALF_DAY': return styles.half;
    case 'ABSENT': return styles.absent;
    case 'IN_PROGRESS': return styles.progress;
    case 'HOLIDAY': case 'WEEKLY_OFF': return styles.holiday;
    case 'MISSING_CHECKOUT': return styles.missing;
    default: return styles.notMarked;
  }
}

function status(value: string, attendance?: Record<string,unknown> | null) {
  const rawMinutes = attendance?.worked_minutes;
  const rawRequired = attendance?.required_work_minutes;
  const worked = typeof rawMinutes === 'number' ? rawMinutes : null;
  const required = typeof rawRequired === 'number' ? rawRequired : null;
  const early = isEarlyClockOut(value.toUpperCase(),worked,required,Boolean(attendance?.clock_out_at));
  return <span style={{display:'inline-flex',flexWrap:'wrap',gap:5,alignItems:'center'}}>
    <span className={`${styles.status} ${statusTone(value)}`}>{displayStatus(value)}</span>
    {early && <span title="Present with 15-minute early clock-out grace" style={{borderRadius:999,padding:'5px 8px',fontSize:11,fontWeight:700,color:'#925500',background:'#FFF4DE',whiteSpace:'nowrap'}}>Early Clock Out</span>}
  </span>;
}

function clock(p: Punch) {
  return <span className={styles.clock}><strong>{p.time}</strong>{p.dateNote && <small>{p.dateNote}</small>}</span>;
}

function lateLabel(value: unknown): string {
  const n = typeof value === 'number' ? value :
    typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? `${Math.round(n)} min` : '—';
}

function minutesWorked(value: unknown): string {
  const n = typeof value === 'number' ? value :
    typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return '—';
  const minutes = Math.floor(n);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export default function ResponsiveAttendanceList({ rows, date }: { rows: Row[]; date: string }) {
  return (
    <section className={styles.panel} aria-label="Employee attendance details">
      <div className={styles.header}>
        <div>
          <h3>Employee attendance</h3>
          <p>{dateLabel(date)} · India Standard Time</p>
        </div>
        <span className={styles.count}>{rows.length} {rows.length === 1 ? 'employee' : 'employees'}</span>
      </div>

      {rows.length ? <div className={styles.content}>
        <div className={styles.desktop}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Employee attendance for {dateLabel(date)}</caption>
            <colgroup>
              <col style={{width:'24%'}}/><col style={{width:'19%'}}/>
              <col style={{width:'15%'}}/><col style={{width:'14%'}}/>
              <col style={{width:'14%'}}/><col style={{width:'14%'}}/>
            </colgroup>
            <thead><tr>
              <th scope="col">Employee / Code</th>
              <th scope="col">Department</th>
              <th scope="col">Status</th>
              <th scope="col">Clock in</th>
              <th scope="col">Clock out</th>
              <th scope="col">Late</th>
            </tr></thead>
            <tbody>{rows.map(row => {
              const a = row.attendance;
              const clockIn = punch(a?.clock_in_at ?? a?.clock_in_time, date);
              const clockOut = punch(a?.clock_out_at ?? a?.clock_out_time, date);
              return <tr key={row.employee_id}>
                <td><div className={styles.person}>
                  <strong>{text(row.full_name)}</strong>
                  <span>{text(row.employee_code)}</span>
                </div></td>
                <td><span className={styles.department}>{text(row.department_name)}</span></td>
                <td>{status(row.effective_status,row.attendance)}</td>
                <td>{clock(clockIn)}</td>
                <td>{clock(clockOut)}</td>
                <td><span className={styles.late}>{lateLabel(a?.late_minutes)}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className={styles.cards} aria-label="Employee attendance cards">
          {rows.map(row => {
            const a = row.attendance;
            return <article className={styles.employeeCard} key={row.employee_id}>
              <div className={styles.cardHeader}>
                <div className={styles.person}><strong>{text(row.full_name)}</strong><span>{text(row.employee_code)} · {text(row.department_name)}</span></div>
                {status(row.effective_status,row.attendance)}
              </div>
              <dl className={styles.cardDetails}>
                <div><dt>Clock in</dt><dd>{clock(punch(a?.clock_in_at ?? a?.clock_in_time, date))}</dd></div>
                <div><dt>Clock out</dt><dd>{clock(punch(a?.clock_out_at ?? a?.clock_out_time, date))}</dd></div>
                <div><dt>Worked</dt><dd>{minutesWorked(a?.worked_minutes)}</dd></div>
                <div><dt>Late</dt><dd>{lateLabel(a?.late_minutes)}</dd></div>
              </dl>
            </article>;
          })}
        </div>
      </div> : <p className={styles.empty}>No employees match the selected date or filters.</p>}
    </section>
  );
}
