import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import EditForm from './edit-form';
import Link from 'next/link';
export default async function EditEmployee({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {supabase,profile}=await requireAdmin();
 const [{data:employee,error},{data:departments}]=await Promise.all([
  supabase.from('profiles').select('id,full_name,designation,department_id,role').eq('id',id).maybeSingle(),
  supabase.from('departments').select('id,name,is_active').eq('is_active',true).order('name')
 ]);
 if(employee?.role==='SUPER_ADMIN'||(profile.role==='HR'&&employee?.role==='HR')){
  return <Shell name={profile.full_name||'Administrator'} role={profile.role}><h1>Employee editing restricted</h1><p>This role cannot be edited from your account.</p><Link href="/employees">Back</Link></Shell>;
 }
 return <Shell name={profile.full_name||'Administrator'} role={profile.role}><div className="eyebrow">PEOPLE / EDIT</div><h1>Edit employee</h1>{error||!employee?<div className="notice error">Employee unavailable or access denied.</div>:<EditForm employee={employee} departments={departments||[]}/>}<p><Link href={'/employees/'+id}>← Employee details</Link></p></Shell>;
}
