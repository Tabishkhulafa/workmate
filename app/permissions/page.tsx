import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import { PermissionManager } from './permission-manager';

type Employee = { id:string; full_name:string|null; employee_code:string|null; role:string; department_id:string|null };
export default async function PermissionsPage(){
 const {supabase,profile}=await requireAdmin();
 const eligibleRoles=profile.role==='HR'?['EMPLOYEE','DEPARTMENT_HEAD']:['EMPLOYEE','DEPARTMENT_HEAD','HR'];
 const [{data,error},{data:departments}] = await Promise.all([
  supabase.from('profiles').select('id,full_name,employee_code,role,department_id').eq('is_active',true).in('role',eligibleRoles).order('full_name').limit(500),
  supabase.from('departments').select('id,name').eq('is_active',true),
 ]);
 return <Shell name={profile.full_name||'Administrator'} role={profile.role}>
 <div className="eyebrow">ATTENDANCE SECURITY</div><h1>Temporary button attendance</h1>
 <p className="muted">Enable button attendance when face scanning is unavailable. Access stays enabled until HR/Admin revokes it; GPS and backend checks still apply.</p>
 {profile.role==='HR'&&<p className="muted">HR may manage Employee and Department Head accounts only. HR account exceptions require Super Admin approval.</p>}
 {error?<div className="notice error">Employees could not be loaded: {error.message}</div>:<PermissionManager employees={(data||[]) as Employee[]} departments={departments||[]}/>}
 </Shell>;
}
