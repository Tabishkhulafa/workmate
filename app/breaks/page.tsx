import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import BreaksClient from './breaks-client';
import {breakWorkplace,indiaDay,indiaDayBounds,isBreakReviewer,isBreakUser,validDay,type BreakRow, type BreakSchedule, type BreakWorkplacePolicy} from '@/lib/breaks';
import {stagingWriteError} from '@/lib/staging-write';

export const dynamic='force-dynamic';
const fields='id,employee_id,started_at,ended_at,reason';

export default async function Breaks({searchParams}:{searchParams:Promise<{date?:string}>}){
 const {profile,supabase}=await requireProfile();
 const params=await searchParams;
 const today=indiaDay();
 const date=validDay(params.date||'')?params.date!:today;
 const {from,to}=indiaDayBounds(date);
 const isUser=isBreakUser(profile.role);
 const isReviewer=isBreakReviewer(profile.role);
 const safeEmpty={data:[] as Record<string,unknown>[],error:null};
 const [scheduleResult,ownResult,activeResult,reviewResult,punchResult,workplacePoliciesResult,workplaceProfileResult]=await Promise.all([
  supabase.from('workmate_break_schedule').select('weekday,start_time,end_time,updated_at').order('weekday',{ascending:true}),
  isUser?supabase.from('workmate_random_breaks').select(fields).eq('employee_id',profile.id).gte('started_at',from).lt('started_at',to).order('started_at',{ascending:false}).limit(500):Promise.resolve(safeEmpty),
  isUser?supabase.from('workmate_random_breaks').select(fields).eq('employee_id',profile.id).is('ended_at',null).limit(1):Promise.resolve(safeEmpty),
  isReviewer?supabase.from('workmate_random_breaks').select(fields).neq('employee_id',profile.id).gte('started_at',from).lt('started_at',to).order('started_at',{ascending:false}).limit(500):Promise.resolve(safeEmpty),
  isUser?supabase.from('attendance').select('clock_in_at').eq('employee_id',profile.id).is('clock_out_at',null).gte('attendance_date',indiaDay(new Date(Date.now()-86400000))).order('clock_in_at',{ascending:false}).limit(2):Promise.resolve(safeEmpty),
  supabase.from('workmate_break_workplace_settings').select('workplace_type,is_enabled,updated_at').order('workplace_type',{ascending:true}),
  isUser?supabase.from('profiles').select('workplace_type,department_id').eq('id',profile.id).maybeSingle():Promise.resolve({data:null,error:null}),
 ]);
 const own=(ownResult.data??[]) as BreakRow[];
 const active=(activeResult.data??[]) as BreakRow[];
 const ownMap=new Map([...active,...own].map(r=>[r.id,r]));
 const ownRows=[...ownMap.values()].sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
 const managerRows=(reviewResult.data??[]) as BreakRow[];
 const ids=[...new Set(managerRows.map(r=>r.employee_id))];
 const {data:people,error:peopleError}=ids.length?await supabase.from('profiles')
  .select('id,full_name,employee_code,department_id,role').in('id',ids):{data:[],error:null};
 const deptIds=[...new Set((people??[]).map(p=>p.department_id).filter((id):id is string=>Boolean(id)))];
 const {data:departments,error:deptError}=deptIds.length?await supabase.from('departments').select('id,name').in('id',deptIds):{data:[],error:null};
 const byPerson=new Map((people??[]).map(p=>[p.id,p]));
 const byDepartment=new Map((departments??[]).map(d=>[d.id,d.name]));
 // Row Level Security is authoritative; do not widen results with a service key.
 const reviewRows=managerRows.filter(row=>byPerson.has(row.employee_id)).map(row=>{
  const p=byPerson.get(row.employee_id)!;
  return {...row,employee_name:p.full_name||'Staff member',employee_code:p.employee_code||'',department_name:p.department_id?byDepartment.get(p.department_id)||'Unassigned':'Unassigned'};
 });
 const canClockBreak=Boolean((punchResult.data??[]).some(r=>r.clock_in_at&&Date.parse(String(r.clock_in_at))>=Date.now()-86400000));
 let departmentType:unknown=null;
 let departmentLookupError:string|null=null;
 if(isUser && workplaceProfileResult.data && !breakWorkplace(workplaceProfileResult.data.workplace_type) && workplaceProfileResult.data.department_id){
  const {data:department,error:departmentError}=await supabase.from('departments')
    .select('department_type').eq('id',workplaceProfileResult.data.department_id).maybeSingle();
  if(departmentError)departmentLookupError=departmentError.message;
  departmentType=department?.department_type;
 }
 const workplace=breakWorkplace(workplaceProfileResult.data?.workplace_type,departmentType);
 const workplacePolicies=(workplacePoliciesResult.data??[]) as BreakWorkplacePolicy[];
 const issues=[scheduleResult.error,ownResult.error,activeResult.error,reviewResult.error,punchResult.error,peopleError,deptError,workplacePoliciesResult.error,workplaceProfileResult.error]
  .filter((e):e is NonNullable<typeof e>=>Boolean(e)).map(e=>e.message);
 if(departmentLookupError)issues.push(departmentLookupError);
 return <Shell name={profile.full_name||'Work Mate'} role={profile.role}>
  <BreaksClient role={profile.role} name={profile.full_name||'You'} date={date} today={today}
    schedule={(scheduleResult.data??[]) as BreakSchedule[]} workplace={workplace} workplacePolicies={workplacePolicies}
    mine={ownRows} team={reviewRows} canClockBreak={canClockBreak}
    disabledReason={stagingWriteError()} issues={issues}/>
 </Shell>;
}
