'use client';
import {useState} from 'react';
type Department={id:string;name:string;code:string|null;department_type:string|null;is_active:boolean};
export default function DepartmentManager({departments}:{departments:Department[]}){
 const [items,setItems]=useState(departments.filter(x=>x.is_active));
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[editing,setEditing]=useState<string|null>(null);
 const [name,setName]=useState(''),[code,setCode]=useState(''),[kind,setKind]=useState('OFFICE');
 const [creating,setCreating]=useState(false);
 async function apply(action:'CREATE'|'UPDATE'|'DELETE',id?:string){
  if(action==='DELETE'&&!window.confirm('Permanently delete this department? This only succeeds if NO staff or records reference it.'))return;
  setBusy(true);setMessage('');
  try{
   const endpoint=action==='UPDATE'?'/api/proxy/manage-department':'/api/proxy/manage-department-records';
   const payload={action,department_id:id,name:name.trim(),code:code.trim(),department_type:kind};
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();if(!response.ok||data.error)throw Error(data.error||'Department operation failed');
   if(action==='CREATE'){setItems(old=>[...old,data.department].sort((a,b)=>a.name.localeCompare(b.name)));setCreating(false);}
   if(action==='UPDATE'){setItems(old=>old.map(v=>v.id===id?{...v,name:name.trim(),code:code.trim().toUpperCase()||null}:v));setEditing(null);}
   if(action==='DELETE')setItems(old=>old.filter(v=>v.id!==id));
   setName('');setCode('');setMessage(action==='CREATE'?'Department created.':action==='UPDATE'?'Department updated.':'Department permanently deleted.');
  }catch(err){setMessage(err instanceof Error?err.message:'Operation failed');}finally{setBusy(false);}
 }
 return <section className="card"><h2>Manage departments</h2><p className="muted">Showing active departments only. Delete is permanent and blocked when existing records reference the department.</p>
 <button type="button" disabled={busy} onClick={()=>{setCreating(!creating);setEditing(null);setName('');setCode('');setKind('OFFICE');}}>+ Create department</button>
 {creating&&<div className="card" style={{marginTop:16}}><div className="formgrid"><label>Department name<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><label>Code (optional)<input value={code} maxLength={30} onChange={e=>setCode(e.target.value)}/></label><label>Department type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="OFFICE">Office</option><option value="STORE">Store</option><option value="WAREHOUSE">Warehouse</option></select></label></div><button disabled={busy||name.trim().length<2} onClick={()=>apply('CREATE')}>Save department</button></div>}
 {message&&<p className="notice" role="status">{message}</p>}
 <div className="tablewrap"><table><thead><tr><th>Department</th><th>Code</th><th>Type</th><th>Actions</th></tr></thead><tbody>{items.map(d=><tr key={d.id}><td>{editing===d.id?<input aria-label="Department name" value={name} onChange={e=>setName(e.target.value)}/>:d.name}</td><td>{editing===d.id?<input aria-label="Department code" value={code} onChange={e=>setCode(e.target.value)}/>:d.code||'—'}</td><td>{d.department_type||'—'}</td><td>{editing===d.id?<><button disabled={busy||!name.trim()} onClick={()=>apply('UPDATE',d.id)}>Save</button> <button className="secondary" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></>:<><button disabled={busy} onClick={()=>{setEditing(d.id);setCreating(false);setName(d.name);setCode(d.code||'');}}>Edit</button> <button className="secondary" disabled={busy} onClick={()=>apply('DELETE',d.id)}>Delete</button></>}</td></tr>)}</tbody></table></div>
 {items.length===0&&<p className="muted">No active departments.</p>}</section>;
}
