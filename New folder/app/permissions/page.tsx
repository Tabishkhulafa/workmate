import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import { PermissionManager } from './permission-manager';

type Employee = { id:string; full_name:string|null; employee_code:string|null; role:string; department_id:string|null };
export default async function PermissionsPage(){
 const {supabase,profile}=await requireAdmin();
 const {data,error}=await supabase.from('profiles').select('id,full_name,employee_code,role,department_id').eq('is_active',true).in('role',['EMPLOYEE','DEPARTMENT_HEAD','HR']).order('full_name').limit(500);
 const {data:departments}=await supabase.from('departments').select('id,name').eq('is_active',true);
 return <Shell name={profile.full_name||'Administrator'} role={profile.role}>
 <div className="eyebrow">ATTENDANCE SECURITY</div><h1>Temporary button attendance</h1>
 <p className="muted">Grant or revoke a time-limited exception when a face scanner cannot be used. GPS and attendance backend checks remain separate.</p>
 {error?<div className="notice error">Employees could not be loaded: {error.message}</div>:<PermissionManager employees={(data||[]) as Employee[]} departments={departments||[]}/>}
 </Shell>;
}
