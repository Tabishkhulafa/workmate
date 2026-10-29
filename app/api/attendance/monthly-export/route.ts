import {attendanceLocationSelection, ALL_WORK_LOCATIONS, type WorkmateLocation} from '@/lib/attendance-location-filter';
import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/access';
import {createAttendanceWorkbook,istToday,type XSheet} from '@/lib/attendance-xlsx';
import {buildMonthlyResults,validMonth,type MonthPerson,type MonthPunch,type ApprovedLeave,type ApprovedWeeklyOff} from '@/lib/monthly-attendance-report';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const error=(message:string,status=502)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'private, no-store'}});

/** Fetch all pages; PostgREST ordinarily defaults to 1000 rows and silently truncates larger month reports. */
async function complete(fetch:(start:number,end:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>,limit=12000):Promise<unknown[]>{
 const items:unknown[]=[];const pageSize=500;
 for(let start=0;start<limit;start+=pageSize){const result=await fetch(start,start+pageSize-1);if(result.error)throw Error(result.error.message);const rows=result.data||[];items.push(...rows);if(rows.length<pageSize)return items;}
 throw Error('Report is too large; refine the month or filters.');
}
function sum<T>(values:T[],value:(x:T)=>number){return values.reduce((s,x)=>s+value(x),0);}
export async function GET(req:NextRequest){
 const {supabase}=await requireAdmin();
 const q=req.nextUrl.searchParams,today=istToday(),month=q.get('month')||today.slice(0,7);
 if(!validMonth(month)||month>today.slice(0,7))return error('Please select a valid current or past month.',400);
 const from=`${month}-01`,until=`${month}-31`,department=q.get('department')||'',search=(q.get('search')||'').trim().toLowerCase();
 if(search.length>160)return error('Search is too long.',400);
 try{
  const [profilesData,departmentData,attendanceData,leavesData,holidaysData,weeklyData,locationsData]=await Promise.all([
   complete((a,b)=>supabase.from('profiles').select('id,full_name,employee_code,department_id,role,weekly_off_day,date_of_joining,work_location_id').eq('is_active',true).in('role',['EMPLOYEE','DEPARTMENT_HEAD','HR']).order('id').range(a,b)),
   complete((a,b)=>supabase.from('departments').select('id,name').order('id').range(a,b)),
   complete((a,b)=>supabase.from('attendance').select('employee_id,attendance_date,clock_in_at,clock_out_at,attendance_status,worked_minutes,required_work_minutes,half_day_minutes,missing_checkout').gte('attendance_date',from).lte('attendance_date',until).order('attendance_date').order('id').range(a,b)),
   complete((a,b)=>supabase.from('leave_requests').select('employee_id,start_date,end_date,status').eq('status','APPROVED').lte('start_date',until).gte('end_date',from).order('id').range(a,b)),
   complete((a,b)=>supabase.from('holidays').select('holiday_date').eq('is_active',true).gte('holiday_date',from).lte('holiday_date',until).order('holiday_date').range(a,b)),
   complete((a,b)=>supabase.from('weekly_off_requests').select('employee_id,requested_day,status,reviewed_at').eq('status','APPROVED').not('reviewed_at','is',null).lte('reviewed_at',`${until}T23:59:59+05:30`).order('reviewed_at').range(a,b)),
   complete((a,b)=>supabase.from('office_locations').select('id,name,is_default').eq('is_active',true).order('id').range(a,b)),
  ]);
  const location=attendanceLocationSelection(locationsData as WorkmateLocation[],q.get('location'));
  if(!location.valid)return error('Invalid work location.',400);
  const deptById=new Map((departmentData as {id:string;name:string}[]).map(x=>[x.id,x.name]));
  const persons=(profilesData as (MonthPerson & {work_location_id:string|null})[]).filter(p=>{
   if(location.selected!==ALL_WORK_LOCATIONS&&p.work_location_id!==location.selected)return false;
   const name=deptById.get(p.department_id||'')||'Unassigned';return (!department||name===department)&&(!search||`${p.full_name||''} ${p.employee_code||''}`.toLowerCase().includes(search));
  }).sort((a,b)=>(a.full_name||'').localeCompare(b.full_name||''));
  const authorizedIds=new Set((profilesData as MonthPerson[]).map(x=>x.id));
  // We never use the service-role key in this export; all records remain RLS-scoped.
  const monthly=buildMonthlyResults({persons,punches:(attendanceData as MonthPunch[]).filter(x=>authorizedIds.has(x.employee_id)),leaves:(leavesData as ApprovedLeave[]).filter(x=>authorizedIds.has(x.employee_id)),weeklyOffRequests:(weeklyData as ApprovedWeeklyOff[]).filter(x=>authorizedIds.has(x.employee_id)),holidays:(holidaysData as {holiday_date:string}[]).map(x=>x.holiday_date),month,today});
  const detailsRows:(string|number)[][]=[];
  for(const r of monthly){for(const day of r.days){detailsRows.push([r.person.full_name||'',r.person.employee_code||'',deptById.get(r.person.department_id||'')||'Unassigned',day.date,day.day,day.status,day.earlyClockOut?'Early Clock Out':'']);}}
  const totalRow=['TOTAL', '', '',...(['present','earlyClockOut','absent','leave','halfDay','weeklyOff','holiday','notMarked','pending'] as const).map(k=>sum(monthly,r=>r.counts[k]))];
  const sheets:XSheet[]=[{
   name:'Monthly Summary',title:'WORK MATE  |  MONTHLY ATTENDANCE',subtitle:`${month}  •  ${location.label}  •  ${monthly.length} employees  •  Through ${(today<until?today:until)} (IST)`,
   note:'Absent = explicitly recorded absence only. Unmarked working days are separate. Half days, holidays and weekly offs are separate. Approved leave only. Historical weekly-off assignments may be incomplete.',
   columns:[{label:'Employee name',width:33},{label:'Employee code',width:20},{label:'Department',width:26},{label:'Present',width:14},{label:'Early Clock Out (days)',width:25},{label:'Absent',width:14},{label:'Approved leave',width:19},{label:'Half Day (days)',width:19},{label:'Weekly off',width:15},{label:'Holidays',width:14},{label:'Not marked',width:16},{label:'Pending punch',width:17}],
   rows:monthly.map(r=>[r.person.full_name||'',r.person.employee_code||'',deptById.get(r.person.department_id||'')||'Unassigned',r.counts.present,r.counts.earlyClockOut,r.counts.absent,r.counts.leave,r.counts.halfDay,r.counts.weeklyOff,r.counts.holiday,r.counts.notMarked,r.counts.pending]),totals:totalRow,numericColumns:[3,4,5,6,7,8,9,10,11],
  },{
   name:'Daily Breakdown',title:'WORK MATE  |  DAY-BY-DAY DETAIL',subtitle:`${month}  •  Audit-friendly source breakdown`,
   note:'One row per employee per applicable date; dates before recorded joining are omitted. Not Marked is not automatically counted as Absent. HR leave visibility may exclude other HR accounts.',
   columns:[{label:'Employee name',width:33},{label:'Employee code',width:20},{label:'Department',width:27},{label:'Date',width:17},{label:'Weekday',width:17},{label:'Status',width:24},{label:'Clock Out Label',width:22}],rows:detailsRows,statusColumns:[5],
  }];
  const binary=await createAttendanceWorkbook(sheets);
  return new NextResponse(new Uint8Array(binary) as unknown as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="workmate-monthly-attendance-${month}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('Monthly attendance export failed',e instanceof Error?e.message:'unknown');return error('Monthly report could not be completed. No partial or estimated counts were exported.');}
}
