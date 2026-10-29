'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

type Employee={id:string;full_name:string|null;designation:string|null;department_id:string|null;role:string};
export default function EditForm({employee,departments}:{employee:Employee;departments:{id:string;name:string}[]}) {
  const [name,setName]=useState(employee.full_name||'');
  const [designation,setDesignation]=useState(employee.designation||'');
  const [department,setDepartment]=useState(employee.department_id||'');
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const router=useRouter();
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;
    setBusy(true);setFeedback('');
    try{
      const response=await fetch('/api/employees/'+encodeURIComponent(employee.id)+'/update',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({full_name:name.trim(),designation:designation.trim(),department_id:department}),
      });
      const data=await response.json().catch(()=>({error:'Unexpected server response'}));
      if(!response.ok||data?.error||data?.success===false)throw Error(data?.error||'Update failed');
      router.push('/employees/'+employee.id);router.refresh();
    }catch(error){setFeedback(error instanceof Error?error.message:'Unable to save employee');}
    finally{setBusy(false);}
  }
  return <form className="card" onSubmit={save} style={{maxWidth:690,display:'grid',gap:14}}>
    <p className="muted">Update employee name, designation and department. Account role and credentials are not changed.</p>
    <label>Full name<input value={name} onChange={e=>setName(e.target.value)} maxLength={150} required/></label>
    <label>Role / designation<input value={designation} onChange={e=>setDesignation(e.target.value)} maxLength={150} required/></label>
    <label>Department<select value={department} onChange={e=>setDepartment(e.target.value)} required><option value="">Select department</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <p className="muted">Weekly off follows the employee's department. Account type, face and private identity details stay unchanged.</p>
    {feedback&&<p role="alert" className="notice error">{feedback}</p>}
    <button type="submit" disabled={busy||!name.trim()||!designation.trim()||!department}>{busy?'Saving…':'Save changes'}</button>
  </form>;
}
