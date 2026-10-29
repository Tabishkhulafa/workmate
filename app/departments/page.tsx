import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import DepartmentManager from '@/components/department-manager';

export default async function Page() {
  const { profile, supabase } = await requireAdmin();
  // Both read-only queries can run concurrently. Permissions stay enforced by RLS.
  const [{ data, error }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from('departments')
      .select('id,name,code,department_type,is_active,head_user_id')
      .eq('is_active', true).order('name').limit(200),
    supabase.from('profiles')
      .select('id,full_name,employee_code,department_id,role')
      .eq('is_active', true).in('role', ['EMPLOYEE', 'DEPARTMENT_HEAD'])
      .order('full_name').limit(500),
  ]);
  return <Shell name={profile.full_name || 'Team member'} role={profile.role}>
    <div className="eyebrow">WORK MATE</div>
    <h1>Departments</h1>
    {error ? <div className="notice error">{error.message}</div> : <>
      <DepartmentManager departments={data || []} staff={staff || []}/>
      {staffError && <p className="notice error">Unable to load department head candidates.</p>}
    </>}
  </Shell>;
}
