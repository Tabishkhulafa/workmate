/** Date-only helpers: leave dates must not shift with browser timezone. */
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveType = 'PAID' | 'UNPAID' | 'OTHER';
export type LeaveRecord = {
  id:string;
  employee_id:string;
  leave_type:string;
  start_date:string;
  end_date:string;
  total_days:number | string | null;
  reason:string;
  status:string;
  review_note:string | null;
  reviewed_at:string | null;
  created_at:string;
};
const isoDate=/^(\d{4})-(\d{2})-(\d{2})$/;
export function validDate(date:string):boolean {
  const match=isoDate.exec(date);
  if(!match)return false;
  const time=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));
  return new Date(time).toISOString().slice(0,10)===date;
}
export function dayNumber(date:string):number|null {return validDate(date)?Date.parse(`${date}T00:00:00Z`)/86400000:null;}
export function daysInclusive(from:string,to:string):number {
  const a=dayNumber(from),b=dayNumber(to);
  return a!==null&&b!==null&&b>=a?b-a+1:0;
}
export function monthKey(date:string):string{return validDate(date)?date.slice(0,7):'';}
export function monthOverlapDays(from:string,to:string,month:string):number {
  if(!/^\d{4}-\d{2}$/.test(month))return 0;
  const first=`${month}-01`;
  const [y,m]=month.split('-').map(Number);
  const last=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
  const lo=from>first?from:first,hi=to<last?to:last;
  return daysInclusive(lo,hi);
}
export function paidUsedInMonth(rows:LeaveRecord[],month:string):number {
  return rows.filter(r=>r.status==='APPROVED'&&r.leave_type==='PAID')
    .reduce((sum,r)=>sum+monthOverlapDays(r.start_date,r.end_date,month),0);
}
export function paidPendingInMonth(rows:LeaveRecord[],month:string):number {
  return rows.filter(r=>r.status==='PENDING'&&r.leave_type==='PAID')
    .reduce((sum,r)=>sum+monthOverlapDays(r.start_date,r.end_date,month),0);
}
export function indiaToday():string {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function displayDate(value:string):string {
  if(!validDate(value))return value||'—';
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})
    .format(new Date(`${value}T12:00:00Z`));
}
export function displayMonth(value:string):string {
  return /^\d{4}-\d{2}$/.test(value)?new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`)):value;
}
export function leaveLabel(value:string):string {
  return value==='PAID'?'Paid leave':value==='UNPAID'?'Unpaid leave':value==='OTHER'?'Other leave':value;
}
export function statusLabel(value:string):string {
  return value==='PENDING'?'Pending approval':value==='APPROVED'?'Approved':value==='REJECTED'?'Rejected':value;
}
