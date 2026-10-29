import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import DepartmentManager from '@/components/department-manager';
export default async function Page(){
 const {profile,supabase}=await requireAdmin();
 const {data,error}=await supabase.from('departments').select('id,name,code,department_type,is_active').eq('is_active',true).order('name').limit(200);
 return <Shell name={profile.full_name||'Team member'} role={profile.role}><div className="eyebrow">WORK MATE</div><h1>Departments</h1>
 {error?<div className="notice error">{error.message}</div>:<DepartmentManager departments={data||[]}/>}</Shell>;
}
