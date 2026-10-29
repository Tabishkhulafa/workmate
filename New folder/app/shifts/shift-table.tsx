'use client';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
type Shift={id:string;name:string;start_time:string;end_time:string;is_active:boolean|null;fields:Record<string,string>};
type FormState={name:string;start_time:string;end_time:string;required_work_minutes:string;half_day_minutes:string};
const blank:FormState={name:'',start_time:'10:30',end_time:'19:30',required_work_minutes:'540',half_day_minutes:'270'};
const csv=(x:unknown)=>'"'+String(x??'').replaceAll('"','""')+'"';
export default function ShiftTable({shifts}:{shifts:Shift[]}){
 const router=useRouter();const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
 const [selected,setSelected]=useState<string|null>(null),[form,setForm]=useState<FormState>(blank),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const filtered=useMemo(()=>shifts.filter(s=>(filter==='all'||(filter==='active'?s.is_active===true:s.is_active===false))&&[s.name,s.start_time,s.end_time].join(' ').toLowerCase().includes(search.toLowerCase())),[shifts,filter,search]);
 const active=shifts.filter(s=>s.is_active).length;
 function edit(s:Shift){setSelected(s.id);setMessage('');setForm({name:s.name,start_time:s.start_time.slice(0,5),end_time:s.end_time.slice(0,5),required_work_minutes:s.fields.required_work_minutes||'540',half_day_minutes:s.fields.half_day_minutes||'270'});}
 function create(){setSelected('new');setForm(blank);setMessage('');}
 async function submit(action:'CREATE'|'UPDATE'|'DEACTIVATE'|'ACTIVATE'|'DELETE',shiftId?:string){
  if(busy)return;
  if(action==='DELETE'&&!window.confirm('PERMANENTLY delete this shift? This cannot be undone. Shifts linked to employee records cannot be deleted.'))return;
  if(['DEACTIVATE','ACTIVATE'].includes(action)&&!window.confirm(action==='DEACTIVATE'?'Deactivate this shift? Existing records will remain.':'Reactivate shift?'))return;
  setBusy(true);setMessage('');
  try{
   const payload=action==='CREATE'||action==='UPDATE'?{action,shift_id:shiftId,...form,required_work_minutes:Number(form.required_work_minutes),half_day_minutes:Number(form.half_day_minutes)}:{action,shift_id:shiftId};
   const res=await fetch('/api/proxy/manage-shift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await res.json() as {success?:boolean,error?:string};
   if(!res.ok||!data.success)throw new Error(data.error||`Shift ${action.toLowerCase()} failed (HTTP ${res.status})`);
   setSelected(null);setMessage(action==='DELETE'?'Shift deleted successfully':'Shift updated successfully');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Unexpected error');}finally{setBusy(false);}
 }
 function exportCSV(){const lines=[['Shift','Start','End','Status','Full-day minutes','Half-day minutes'],...filtered.map(s=>[s.name,s.start_time,s.end_time,s.is_active?'Active':'Inactive',s.fields.required_work_minutes||'',s.fields.half_day_minutes||''])];const blob=new Blob(['\uFEFF'+lines.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='workmate-shifts.csv';a.click();URL.revokeObjectURL(url);}
 return <>
  <div className="card" style={{padding:18,marginBottom:16}}>
   <p><strong>{shifts.length}</strong> total shifts · <strong>{active}</strong> active · <strong>{shifts.length-active}</strong> inactive</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><input aria-label="Search shifts" placeholder="Search shifts" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:'1 1 180px'}}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button type="button" onClick={create}>+ Create shift</button><button type="button" onClick={exportCSV}>Download CSV ({filtered.length})</button></div>
   {message&&<p role="status">{message}</p>}
  </div>
  {selected&&<div className="card" style={{padding:18,marginBottom:16}}><h2>{selected==='new'?'Create Shift':'Edit Shift'}</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
   {([{key:'name',label:'Shift name',type:'text'},{key:'start_time',label:'Start time',type:'time'},{key:'end_time',label:'End time',type:'time'},{key:'required_work_minutes',label:'Full-day minutes',type:'number'},{key:'half_day_minutes',label:'Half-day minutes',type:'number'}] as {key:keyof FormState,label:string,type:string}[]).map(f=><label key={f.key}>{f.label}<input type={f.type} min={f.type==='number'?'1':undefined} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={{display:'block',width:'100%'}}/></label>)}
   </div><div style={{display:'flex',gap:10,marginTop:16}}><button type="button" disabled={busy} onClick={()=>submit(selected==='new'?'CREATE':'UPDATE',selected==='new'?undefined:selected)}>{busy?'Saving…':'Save shift'}</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button></div></div>}
  <div className="card tablewrap"><table><thead><tr><th>Shift</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.start_time}</td><td>{s.end_time}</td><td>{s.is_active?'Active':'Inactive'}</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy} onClick={()=>edit(s)}>Edit</button><button disabled={busy} onClick={()=>submit(s.is_active?'DEACTIVATE':'ACTIVATE',s.id)}>{s.is_active?'Deactivate':'Activate'}</button><button disabled={busy} className="secondary" onClick={()=>submit('DELETE',s.id)}>Delete</button></div></td></tr>)}{!filtered.length&&<tr><td colSpan={5}>No shifts found.</td></tr>}</tbody></table></div>
 </>;
}
