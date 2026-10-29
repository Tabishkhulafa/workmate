import Link from 'next/link';
import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import {KycViewer} from './kyc-client';

const fields:[string,string][]=[
 ['current_address','Current address'],['permanent_address','Permanent address'],
 ['emergency_contact_1_name','Emergency contact 1'],['emergency_contact_1_relation','Relationship'],['emergency_contact_1_phone','Emergency mobile 1'],
 ['emergency_contact_2_name','Emergency contact 2'],['emergency_contact_2_relation','Relationship'],['emergency_contact_2_phone','Emergency mobile 2'],
 ['blood_group','Blood group'],['bank_account_holder','Account holder'],['bank_name','Bank'],['bank_ifsc','IFSC'],['bank_branch','Branch']
];
type Details=Record<string,unknown>;
export default async function PrivateDetailsPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {supabase,profile}=await requireAdmin();
 if(!/^[0-9a-f-]{36}$/i.test(id)) return <Shell name={profile.full_name||'Admin'} role={profile.role}><h1>Invalid employee ID</h1></Shell>;
 const {data:employee}=await supabase.from('profiles').select('id,full_name,employee_code,role').eq('id',id).maybeSingle();
 const {data,error}=await supabase.functions.invoke('employee-private-details',{body:{employee_id:id}});
 const details=((data as {details?:Details}|null)?.details??{}) as Details;
 const message=error?.message || ((data as {error?:string}|null)?.error??'');
 const account=String(details.bank_account_number??'');
 return <Shell name={profile.full_name||'Admin'} role={profile.role}>
  <div className="eyebrow">SECURE EMPLOYEE RECORD</div><h1>{employee?.full_name||'Employee'} — Private details</h1>
  <p className="muted">Employee code: {employee?.employee_code||'—'}</p>
  <p><Link href={'/employees/'+id}>← Employee details</Link></p>
  {message?<div className="notice error" role="alert">{message}</div>:<section className="card"><h2>Personal and emergency details</h2><div className="details">{fields.map(([key,label])=><div key={key}><small>{label}</small><b>{String(details[key]??'—')}</b></div>)}<div><small>Bank account</small><b>{account?'•••• '+account.slice(-4):'—'}</b></div></div><p className="muted small">Full account number hidden in web UI. Access is restricted by the existing Supabase function.</p></section>}
  {employee&&<KycViewer employeeId={id}/>}
 </Shell>
}
