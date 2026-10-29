import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import {enrichApprovalRows} from '@/lib/approval-employees';
import {stagingWriteError} from '@/lib/staging-write';
import LeaveReviewBoard,{type ReviewLeave} from './leave-review-board';

export default async function LeaveApprovals(){
  const {profile,supabase}=await requireProfile();
  if(!['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role))redirect('/dashboard');
  const {data,error}=await supabase.from('leave_requests')
    .select('id,employee_id,status,start_date,end_date,total_days,leave_type,reason,review_note,reviewed_at,created_at')
    .neq('employee_id',profile.id).order('created_at',{ascending:false}).limit(200);
  const enriched=error?[]:await enrichApprovalRows(supabase,data??[]);
  const uniqueIds=[...new Set(enriched.map(row=>row.employee_id))];
  const {data:people,error:scopeError}=uniqueIds.length?await supabase.from('profiles')
    .select('id,role,department_id').in('id',uniqueIds):{data:[],error:null};
  const byId=new Map((people??[]).map(p=>[p.id,p]));
  // Only show requests that the matching review-leave Edge Function permits.
  // Supabase RLS remains authoritative for which rows can be loaded at all.
  const visible=enriched.filter(row=>{
    const person=byId.get(row.employee_id);
    if(!person)return false;
    if(profile.role==='SUPER_ADMIN')return ['HR','DEPARTMENT_HEAD','EMPLOYEE'].includes(person.role);
    if(profile.role==='HR')return ['DEPARTMENT_HEAD','EMPLOYEE'].includes(person.role);
    return person.role==='EMPLOYEE'&&!!profile.department_id&&person.department_id===profile.department_id;
  }) as ReviewLeave[];
  return <Shell name={profile.full_name||''} role={profile.role}>
    <div className="eyebrow">TEAM APPROVALS / LEAVE MANAGEMENT</div>
    <h1>Leave requests</h1>
    <p className="muted">Review your team&apos;s requests and track decisions. Employees see the updated status in My leaves.</p>
    {error||scopeError?<p className="notice error" role="alert">Unable to load requests: {error?.message??scopeError?.message}</p>:<LeaveReviewBoard initial={visible} readOnly={stagingWriteError()!==null}/>}
  </Shell>;
}
