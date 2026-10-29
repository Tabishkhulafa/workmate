'use client';
import {useMemo,useState} from 'react';
type Holiday={id:string;holiday_date:string;name:string|null;title:string|null;description:string|null;holiday_type:string|null;is_active:boolean};
type Draft={holiday_date:string;title:string;description:string;holiday_type:string};
const blank:Draft={holiday_date:'',title:'',description:'',holiday_type:'PUBLIC'};
export default function HolidayManager({initial,mayManage}:{initial:Holiday[];mayManage:boolean}){
 const [items,setItems]=useState(initial); const [draft,setDraft]=useState<Draft>(blank); const [editing,setEditing]=useState<string|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState(''); const [query,setQuery]=useState('');const [showInactive,setShowInactive]=useState(false);
 const visible=useMemo(()=>items.filter(h=>(showInactive||h.is_active)&&(`${h.title||h.name||''} ${h.holiday_date} ${h.holiday_type||''}`).toLowerCase().includes(query.toLowerCase())),[items,query,showInactive]);
 const startEdit=(h:Holiday)=>{setEditing(h.id);setDraft({holiday_date:h.holiday_date,title:h.title||h.name||'',description:h.description||'',holiday_type:h.holiday_type||'PUBLIC'});setError('');setSuccess('');};
 const reset=()=>{setDraft(blank);setEditing(null);};
 async function save(action:'CREATE'|'UPDATE'|'DEACTIVATE',id?:string){
  if(busy||!mayManage)return;
  if(action==='DEACTIVATE'&&!confirm('Deactivate this holiday?'))return;
  if(action!=='DEACTIVATE'&&(!draft.holiday_date||!draft.title.trim())){setError('Holiday date and title are required.');return;}
  setBusy(true);setError('');setSuccess('');
  try{
   const payload=action==='DEACTIVATE'?{action,holiday_id:id}:{action,...draft,title:draft.title.trim(),name:draft.title.trim(),...(action==='UPDATE'?{holiday_id:id}:{})};
   const res=await fetch('/api/proxy/manage-holiday',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   const json=await res.json();if(!res.ok||json.error||json.success!==true)throw new Error(json.error||'Holiday update failed');
   if(json.holiday){const next=json.holiday as Holiday;setItems(previous=>[next,...previous.filter(row=>row.id!==next.id)].sort((a,b)=>b.holiday_date.localeCompare(a.holiday_date)));}
   setSuccess(action==='CREATE'?'Holiday created.':action==='UPDATE'?'Holiday updated.':'Holiday deactivated.');reset();
  }catch(err){setError(err instanceof Error?err.message:'Request failed');}finally{setBusy(false);}
 }
 return <div className="card" style={{display:'grid',gap:18}}>
  {error&&<p role="alert" className="notice error">{error}</p>}{success&&<p role="status" className="notice">{success}</p>}
  {mayManage&&<div className="wm-holiday-editor"><h2>{editing?'Edit holiday':'Add holiday'}</h2><div className="wm-holiday-fields">
    <label>Date <input type="date" value={draft.holiday_date} onChange={e=>setDraft(d=>({...d,holiday_date:e.target.value}))}/></label>
    <label>Holiday name <input maxLength={100} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))}/></label>
    <label>Type <select value={draft.holiday_type} onChange={e=>setDraft(d=>({...d,holiday_type:e.target.value}))}><option value="PUBLIC">Public</option><option value="OPTIONAL">Optional</option><option value="COMPANY">Company</option></select></label>
    <label>Description <input maxLength={300} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label>
  </div><div><button disabled={busy} onClick={()=>void save(editing?'UPDATE':'CREATE',editing||undefined)}>{busy?'Saving...':editing?'Save changes':'Add holiday'}</button> {editing&&<button type="button" disabled={busy} onClick={reset}>Cancel</button>}</div></div>}
  <div className="wm-holiday-search"><input aria-label="Search holidays" placeholder="Search name, date, type" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/> Show inactive</label><span className="muted">{visible.length} holidays</span></div>
  <div className="tablewrap"><table><thead><tr><th>Date</th><th>Holiday</th><th>Type</th><th>Description</th><th>Status</th>{mayManage&&<th>Actions</th>}</tr></thead><tbody>{visible.map(h=><tr key={h.id}><td>{h.holiday_date}</td><td>{h.title||h.name||'—'}</td><td>{h.holiday_type||'—'}</td><td>{h.description||'—'}</td><td>{h.is_active?'Active':'Inactive'}</td>{mayManage&&<td>{h.is_active?<><button disabled={busy} onClick={()=>startEdit(h)}>Edit</button> <button disabled={busy} onClick={()=>void save('DEACTIVATE',h.id)}>Deactivate</button></>:'—'}</td>}</tr>)}{visible.length===0&&<tr><td colSpan={mayManage?6:5}>No holidays found.</td></tr>}</tbody></table></div>
 </div>;
}
