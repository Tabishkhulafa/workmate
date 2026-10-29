/** Read-only weekly-off status derivation; NEVER alters existing attendance records. */
export type WeeklyOffApproval = {
  employee_id: string;
  requested_day: string;
  reviewed_at: string | null;
  status?: string;
};
export type WeeklyOffWorkplace = 'OFFICE' | 'STORE' | 'WAREHOUSE' | string | null;
export const REQUEST_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY'] as const;
export function indiaDate(instant: string): string {
  const dt = new Date(instant);
  if (Number.isNaN(dt.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(dt);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function weekDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const d=new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==day) return '';
  return ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][d.getUTCDay()];
}
export function assignedOffOnDate(args:{employeeId:string; workplace:WeeklyOffWorkplace; day:string; approvals:WeeklyOffApproval[]; legacyDay?:string|null}):boolean {
  const {employeeId,workplace,day,approvals,legacyDay}=args;
  const weekday=weekDay(day);
  if(!weekday) return false;
  if(workplace==='OFFICE') return weekday==='SUNDAY';
  if(workplace!=='STORE' && workplace!=='WAREHOUSE') return weekday===String(legacyDay||'').toUpperCase();
  // Never apply current profile.weekly_off_day retroactively to store/warehouse.
  // A reviewed, approved request becomes effective on its review date (IST).
  const latest=approvals.filter(a=>a.employee_id===employeeId && a.status==='APPROVED' && a.reviewed_at &&
    indiaDate(a.reviewed_at)<=day && REQUEST_DAYS.some(d=>d===a.requested_day))
    .sort((a,b)=>Date.parse(b.reviewed_at||'')-Date.parse(a.reviewed_at||''))[0];
  return Boolean(latest && latest.requested_day===weekday);
}
