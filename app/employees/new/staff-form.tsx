'use client';
import {useState} from 'react';
import Link from 'next/link';
type Dept={id:string;name:string};
type WorkLocation={id:string;name:string;address:string|null};
const workplaces=[
 {value:'OFFICE',label:'Office'},
 {value:'STORE',label:'Store'},
 {value:'WAREHOUSE',label:'Warehouse'},
] as const;
const validJoiningDate=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(`${value}T00:00:00.000Z`);
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
};
const designations=['Customer Support','HR Executive','HR Manager','Web Developer','Frontend Developer','Backend Developer','Full Stack Developer','Software Developer','IT Support','Marketing Executive','Digital Marketing','SEO Executive','Graphic Designer','Video Editor','Sales Executive','Sales Manager','Accountant','Operations Executive','Warehouse Executive','Store Manager','Department Head','Office Administrator','Other'];
export default function EmployeeForm({departments,locations,allowAdmin,referenceDataReady}:{departments:Dept[];locations:WorkLocation[];allowAdmin:boolean;referenceDataReady:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[designation,setDesignation]=useState('Customer Support'),[customDesignation,setCustomDesignation]=useState(''),[accountRole,setAccountRole]=useState('EMPLOYEE');
 async function submit(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();if(busy)return;
 const form=e.currentTarget;const fields=Object.fromEntries(new FormData(form).entries());
 const email=String(fields.email||'').trim(),phone=String(fields.phone||'').trim();
 const dateOfJoining=String(fields.date_of_joining||'').trim();
 const workplace=String(fields.workplace_type||'').trim();
 const workLocationId=String(fields.work_location_id||'').trim();
 const departmentId=String(fields.department_id||'').trim();
 if(accountRole==='DEPARTMENT_HEAD'&&!departments.some(d=>d.id===departmentId)){setMessage('Select the department before creating a Department Head.');return;}
 if(!referenceDataReady||locations.length===0){setMessage('Active work locations are unavailable. Ask HR or Super Admin to configure locations first.');return;}
 if(!validJoiningDate(dateOfJoining)){setMessage('Select a valid Date of Joining.');return;}
 if(!workplaces.some(item=>item.value===workplace)){setMessage('Select a Workplace: Office, Store or Warehouse.');return;}
 if(!locations.some(location=>location.id===workLocationId)){setMessage('Select an active Work Location.');return;}
 if(!email&&!phone){setMessage('Employee email or 10-digit mobile is required.');return;}
 if(email&&!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)){setMessage('Enter a valid employee email address.');return;}
 for(const key of ['phone','emergency_contact_1_phone','emergency_contact_2_phone']){
  const number=String(fields[key]||'').trim();
  if(number&&!/^\d{10}$/.test(number)){setMessage(`${key.replaceAll('_',' ')} must be exactly 10 digits.`);return;}
 }
 if(accountRole==='DEPARTMENT_HEAD' && !window.confirm('Assign this employee as Department Head? If the department already has a Head, the existing Head will automatically become Employee.')) return;
 setBusy(true);setMessage('');
 const body={full_name:fields.full_name,employee_code:fields.employee_code,email:fields.email,phone:fields.phone,password:fields.password,role:fields.role,designation:designation==='Other'?customDesignation.trim():designation,department_id:fields.department_id||null,date_of_joining:dateOfJoining,workplace_type:workplace,work_location_id:workLocationId,private_details:Object.fromEntries(['current_address','permanent_address','emergency_contact_1_name','emergency_contact_1_relation','emergency_contact_1_phone','emergency_contact_2_name','emergency_contact_2_relation','emergency_contact_2_phone','blood_group','bank_account_holder','bank_name','bank_account_number','bank_ifsc','bank_branch'].map(k=>[k,fields[k]||'']))};
 try{const r=await fetch('/api/employees/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){if(data.employee_created===true){setMessage(data.error||'Employee account created but Head assignment failed. Go to Departments > Assign Head. Do not create the account again.');form.reset();setAccountRole('EMPLOYEE');return;}throw Error(data.error||'Unable to create employee');}setMessage(accountRole==='DEPARTMENT_HEAD'?'Department Head created and assigned successfully. Previous Head is now Employee.':'Employee created successfully.');form.reset();setAccountRole('EMPLOYEE');}catch(error){setMessage(error instanceof Error?error.message:'Creation failed')}finally{setBusy(false)}}
 const field=(name:string,title:string,type='text',required=false)=><label key={name}>{title}<input name={name} type={type} required={required} maxLength={type==='email'?254:undefined} autoComplete={type==='email'?'email':undefined}/></label>;
 const digitOnly=(event:React.FormEvent<HTMLInputElement>)=>{const target=event.currentTarget;const cleaned=target.value.replace(/\D/g,'').slice(0,10);if(target.value!==cleaned)target.value=cleaned;};
 return <form onSubmit={submit} className="card w3form"><div className="formgrid">{field('full_name','Full name','text',true)}{field('employee_code','Employee code','text',true)}{field('email','Email','email')}{<label>Mobile (10 digits)<input name="phone" type="tel" inputMode="numeric" onInput={digitOnly} pattern="[0-9]{10}" maxLength={10} title="Exactly 10 digits" autoComplete="tel-national"/></label>}{field('password','Initial password','password',true)}
 <label>Account type<select name="role" value={accountRole} onChange={e=>setAccountRole(e.target.value)} required><option value="EMPLOYEE">Employee</option><option value="DEPARTMENT_HEAD">Department Head</option>{allowAdmin&&<><option value="HR">HR</option><option value="SUPER_ADMIN">Super Admin</option></>}</select></label>
 <label>Role / Designation<select value={designation} onChange={e=>setDesignation(e.target.value)}>{designations.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 {designation==='Other'&&<label>Other designation<input value={customDesignation} onChange={e=>setCustomDesignation(e.target.value)} required maxLength={100}/></label>}
 <label>Department<select name="department_id"><option value="">Select department</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
 <label>Workplace<select name="workplace_type" required defaultValue=""><option value="" disabled>Select workplace</option>{workplaces.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
 <label>Work Location<select name="work_location_id" required defaultValue="" disabled={!referenceDataReady||locations.length===0}><option value="" disabled>{locations.length===0?'No active work locations':'Select work location'}</option>{locations.map(location=><option key={location.id} value={location.id}>{location.name}{location.address?` — ${location.address}`:''}</option>)}</select></label>
 <label>Date of Joining<input name="date_of_joining" type="date" required autoComplete="off" /></label></div>
 {accountRole==='DEPARTMENT_HEAD'&&<div className="notice" role="note">Department Head: select the correct department. The existing Head (if any) will automatically become Employee when this account is created. You will be asked to confirm.</div>}
 {locations.length===0&&<div className="notice" role="status">No active work locations found. Create one in Work Locations before adding an employee.</div>}
 <h3>Personal and emergency details</h3><div className="formgrid">{['current_address','permanent_address','emergency_contact_1_name','emergency_contact_1_relation','emergency_contact_1_phone','emergency_contact_2_name','emergency_contact_2_relation','emergency_contact_2_phone','blood_group'].map(k=>k.endsWith('_phone')?<label key={k}>{k.replaceAll('_',' ')}<input name={k} type="tel" inputMode="numeric" onInput={digitOnly} maxLength={10} pattern="[0-9]{10}" title="Exactly 10 digits"/></label>:field(k,k.replaceAll('_',' ')))}</div><h3>Bank details — restricted</h3><div className="formgrid">{['bank_account_holder','bank_name','bank_account_number','bank_ifsc','bank_branch'].map(k=>field(k,k.replaceAll('_',' ')))}</div>
 {message&&<div className="notice" role="status">{message}</div>}<div className="reportactions"><button disabled={busy||!referenceDataReady||locations.length===0||(designation==='Other'&&!customDesignation.trim())}>{busy?'Creating...':'Create employee'}</button><Link href="/employees">Back to employees</Link></div></form>;
}
