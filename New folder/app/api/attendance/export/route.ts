import {attendanceFilterMatch,parseAttendanceFilter} from '@/lib/attendance-filters';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';
type A=Record<string,unknown>;type R={full_name?:string;employee_code?:string;department_name?:string;effective_status?:string;attendance?:A};
const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
export async function GET(req:NextRequest){const {supabase}=await requireAdmin();const q=req.nextUrl.searchParams;
 const day=q.get('date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return NextResponse.json({error:'Invalid date'},{status:400});
 const {data,error}=await supabase.functions.invoke('organisation-attendance-report',{body:{date:day}});
 if(error||!data?.success)return NextResponse.json({error:'Report unavailable'},{status:502});
 const dept=q.get('department')||'',term=(q.get('search')||'').toLowerCase();
 const status=parseAttendanceFilter(q.get('status'));
 const rows=((data.rows||[]) as R[]).filter(r=>(!dept||r.department_name===dept)&&(!term||`${r.full_name||''} ${r.employee_code||''}`.toLowerCase().includes(term))&&attendanceFilterMatch(r,status));
 const lines=[['Name','Employee Code','Department','Status','Clock In','Clock Out','Late Minutes'].map(cell).join(',')];
 for(const r of rows){const a=r.attendance||{};lines.push([r.full_name,r.employee_code,r.department_name,r.effective_status,a.clock_in_at||a.clock_in_time,a.clock_out_at||a.clock_out_time,a.late_minutes].map(cell).join(','));}
 return new NextResponse('\uFEFF'+lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="workmate-attendance-${day}.csv"`,'Cache-Control':'private, no-store'}});
}
