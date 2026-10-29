import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';
import { ApprovalTable } from '@/components/approval-table';
import { enrichApprovalRows } from '@/lib/approval-employees';

export default async function RegularizationApprovals() {
  const { profile, supabase } = await requireProfile();
  if (!['HR', 'SUPER_ADMIN', 'DEPARTMENT_HEAD'].includes(profile.role)) redirect('/dashboard');
  const { data, error } = await supabase.from('attendance_regularizations')
    .select('id,employee_id,status,attendance_date,request_type,reason,requested_clock_in,requested_clock_out,original_clock_in,original_clock_out')
    .eq('status', 'PENDING').neq('employee_id', profile.id)
    .order('created_at', { ascending: true }).limit(100);
  const rows = error ? [] : await enrichApprovalRows(supabase, data || []);
  return (
    <Shell name={profile.full_name || ''} role={profile.role}>
      <div className="eyebrow">TEAM APPROVALS</div>
      <h1>Regularization requests</h1>
      <p className="muted">Review requested Clock In / Clock Out changes in IST before approving. Other punches remain unchanged.</p>
      {error
        ? <p className="notice error">Unable to load requests: {error.message}</p>
        : <ApprovalTable kind="regularization" initial={rows} />}
    </Shell>
  );
}
