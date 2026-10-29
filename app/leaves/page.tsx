import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import type {LeaveRecord} from '@/lib/leave-view';
import {stagingWriteError} from '@/lib/staging-write';
import LeaveDashboard from './leave-dashboard';

export default async function Leaves(){
  const {profile,supabase}=await requireProfile();
  const [requests,policy]=await Promise.all([
    supabase.from('leave_requests')
      .select('id,employee_id,leave_type,start_date,end_date,total_days,reason,status,review_note,reviewed_at,created_at')
      .eq('employee_id',profile.id).order('created_at',{ascending:false}).limit(150),
    supabase.from('leave_policies').select('monthly_paid_leave_days')
      .eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  const allowance=policy.data?Number(policy.data.monthly_paid_leave_days):null;
  return <Shell name={profile.full_name||'Staff'} role={profile.role}>
    <div className="eyebrow">MY WORKSPACE / LEAVE MANAGEMENT</div>
    <h1>My leaves</h1>
    <p className="muted">Request time off, check your monthly paid allowance, and follow every approval decision.</p>
    <LeaveDashboard initial={(requests.data??[]) as LeaveRecord[]}
      error={requests.error?.message??null}
      policyError={policy.error?.message??null}
      monthlyAllowance={allowance} readOnly={stagingWriteError()!==null}/>
  </Shell>;
}
