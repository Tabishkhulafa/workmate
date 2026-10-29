import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import {stagingWriteError} from '@/lib/staging-write';
import WeeklyOffClient from './weekly-off-client';

type RequestRow={id:string;requested_day:string;reason:string|null;status:string;created_at:string;reviewed_at:string|null;review_note:string|null};
export default async function WeeklyOffPage(){
 const {profile,supabase}=await requireProfile();
 const [assignment,history]=await Promise.all([
  supabase.from('profiles').select('workplace_type,weekly_off_day,department_id').eq('id',profile.id).single(),
  supabase.from('weekly_off_requests').select('id,requested_day,reason,status,created_at,reviewed_at,review_note').eq('employee_id',profile.id).order('created_at',{ascending:false}).limit(100),
 ]);
 const department=assignment.data?.department_id
  ? await supabase.from('departments').select('department_type').eq('id',assignment.data.department_id).maybeSingle()
  : null;
 const workplace=assignment.data?.workplace_type??department?.data?.department_type??null;
 const allowed=workplace==='STORE'||workplace==='WAREHOUSE';
 const err=assignment.error?.message||history.error?.message||department?.error?.message;
 return <Shell name={profile.full_name||'Team member'} role={profile.role}>
  <section className="wo-page">
   <div className="eyebrow">WORK MATE / WEEKLY OFF</div><h1>My weekly off</h1>
   <p className="muted">Store/Warehouse staff can request one recurring day from Monday to Thursday. Approval is required before it becomes your weekly off.</p>
   {err?<div className="notice error" role="alert">Unable to load weekly-off information: {err}</div>:<WeeklyOffClient
    workplace={workplace} activeDay={assignment.data?.weekly_off_day??null} history={(history.data??[]) as RequestRow[]}
    canRequest={allowed&&['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(profile.role)}
    blockedReason={stagingWriteError()}/>} 
  </section>
 </Shell>;
}
