import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import EmployeeForm from './staff-form';

export default async function NewEmployee() {
  const { profile, supabase } = await requireAdmin();

  // Both dropdowns come from existing active records. Keep the queries read-only.
  const [departmentsResult, locationsResult] = await Promise.all([
    supabase
      .from('departments')
      .select('id,name')
      .eq('is_active', true)
      .order('name')
      .limit(200),
    supabase
      .from('office_locations')
      .select('id,name,address')
      .eq('is_active', true)
      .order('name')
      .limit(200),
  ]);

  return (
    <Shell name={profile.full_name || 'Administrator'} role={profile.role}>
      <div className="eyebrow">STAFF MANAGEMENT</div>
      <h1>Add employee</h1>
      <p className="muted">Creates an employee account through the existing create-employee function.</p>
      {departmentsResult.error && (
        <div className="notice error" role="alert">Could not load departments. Refresh before creating an employee.</div>
      )}
      {locationsResult.error && (
        <div className="notice error" role="alert">Could not load work locations. Check your permissions or try again.</div>
      )}
      <EmployeeForm
        departments={departmentsResult.data ?? []}
        locations={locationsResult.data ?? []}
        allowAdmin={profile.role === 'SUPER_ADMIN'}
        referenceDataReady={!departmentsResult.error && !locationsResult.error}
      />
    </Shell>
  );
}
