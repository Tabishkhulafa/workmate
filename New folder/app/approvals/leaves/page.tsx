import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import {ApprovalTable} from '@/components/approval-table';
import {enrichApprovalRows} from '@/lib/approval-employees';

export default async function LeaveApprovals(){
  const {profile,supabase}=await requireProfile();
  if(!['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role))redirect('/dashboard');
  const {data,error}=await supabase.from('leave_requests')
    .select('id,employee_id,status,start_date,end_date,leave_type')
    .eq('status','PENDING').neq('employee_id',profile.id)
    .order('created_at',{ascending:true}).limit(100);
  const rows=error?[]:await enrichApprovalRows(supabase,data||[]);
  return <Shell name={profile.full_name||''} role={profile.role}>
    <div className="eyebrow">TEAM APPROVALS</div>
    <h1>Leave requests</h1>
    {error?<p className="notice error">Unable to load requests: {error.message}</p>:<ApprovalTable kind="leave" initial={rows}/>}
  </Shell>;
}
