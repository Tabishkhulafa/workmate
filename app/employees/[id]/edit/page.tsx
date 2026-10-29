import Link from 'next/link';
import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import EditForm from './edit-form';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditEmployee({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const {supabase,profile}=await requireAdmin();
  if(!UUID.test(id)) return <Shell name={profile.full_name||'Administrator'} role={profile.role}><h1>Invalid employee</h1><Link href="/employees">Back to employees</Link></Shell>;
  const [{data:employee,error},{data:departments,error:deptError}]=await Promise.all([
    supabase.from('profiles').select('id,full_name,designation,department_id,role,is_active').eq('id',id).maybeSingle(),
    supabase.from('departments').select('id,name,is_active').eq('is_active',true).order('name').limit(300),
  ]);
  const forbidden=employee?.role==='SUPER_ADMIN'||(profile.role==='HR'&&employee?.role==='HR');
  return <Shell name={profile.full_name||'Administrator'} role={profile.role}>
    <div className="eyebrow">PEOPLE / EDIT</div>
    <h1>Edit employee</h1>
    {error||!employee?<div className="notice error">Employee unavailable or access denied.</div>
      :forbidden?<div className="notice error">You do not have permission to edit this account.</div>
      :employee.is_active!==true?<div className="notice error">Inactive employee accounts cannot be edited.</div>
      :deptError?<div className="notice error">Departments could not be loaded.</div>
      :<EditForm employee={employee} departments={departments||[]}/>}
    <p><Link href={'/employees/'+id}>← Employee details</Link></p>
  </Shell>;
}
