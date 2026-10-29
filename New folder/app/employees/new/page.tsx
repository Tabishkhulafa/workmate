import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import EmployeeForm from './staff-form';
export default async function NewEmployee(){const {profile,supabase}=await requireAdmin();const {data:departments}=await supabase.from('departments').select('id,name').eq('is_active',true).order('name');
return <Shell name={profile.full_name||'Administrator'} role={profile.role}><div className="eyebrow">STAFF MANAGEMENT</div><h1>Add employee</h1><p className="muted">Creates a real Supabase Auth account through the existing create-employee function.</p><EmployeeForm departments={departments||[]} allowAdmin={profile.role==='SUPER_ADMIN'}/></Shell>}
