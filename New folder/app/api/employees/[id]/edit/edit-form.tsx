'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Employee={id:string;full_name:string|null;designation:string|null;department_id:string|null;role:string};
export default function EditForm({employee,departments}:{employee:Employee;departments:{id:string;name:string}[]}){
 const [name,setName]=useState(employee.full_name||'');
 const [designation,setDesignation]=useState(employee.designation||'');
 const [department,setDepartment]=useState(employee.department_id||'');
 const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState('');
 const router=useRouter();
 async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;
  setBusy(true);setFeedback('');
  try{
   const res=await fetch('/api/proxy/update-staff-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employee_id:employee.id,full_name:name.trim(),designation:designation.trim(),department_id:department})});
   const result=await res.json();if(!res.ok||result?.error)throw Error(result?.error||'Update failed');
   router.refresh();router.push('/employees/'+employee.id);
  }catch(error){setFeedback(error instanceof Error?error.message:'Unable to save changes');}
  finally{setBusy(false)}
 }
 return <form className="card" onSubmit={save} style={{maxWidth:650}}>
 <p className="muted">Update employee name, designation and department. HR cannot edit HR/Super Admin accounts. Weekly-off rules follow the department automatically.</p>
 <label>Full name<input value={name} onChange={e=>setName(e.target.value)} maxLength={150} required/></label>
 <label>Designation<input value={designation} onChange={e=>setDesignation(e.target.value)} maxLength={150} required/></label>
 <label>Department<select value={department} onChange={e=>setDepartment(e.target.value)} required><option value="">Choose department</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 <p className="muted">Role, credentials, face data, identity and banking details are not editable from this form.</p>
 <button disabled={busy||!name.trim()||!designation.trim()||!department} type="submit">{busy?'Saving…':'Save changes'}</button>
 {feedback&&<p role="alert" className="notice error">{feedback}</p>}
 </form>
}
