import Link from 'next/link';
import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
export default async function Documents(){
 const {profile,supabase}=await requireAdmin();
 const {data,error}=await supabase.from('profiles').select('id,full_name,employee_code,role,is_active').eq('is_active',true).order('full_name').limit(200);
 return <Shell name={profile.full_name||'Team member'} role={profile.role}><div className="eyebrow">SENSITIVE INFORMATION</div><h1>Face &amp; KYC documents</h1>
 <p className="muted">Select an employee to open the authorized Aadhaar/PAN and enrolled-face viewers. Signed URLs are short-lived and identity-document views are audited.</p>
 {error?<div className="notice error">Unable to load employee directory: {error.message}</div>:<div className="card"><div className="tablewrap"><table className="wm-generic-table"><thead><tr><th>Employee</th><th>Employee code</th><th>Account type</th><th>Actions</th></tr></thead><tbody>{(data||[]).filter(x=>x.role!=='SUPER_ADMIN'&&(profile.role==='SUPER_ADMIN'||x.role!=='HR')).map(e=><tr key={e.id}><td>{e.full_name||'—'}</td><td>{e.employee_code||'—'}</td><td>{e.role.replaceAll('_',' ')}</td><td><div className="wm-doc-actions"><Link href={'/employees/'+e.id}>View face</Link><Link href={'/employees/'+e.id+'/private'}>Aadhaar / PAN details</Link></div></td></tr>)}</tbody></table></div>{!data?.length&&<p>No employees available.</p>}</div>}
 </Shell>;
}
