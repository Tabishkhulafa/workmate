import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
type Emp={id:string;full_name?:string|null;employee_code?:string|null;role?:string|null;email?:string|null;phone?:string|null};
export default async function DepartmentEmployees(){
 const {supabase,profile}=await requireProfile();
 if(profile.role!=='DEPARTMENT_HEAD')redirect('/dashboard');
 const {data,error}=await supabase.functions.invoke('department-overview',{body:{mode:'EMPLOYEES'}});
 const result=data as {success?:boolean;employees?:Emp[];department?:{name?:string};error?:string}|null;
 const employees=result?.success?(result.employees||[]):[];
 return <Shell name={profile.full_name||''} role={profile.role}><div className="eyebrow">MY DEPARTMENT</div><h1>Department employees</h1><p className="muted">Only employees in your assigned department.</p>
 {error||!result?.success?<p className="notice error">{result?.error||error?.message||'Unable to load department staff'}</p>:<><div className="statgrid"><div className="stat"><strong>{employees.length}</strong><span>{result.department?.name||'My department'} employees</span></div></div><div className="card tablewrap"><table><thead><tr><th>Employee</th><th>Code</th><th>Role</th><th>Email</th><th>Mobile</th></tr></thead><tbody>{employees.map(e=><tr key={e.id}><td>{e.full_name||'—'}</td><td>{e.employee_code||'—'}</td><td>{String(e.role||'EMPLOYEE').replaceAll('_',' ')}</td><td>{e.email||'—'}</td><td>{e.phone||'—'}</td></tr>)}</tbody></table>{employees.length===0&&<p className="muted">No active employees assigned.</p>}</div></>}
 </Shell>;
}
