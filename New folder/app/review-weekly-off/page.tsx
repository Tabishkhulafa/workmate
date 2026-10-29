import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import WeeklyOffReview from './review-client';
type Req={id:string;employee_id:string;requested_day:string;reason:string|null;created_at:string;status:string};
export default async function ReviewWeeklyOff(){
 const {supabase,profile}=await requireProfile();if(!['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role))redirect('/dashboard');
 const {data,error}=await supabase.from('weekly_off_requests').select('id,employee_id,requested_day,reason,created_at,status').eq('status','PENDING').neq('employee_id',profile.id).order('created_at',{ascending:true}).limit(100);
 const requests=(data||[]) as Req[];
 const ids=requests.map(item=>item.employee_id);
 const {data:subjects, error:subjectsError}=ids.length?await supabase.from('profiles').select('id,role,department_id').in('id',ids):{data:[],error:null};
 const allowed=new Set((subjects||[]).filter(subject=>profile.role==='SUPER_ADMIN'||(profile.role==='HR'&&['EMPLOYEE','DEPARTMENT_HEAD'].includes(subject.role))||(profile.role==='DEPARTMENT_HEAD'&&subject.role==='EMPLOYEE'&&subject.department_id===profile.department_id)).map(subject=>subject.id));
 const visible=requests.filter(item=>allowed.has(item.employee_id));
 return <Shell name={profile.full_name||''} role={profile.role}><div className="eyebrow">APPROVALS</div><h1>Review weekly off</h1><p className="muted">Review pending requests in your authorized scope.</p>{error||subjectsError?<p className="notice error">Unable to load pending requests: {error?.message||subjectsError?.message}</p>:<WeeklyOffReview initial={visible}/>}</Shell>;
}
