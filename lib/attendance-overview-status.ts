/** Work Mate organisation attendance OVERVIEW ONLY. No database updates. */
export type OverviewStatusRow = {
  effective_status?: string | null;
  attendance?: Record<string, unknown> | null;
  day_type?: string | null;
};

const IST = 'Asia/Kolkata';

function istDateAndMinute(now: Date): { date: string; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (kind: string): string => parts.find(p => p.type === kind)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Read-only absent display after the employee's effective shift start + grace.
 * We never guess when shift configuration is missing; holidays, approved leave,
 * weekly offs and punches stay untouched. No Supabase writes.
 */
export function applyShiftAwareCutoff<T extends OverviewStatusRow>(
  normalized:T, original:OverviewStatusRow, selectedDate:string, now:Date,
  shiftStart:string|null, graceMinutes:number|null,
):T {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))return normalized;
  if(String(normalized.effective_status??'').toUpperCase()!=='NOT_MARKED')return normalized;
  const originalStatus=String(original.effective_status??'').toUpperCase();
  const dayType=String(normalized.day_type??original.day_type??'').toUpperCase();
  if(['WEEKLY_OFF','LEAVE','APPROVED_LEAVE','ON_LEAVE'].includes(originalStatus)||
     ['HOLIDAY','WEEKLY_OFF','LEAVE','APPROVED_LEAVE'].includes(dayType))return normalized;
  const attendance=original.attendance;
  if(attendance && [attendance.clock_in_at,attendance.clock_in_time].some(v=>typeof v==='string'&&v.trim()))return normalized;
  const match=shiftStart?.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if(!match||graceMinutes===null||!Number.isInteger(graceMinutes)||graceMinutes<0)return normalized;
  const hh=Number(match[1]),mm=Number(match[2]);
  if(hh>23||mm>59)return normalized;
  const local=istDateAndMinute(now);
  if(selectedDate>local.date)return normalized;
  if(selectedDate===local.date&&local.minute<=hh*60+mm+graceMinutes)return normalized;
  return {...normalized,effective_status:'ABSENT'};
}

/** The Present overview KPI includes employees currently clocked in.
 * In Progress remains a separate subset card. Charts use exclusive buckets.
 */
export function isOverviewPresent(row: OverviewStatusRow): boolean {
  const status = String(row.effective_status ?? '').toUpperCase();
  return status === 'PRESENT' || status === 'IN_PROGRESS';
}
