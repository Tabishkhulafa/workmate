/** Shared by the authorised organisation report and CSV export. */
export type AttendanceFilter = 'ALL'|'PRESENT'|'HALF_DAY'|'ABSENT'|'IN_PROGRESS'|'MISSING_CHECKOUT'|'NOT_MARKED'|'LATE';
export type AttendanceRowLike = {effective_status?:string|null; attendance?:Record<string,unknown>|null};

export function parseAttendanceFilter(raw:unknown):AttendanceFilter {
  const value=typeof raw==='string'?raw.toUpperCase():'';
  if(value==='PRESENT'||value==='HALF_DAY'||value==='ABSENT'||value==='IN_PROGRESS'||value==='MISSING_CHECKOUT'||value==='NOT_MARKED'||value==='LATE') return value;
  return 'ALL';
}
export function attendanceStatus(row:AttendanceRowLike):Exclude<AttendanceFilter,'ALL'|'LATE'> {
  const value=String(row.effective_status||'').trim().toUpperCase().replace(/\s+/g,'_');
  switch(value){
    case 'PRESENT':return 'PRESENT';
    case 'HALF_DAY':return 'HALF_DAY';
    case 'ABSENT':return 'ABSENT';
    case 'IN_PROGRESS':return 'IN_PROGRESS';
    case 'MISSING_CHECKOUT':return 'MISSING_CHECKOUT';
    default:return 'NOT_MARKED';
  }
}
export function attendanceIsLate(row:AttendanceRowLike):boolean {
  const a=row.attendance;
  return a?.is_late===true||String(a?.punctuality_status||'').toUpperCase().includes('LATE');
}
export function attendanceFilterMatch(row:AttendanceRowLike,filter:AttendanceFilter):boolean {
  return filter==='ALL'||(filter==='LATE'?attendanceIsLate(row):attendanceStatus(row)===filter);
}
export function attendanceFilterLabel(filter:AttendanceFilter):string {
  switch(filter){
    case 'ALL': return 'All staff';
    case 'PRESENT': return 'Present';
    case 'HALF_DAY': return 'Half day';
    case 'ABSENT': return 'Absent';
    case 'IN_PROGRESS': return 'In progress';
    case 'MISSING_CHECKOUT': return 'Missing Clock Out';
    case 'NOT_MARKED': return 'Not marked';
    case 'LATE': return 'Late';
  }
}
