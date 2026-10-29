import {attendanceLocationSelection, ALL_WORK_LOCATIONS, type WorkmateLocation} from '@/lib/attendance-location-filter';
import {attendanceFilterMatch,parseAttendanceFilter,attendanceStatus} from '@/lib/attendance-filters';
import {normalizeAttendanceRow} from '@/lib/attendance-rules';
import {classifyPunchSite} from '@/lib/attendance-location';
import {createAttendanceWorkbook,istDateTime,istToday,type XSheet} from '@/lib/attendance-xlsx';
import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/access';
import {isEarlyClockOut} from '@/lib/attendance-early-clockout';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type A=Record<string,unknown>;
type R={employee_id:string;full_name?:string;employee_code?:string;department_name?:string;effective_status?:string;attendance?:A};
const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
export async function GET(req:NextRequest){
 const {supabase}=await requireAdmin();const q=req.nextUrl.searchParams;
 const day=q.get('date')||istToday(),format=q.get('format')||'csv';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return NextResponse.json({error:'Invalid date'},{status:400});
 if(!['csv','xlsx'].includes(format))return NextResponse.json({error:'Invalid export format'},{status:400});
 const [report,holidayLookup]=await Promise.all([
  supabase.functions.invoke('organisation-attendance-report',{body:{date:day}}),
  supabase.from('holidays').select('id').eq('holiday_date',day).eq('is_active',true).limit(1),
 ]);
 const {data,error}=report;
 if(error||holidayLookup.error||!data?.success)return NextResponse.json({error:'Report or active holiday status unavailable'},{status:502});
 const dept=q.get('department')||'',term=(q.get('search')||'').toLowerCase();
 const status=parseAttendanceFilter(q.get('status'));
 const {data:sites,error:sitesError}=await supabase.from('office_locations').select('id,name,is_default').eq('is_active',true);
 if(sitesError)return NextResponse.json({error:'Cannot verify active office locations'},{status:502});
 const location=attendanceLocationSelection((sites||[]) as WorkmateLocation[],q.get('location'));
 if(!location.valid)return NextResponse.json({error:'Invalid work location.'},{status:400});
 const authorizedRows=((data.rows||[]) as R[]).map(row=>normalizeAttendanceRow(row,(holidayLookup.data??[]).length>0));
 const ids=authorizedRows.map(row=>row.employee_id);
 const assignedById=new Map<string,string|null>();
 for(let start=0;start<ids.length;start+=200){
  const result=await supabase.from('profiles').select('id,work_location_id').in('id',ids.slice(start,start+200));
  if(result.error)return NextResponse.json({error:'Unable to verify authorised work locations.'},{status:502});
  for(const item of result.data||[])assignedById.set(item.id,item.work_location_id);
 }
 if(assignedById.size!==ids.length)return NextResponse.json({error:'Some employee assignments are inaccessible.'},{status:502});
 const rows=authorizedRows.filter(r=>(location.selected===ALL_WORK_LOCATIONS||assignedById.get(r.employee_id)===location.selected)&&(!dept||r.department_name===dept)&&(!term||`${r.full_name||''} ${r.employee_code||''}`.toLowerCase().includes(term))&&attendanceFilterMatch(r,status));
 if(format==='csv'){
  // Preserve the old CSV download exactly. Plain CSV does not support workbook formatting.
  const lines=[['Name','Employee Code','Department','Status','Clock Out Label','Clock In','Clock Out','Late Minutes'].map(cell).join(',')];
  for(const r of rows){const a=r.attendance||{};lines.push([r.full_name,r.employee_code,r.department_name,r.effective_status,isEarlyClockOut(String(r.effective_status||''),typeof a.worked_minutes==='number'?a.worked_minutes:null,typeof a.required_work_minutes==='number'?a.required_work_minutes:null,Boolean(a.clock_out_at))?'Early Clock Out':'',a.clock_in_at||a.clock_in_time,a.clock_out_at||a.clock_out_time,a.late_minutes].map(cell).join(','));}
  return new NextResponse('\uFEFF'+lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="workmate-attendance-${day}.csv"`,'Cache-Control':'private, no-store'}});
 }
 try{
  const ids=rows.map(x=>x.employee_id);
  const {data:punchData,error:punchError}=rows.length?await supabase.from('attendance').select('employee_id,clock_in_location_id,clock_out_location_id').eq('attendance_date',day).in('employee_id',rows.map(r=>r.employee_id)):{data:[] as {employee_id:string;clock_in_location_id:string|null;clock_out_location_id:string|null}[],error:null};
  if(punchError)throw Error('Unable to verify punch locations.');
  const punchedById=new Map((punchData||[]).map(x=>[x.employee_id,x]));
  const nameById=new Map((sites||[]).map(x=>[x.id,x.name]));
  const presented=rows.map(r=>{
   const a=r.attendance||{};const inAt=a.clock_in_at||a.clock_in_time,outAt=a.clock_out_at||a.clock_out_time;
   const recorded=punchedById.get(r.employee_id),target=assignedById.get(r.employee_id);
   const inSite=classifyPunchSite(Boolean(inAt),target,recorded?.clock_in_location_id,nameById);
   const outSite=classifyPunchSite(Boolean(outAt),target,recorded?.clock_out_location_id,nameById);
   const label=(status:'ON_SITE'|'OFF_SITE'|'UNKNOWN'|'UNASSIGNED'|string|undefined)=>status==='ON_SITE'?'On-site':status==='OFF_SITE'?'Off-site':status==='UNASSIGNED'?'Unassigned':'Unknown';
   const site=(s:typeof inSite)=>s?.actualSite||'';
   const siteStatus=(s:typeof inSite)=>s?label(s.match):'';
   const assignedName=typeof target==='string'?nameById.get(target)||'Unknown':target===null?'Unassigned':'Unknown';
   return [r.full_name||'',r.employee_code||'',r.department_name||'',attendanceStatus(r).replaceAll('_',' '),isEarlyClockOut(attendanceStatus(r),typeof a.worked_minutes==='number'?a.worked_minutes:null,typeof a.required_work_minutes==='number'?a.required_work_minutes:null,Boolean(outAt))?'Early Clock Out':'',istDateTime(inAt),istDateTime(outAt),typeof a.late_minutes==='number'?a.late_minutes:'',assignedName,site(inSite),siteStatus(inSite),site(outSite),siteStatus(outSite),typeof a.worked_minutes==='number'?a.worked_minutes:''];
  });
  const sheet:XSheet={name:'Daily Attendance',title:'WORK MATE  |  DAILY ATTENDANCE',subtitle:`${day}  •  ${location.label}  •  ${rows.length} employees  •  India Standard Time`,
   note:'Live authorised employee data. Clock times formatted in IST; blank punch means no recorded punch. On-site/Off-site compares actual GPS-matched site to the current assigned site.',
   columns:[{label:'Employee name',width:32},{label:'Employee code',width:21},{label:'Department',width:26},{label:'Status',width:19},{label:'Clock Out Label',width:21},{label:'Clock In (IST)',width:23},{label:'Clock Out (IST)',width:23},{label:'Late (min)',width:15},{label:'Assigned site',width:26},{label:'Clock In site',width:27},{label:'In site status',width:18},{label:'Clock Out site',width:27},{label:'Out site status',width:19},{label:'Worked (min)',width:19}],
   rows:presented,statusColumns:[3,10,12],numericColumns:[7,13]};
  const bytes=await createAttendanceWorkbook([sheet]);
  return new NextResponse(new Uint8Array(bytes) as unknown as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="workmate-daily-attendance-${day}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('Daily XLSX export failed',e instanceof Error?e.message:'unknown');return NextResponse.json({error:'Unable to create an accurate Excel export. Please retry.'},{status:502});}
}
