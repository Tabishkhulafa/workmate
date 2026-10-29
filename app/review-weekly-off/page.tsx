import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import {stagingWriteError} from '@/lib/staging-write';
import WeeklyOffReview from './review-client';
type Req={id:string;employee_id:string;requested_day:string;reason:string|null;created_at:string;status:string;reviewed_at:string|null;review_note:string|null};
export default async function ReviewWeeklyOff(){
 const {supabase,profile}=await requireProfile();
 if(!['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role))redirect('/dashboard');
 const {data,error}=await supabase.from('weekly_off_requests')
  .select('id,employee_id,requested_day,reason,created_at,status,reviewed_at,review_note')
  .neq('employee_id',profile.id).order('created_at',{ascending:false}).limit(250);
 const requests=(data||[]) as Req[];
 const ids=[...new Set(requests.map(item=>item.employee_id))];
 const [subjectsResult,departmentsResult]=await Promise.all([
  ids.length?supabase.from('profiles').select('id,full_name,employee_code,role,department_id,workplace_type').in('id',ids):Promise.resolve({data:[],error:null}),
  supabase.from('departments').select('id,name,department_type'),
 ]);
 const subjects=subjectsResult.data??[];
 const deptNames=new Map((departmentsResult.data??[]).map(d=>[d.id,d.name]));
 const deptTypes=new Map((departmentsResult.data??[]).map(d=>[d.id,d.department_type]));
 const byId=new Map(subjects.map(s=>[s.id,s]));
 const visible=requests.filter(item=>{
  const s=byId.get(item.employee_id);if(!s)return false;
  const workplace=s.workplace_type ?? deptTypes.get(s.department_id) ?? null;
  if(!['STORE','WAREHOUSE'].includes(String(workplace)))return false;
  return profile.role==='SUPER_ADMIN'||(profile.role==='HR'&&['EMPLOYEE','DEPARTMENT_HEAD'].includes(s.role))||
   (profile.role==='DEPARTMENT_HEAD'&&s.role==='EMPLOYEE'&&!!profile.department_id&&s.department_id===profile.department_id);
 }).map(item=>{const s=byId.get(item.employee_id)!;return {...item,employee_name:s.full_name||'Employee',employee_code:s.employee_code||'',department_name:deptNames.get(s.department_id)||'Unassigned',workplace:s.workplace_type||deptTypes.get(s.department_id)||'Unknown'};});
 const issue=error?.message||subjectsResult.error?.message||departmentsResult.error?.message;
 return <Shell name={profile.full_name||''} role={profile.role}>
  <div className="eyebrow">TEAM APPROVALS</div><h1>Review weekly off</h1><p className="muted">Store/Warehouse: Monday–Thursday only. Department Head reviews own team; HR reviews staff and department heads; Super Admin reviews all.</p>
  {issue?<p className="notice error">Cannot load weekly-off requests: {issue}</p>:<WeeklyOffReview initial={visible} blockedReason={stagingWriteError()}/>} 
 </Shell>;
}
