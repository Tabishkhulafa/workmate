'use client';
import {useState} from 'react';
import Link from 'next/link';
type Dept={id:string;name:string};
const designations=['Customer Support','HR Executive','HR Manager','Web Developer','Frontend Developer','Backend Developer','Full Stack Developer','Software Developer','IT Support','Marketing Executive','Digital Marketing','SEO Executive','Graphic Designer','Video Editor','Sales Executive','Sales Manager','Accountant','Operations Executive','Warehouse Executive','Store Manager','Department Head','Office Administrator','Other'];
export default function EmployeeForm({departments,allowAdmin}:{departments:Dept[];allowAdmin:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[designation,setDesignation]=useState('Customer Support'),[customDesignation,setCustomDesignation]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();if(busy)return;
 const form=e.currentTarget;const fields=Object.fromEntries(new FormData(form).entries());
 const email=String(fields.email||'').trim(),phone=String(fields.phone||'').trim();
 if(!email&&!phone){setMessage('Employee email or 10-digit mobile is required.');return;}
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setMessage('Enter a valid employee email address.');return;}
 for(const key of ['phone','emergency_contact_1_phone','emergency_contact_2_phone']){
  const number=String(fields[key]||'').trim();
  if(number&&!/^\d{10}$/.test(number)){setMessage(`${key.replaceAll('_',' ')} must be exactly 10 digits.`);return;}
 }
 setBusy(true);setMessage('');
 const body={full_name:fields.full_name,employee_code:fields.employee_code,email:fields.email,phone:fields.phone,password:fields.password,role:fields.role,designation:designation==='Other'?customDesignation.trim():designation,department_id:fields.department_id||null,private_details:Object.fromEntries(['current_address','permanent_address','emergency_contact_1_name','emergency_contact_1_relation','emergency_contact_1_phone','emergency_contact_2_name','emergency_contact_2_relation','emergency_contact_2_phone','blood_group','bank_account_holder','bank_name','bank_account_number','bank_ifsc','bank_branch'].map(k=>[k,fields[k]||'']))};
 try{const r=await fetch('/api/employees/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to create employee');setMessage('Employee created successfully.');form.reset();}catch(error){setMessage(error instanceof Error?error.message:'Creation failed')}finally{setBusy(false)}}
 const field=(name:string,title:string,type='text',required=false)=><label key={name}>{title}<input name={name} type={type} required={required}/></label>;
 return <form onSubmit={submit} className="card w3form"><div className="formgrid">{field('full_name','Full name','text',true)}{field('employee_code','Employee code','text',true)}{field('email','Email','email')}{<label>Mobile (10 digits)<input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Exactly 10 digits" autoComplete="tel-national"/></label>}{field('password','Initial password','password',true)}
 <label>Account type<select name="role" required><option value="EMPLOYEE">Employee</option><option value="DEPARTMENT_HEAD">Department Head</option>{allowAdmin&&<><option value="HR">HR</option><option value="SUPER_ADMIN">Super Admin</option></>}</select></label>
 <label>Role / Designation<select value={designation} onChange={e=>setDesignation(e.target.value)}>{designations.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 {designation==='Other'&&<label>Other designation<input value={customDesignation} onChange={e=>setCustomDesignation(e.target.value)} required maxLength={100}/></label>}
 <label>Department<select name="department_id"><option value="">Select department</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label></div>
 <h3>Personal and emergency details</h3><div className="formgrid">{['current_address','permanent_address','emergency_contact_1_name','emergency_contact_1_relation','emergency_contact_1_phone','emergency_contact_2_name','emergency_contact_2_relation','emergency_contact_2_phone','blood_group'].map(k=>k.endsWith('_phone')?<label key={k}>{k.replaceAll('_',' ')}<input name={k} type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" title="Exactly 10 digits"/></label>:field(k,k.replaceAll('_',' ')))}</div><h3>Bank details — restricted</h3><div className="formgrid">{['bank_account_holder','bank_name','bank_account_number','bank_ifsc','bank_branch'].map(k=>field(k,k.replaceAll('_',' ')))}</div>
 {message&&<div className="notice" role="status">{message}</div>}<div className="reportactions"><button disabled={busy||designation==='Other'&&!customDesignation.trim()}>{busy?'Creating...':'Create employee'}</button><Link href="/employees">Back to employees</Link></div></form>;
}
