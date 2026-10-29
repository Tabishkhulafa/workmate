import ArchiveEmployeeButton from '@/components/archive-employee-button';
import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import Link from 'next/link';
import {FacePhotoViewer} from '@/components/face-photo-viewer';

export default async function EmployeeDetail({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const {profile,supabase}=await requireAdmin();
 const {data,error}=await supabase.from('profiles').select('id,full_name,employee_code,email,phone,role,designation,department_id,is_active').eq('id',id).maybeSingle();
 let department='Not assigned';
 if(data?.department_id){
  const {data:dept}=await supabase.from('departments').select('name').eq('id',data.department_id).maybeSingle();
  department=dept?.name||'Department unavailable';
 }
 const fields:[string,string][]=[['full_name','Full name'],['employee_code','Employee code'],['email','Email'],['phone','Mobile'],['role','Account type'],['designation','Designation'],['department','Department'],['is_active','Status']];
 const values:Record<string,unknown>={...data,department,is_active:data?.is_active?'Active':'Inactive'};
 return <Shell name={profile.full_name||'Administrator'} role={profile.role}>
  <div className="eyebrow">EMPLOYEE RECORD</div><h1>{data?.full_name||'Employee details'}</h1>
  <p className="muted">Employee information and authorized identity access.</p>
  {error||!data?<div className="notice error">Employee record unavailable or access denied.</div>:<>
   <section className="card wm-elevated"><h2>Employee information</h2><div className="details">{fields.map(([key,label])=><div key={key}><small>{label}</small><b>{String(values[key]??'—').replaceAll('_',' ')}</b></div>)}</div></section>
   <div className="wm-link-actions"><Link className="buttonlink" href={`/employees/${id}/edit`}>Edit employee</Link><Link className="buttonlink" href={`/employees/${id}/private`}>Private details &amp; Aadhaar/PAN</Link></div>
   <FacePhotoViewer employeeId={data.id}/> <ArchiveEmployeeButton employeeId={data.id} employeeName={data.full_name || "Employee"} employeeCode={data.employee_code || ""} employeeRole={data.role} employeeActive={data.is_active === true} viewerRole={profile.role} isSelf={profile.id === data.id} />
  </>}
  <p><Link href="/employees">← Back to employee directory</Link></p>
 </Shell>;
}
