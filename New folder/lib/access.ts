import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
export type StaffRole = 'EMPLOYEE' | 'DEPARTMENT_HEAD' | 'HR' | 'SUPER_ADMIN';
export async function requireProfile() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.from('profiles')
    .select('id,full_name,employee_code,email,role,department_id,is_active,must_change_password')
    .eq('id', user.id).single();
  if (error || !data || data.is_active !== true) redirect('/login?error=profile');
  // Web must never unlock password-pending accounts until enforcement is integrated.
  if (data.must_change_password === true) redirect('/initial-password');
  return { supabase, profile: data as typeof data & { role: StaffRole } };
}
export async function requireAdmin() {
  const result = await requireProfile();
  if (!['HR','SUPER_ADMIN'].includes(result.profile.role)) redirect('/dashboard');
  return result;
}
