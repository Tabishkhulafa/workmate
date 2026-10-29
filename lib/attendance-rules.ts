/** Read-only derived display status. Does NOT rewrite previously saved attendance. */
export type AttendanceDisplayRow={effective_status?:string|null;attendance?:object|null;day_type?:string|null};
const validTime=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
function durationMinutes(a:Record<string,unknown>):number|null{
 const stored=a.worked_minutes;
 if(typeof stored==='number'&&Number.isFinite(stored)&&stored>=0)return stored;
 const start=a.clock_in_at,end=a.clock_out_at;
 if(!validTime(start)||!validTime(end))return null;
 const diff=Date.parse(end)-Date.parse(start);
 return Number.isFinite(diff)&&diff>=0?Math.floor(diff/60000):null;
}
export function normalizeAttendanceRow<T extends AttendanceDisplayRow>(row:T,activeHoliday:boolean):T {
 const attendance=row.attendance as Record<string,unknown>|null|undefined;
 const clockIn=attendance&&(validTime(attendance.clock_in_at)||validTime(attendance.clock_in_time));
 const clockOut=attendance&&(validTime(attendance.clock_out_at)||validTime(attendance.clock_out_time));
 let status:string;
 if(!clockIn)status=activeHoliday?'HOLIDAY':'NOT_MARKED';
 else if(!clockOut){
  // The backend owns the missing-checkout decision. Never downgrade a finalized
  // missing checkout to IN_PROGRESS just because clock_out_at is empty.
  const storedStatus=String(attendance?.attendance_status ?? '').toUpperCase();
  const reportStatus=String(row.effective_status ?? '').toUpperCase();
  status=attendance?.missing_checkout===true || storedStatus==='MISSING_CHECKOUT' ||
    reportStatus==='MISSING_CHECKOUT' ? 'MISSING_CHECKOUT' : 'IN_PROGRESS';
 }
 else{
  const worked=durationMinutes(attendance!);
  if(worked===null)status='IN_PROGRESS';
  else{
   const full=typeof attendance!.required_work_minutes==='number'&&attendance!.required_work_minutes>0?attendance!.required_work_minutes:540;
   const half=typeof attendance!.half_day_minutes==='number'&&attendance!.half_day_minutes>0?attendance!.half_day_minutes:270;
   status=(worked>=full || (String(attendance!.attendance_status ?? '').toUpperCase()==='PRESENT' && worked>=Math.max(half,full-15)))?'PRESENT':worked>=half?'HALF_DAY':'ABSENT';
  }
 }
 return {...row,effective_status:status,day_type:!activeHoliday&&row.day_type==='HOLIDAY'?'WORKING_DAY':row.day_type};
}
