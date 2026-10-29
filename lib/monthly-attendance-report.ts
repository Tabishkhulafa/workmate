/** Pure, read-only monthly attendance classification for authorised HR/Admin exports. */
import {workStatus,isEarlyClockOut} from '@/lib/attendance-early-clockout';
export type MonthPerson={id:string;full_name:string|null;employee_code:string|null;department_id:string|null;role:string;weekly_off_day:string|null;date_of_joining:string|null};
export type MonthPunch={employee_id:string;attendance_date:string;clock_in_at:string|null;clock_out_at:string|null;attendance_status:string|null;worked_minutes:number|null;required_work_minutes:number|null;half_day_minutes:number|null;missing_checkout:boolean|null};
export type ApprovedLeave={employee_id:string;start_date:string;end_date:string;status:string};
export type ApprovedWeeklyOff={employee_id:string;requested_day:string;status:string;reviewed_at:string|null};
export type DayStatus='PRESENT'|'HALF_DAY'|'ABSENT'|'LEAVE'|'WEEKLY_OFF'|'HOLIDAY'|'NOT_MARKED'|'IN_PROGRESS'|'MISSING_CHECKOUT';
export type DayDetail={date:string;day:string;status:DayStatus;earlyClockOut?:boolean};
export type MonthCounts={present:number;earlyClockOut:number;absent:number;leave:number;halfDay:number;weeklyOff:number;holiday:number;notMarked:number;pending:number};
export type MonthlyPersonResult={person:MonthPerson;counts:MonthCounts;days:DayDetail[]};
const days=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
export function validMonth(v:string):boolean {return /^\d{4}-(0[1-9]|1[0-2])$/.test(v)&&Number(v.slice(0,4))>=2000&&Number(v.slice(0,4))<=2100;}
export function monthDates(month:string,through:string){if(!validMonth(month))throw Error('Invalid month');const yr=Number(month.slice(0,4)),mo=Number(month.slice(5,7));const last=new Date(Date.UTC(yr,mo,0)).getUTCDate();const list:string[]=[];for(let d=1;d<=last;d++){const date=`${month}-${String(d).padStart(2,'0')}`;if(date>through)break;list.push(date);}return list;}
export function weekday(date:string){return days[new Date(`${date}T12:00:00Z`).getUTCDay()];}
// Approved changes become effective starting on the India-local approval date.
export function reviewIstDate(ts:string):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts));}
function workDayForDate(person:MonthPerson,date:string,requests:ApprovedWeeklyOff[]):string{
 const relevant=requests.filter(r=>r.employee_id===person.id&&r.status==='APPROVED'&&!!r.reviewed_at&&reviewIstDate(r.reviewed_at!)<=date).sort((a,b)=>String(b.reviewed_at).localeCompare(String(a.reviewed_at)));
 return String(relevant[0]?.requested_day||person.weekly_off_day||'').toUpperCase();
}
function punchedStatus(row:MonthPunch):DayStatus{
 const inTime=typeof row.clock_in_at==='string'&&row.clock_in_at.length>0;
 const outTime=typeof row.clock_out_at==='string'&&row.clock_out_at.length>0;
 if(!inTime){return String(row.attendance_status).toUpperCase()==='ABSENT'?'ABSENT':'NOT_MARKED';}
 if(!outTime)return row.missing_checkout?'MISSING_CHECKOUT':'IN_PROGRESS';
 const calculated=Date.parse(row.clock_out_at!)-Date.parse(row.clock_in_at!);
 const minutes=typeof row.worked_minutes==='number'&&row.worked_minutes>=0?row.worked_minutes:Number.isFinite(calculated)&&calculated>=0?Math.floor(calculated/60000):null;
 if(minutes===null)return 'MISSING_CHECKOUT';
 const full=typeof row.required_work_minutes==='number'&&row.required_work_minutes>0?row.required_work_minutes:540;
 const half=typeof row.half_day_minutes==='number'&&row.half_day_minutes>0?row.half_day_minutes:270;
 // Historical statuses are authoritative; do not silently reclassify past payroll.
 const saved=String(row.attendance_status||'').toUpperCase();
 if(saved==='PRESENT'||saved==='HALF_DAY'||saved==='ABSENT')return saved;
 return workStatus(minutes,full,half);
}
export function buildMonthlyResults(input:{persons:MonthPerson[];punches:MonthPunch[];leaves:ApprovedLeave[];weeklyOffRequests:ApprovedWeeklyOff[];holidays:string[];month:string;today:string}):MonthlyPersonResult[]{
 const dates=monthDates(input.month,input.today),holidaySet=new Set(input.holidays);
 const byPunch=new Map<string,MonthPunch>();for(const p of input.punches)byPunch.set(`${p.employee_id}|${p.attendance_date}`,p);
 const leaveById=new Map<string,ApprovedLeave[]>();for(const l of input.leaves){if(l.status!=='APPROVED')continue;const a=leaveById.get(l.employee_id)||[];a.push(l);leaveById.set(l.employee_id,a);}
 const weekById=new Map<string,ApprovedWeeklyOff[]>();for(const w of input.weeklyOffRequests){if(w.status!=='APPROVED'||!w.reviewed_at)continue;const a=weekById.get(w.employee_id)||[];a.push(w);weekById.set(w.employee_id,a);}
 return input.persons.map(person=>{
  const counts:MonthCounts={present:0,earlyClockOut:0,absent:0,leave:0,halfDay:0,weeklyOff:0,holiday:0,notMarked:0,pending:0};
  const daysOut:DayDetail[]=[];
  const offs=weekById.get(person.id)||[];
  const baseline=String(person.weekly_off_day||'').toUpperCase();
  const approvals=offs.slice().sort((a,b)=>String(a.reviewed_at).localeCompare(String(b.reviewed_at)));
  // Current assigned day is not a reliable snapshot before the first approved change.
  // If an approved change exists in this period, show earlier dates as unverified instead of retroactively applying its day.
  for(const date of dates){
   if(person.date_of_joining&&date<person.date_of_joining)continue;
   let status:DayStatus;
   const row=byPunch.get(`${person.id}|${date}`);
   if(row)status=punchedStatus(row);
   else if((leaveById.get(person.id)||[]).some(l=>l.start_date<=date&&l.end_date>=date))status='LEAVE';
   else if(holidaySet.has(date))status='HOLIDAY';
   else {
    const applied=approvals.filter(w=>reviewIstDate(w.reviewed_at!)<=date);
    const uncertain=approvals.length>0&&applied.length===0;
    const weekly=uncertain?'':workDayForDate(person,date,offs);
    status=weekly===weekday(date)?'WEEKLY_OFF':'NOT_MARKED';
    if(uncertain&&baseline===weekday(date))status='NOT_MARKED';
   }
   if(status==='PRESENT')counts.present++;
   else if(status==='ABSENT')counts.absent++;
   else if(status==='LEAVE')counts.leave++;
   else if(status==='HALF_DAY')counts.halfDay++;
   else if(status==='WEEKLY_OFF')counts.weeklyOff++;
   else if(status==='HOLIDAY')counts.holiday++;
   else if(status==='NOT_MARKED')counts.notMarked++;
   else counts.pending++;
   // Label only a completed Present punch with 15-minute grace; do not count it as half-day.
   const recordedMinutes=row&&typeof row.worked_minutes==='number'?row.worked_minutes:
     row?.clock_in_at&&row?.clock_out_at?Math.floor((Date.parse(row.clock_out_at)-Date.parse(row.clock_in_at))/60000):null;
   const earlyClockOut=Boolean(row&&isEarlyClockOut(status,recordedMinutes,row.required_work_minutes,Boolean(row.clock_out_at)));
   if(earlyClockOut)counts.earlyClockOut++;
   daysOut.push({date,day:weekday(date),status,earlyClockOut});
  }
  return {person,counts,days:daysOut};
 });
}
