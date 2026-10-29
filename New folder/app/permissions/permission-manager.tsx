'use client';
import {useState} from 'react';
type Employee={id:string;full_name:string|null;employee_code:string|null;role:string;department_id:string|null};
type Department={id:string;name:string};
type Grant={id:string;reason:string;valid_from:string;expires_at:string;revoked_at:string|null};
async function invoke(body:Record<string,unknown>){
 const response=await fetch('/api/proxy/manage-button-attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({error:'Invalid API response'}));
 if(!response.ok||data.error)throw new Error(String(data.error||'Request failed'));
 return data;
}
const formatDateTime=(value:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value)).replace(',', '');
const roleLabel=(role:string)=>role.replaceAll('_',' ');
const permissionStatus=(grant:Grant)=>grant.revoked_at?'Revoked':new Date(grant.expires_at)>new Date()?'Active':'Expired';
const permissionClass=(grant:Grant)=>grant.revoked_at?'wm-status wm-status--muted':new Date(grant.expires_at)>new Date()?'wm-status wm-status--success':'wm-status wm-status--warning';
export function PermissionManager({employees,departments}:{employees:Employee[];departments:Department[]}){
 const [search,setSearch]=useState(''),[department,setDepartment]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const [duration,setDuration]=useState(60),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const [inspect,setInspect]=useState(''),[grants,setGrants]=useState<Grant[]>([]);
 const eligible=employees.filter(e=>(!department||e.department_id===department)&&`${e.full_name||''} ${e.employee_code||''} ${e.role}`.toLowerCase().includes(search.toLowerCase()));
 const visibleIds=eligible.map(e=>e.id);
 function toggle(id:string){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
 async function grant(){if(busy||selected.length===0)return;setFeedback('');if(reason.trim().length<10){setFeedback('Reason must be at least 10 characters.');return;}
 if(!Number.isInteger(duration)||duration<5||duration>1440){setFeedback('Duration must be between 5 and 1440 minutes.');return;}
 if(!window.confirm(`Grant ${duration}-minute button permission to ${selected.length} employee(s)?`))return;
 setBusy(true);const failures:string[]=[];let ok=0;
 for(const id of selected){try{await invoke({action:'grant',employee_id:id,duration_minutes:duration,reason:reason.trim()});ok++;}catch(e){const name=employees.find(x=>x.id===id)?.full_name||id;failures.push(`${name}: ${e instanceof Error?e.message:'Failed'}`);}}
 setFeedback(`${ok} granted, ${failures.length} failed.${failures.length?' '+failures.join(' | '):''}`);setSelected(failures.map(f=>employees.find(e=>f.startsWith((e.full_name||e.id)+':'))?.id).filter((x):x is string=>!!x));setBusy(false);
 if(inspect)await load(inspect);
 }
 async function load(id:string){setInspect(id);setFeedback('');setGrants([]);try{const d=await invoke({action:'status',employee_id:id});setGrants((d.permissions||[]) as Grant[]);}catch(e){setFeedback(e instanceof Error?e.message:'Status failed');}}
 async function revoke(id:string,permissionId:string){if(!window.confirm('Revoke this permission immediately?'))return;setBusy(true);try{await invoke({action:'revoke',employee_id:id,permission_id:permissionId});await load(id);}catch(e){setFeedback(e instanceof Error?e.message:'Revoke failed');}finally{setBusy(false);}}
 return <div className="card wm-surface" style={{padding:20}}>
 <div className="reportactions wm-filter-grid"><label>Search employee<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name / code / role"/></label><label>Department<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All departments</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><div className="wm-inline-summary"><strong>{selected.length}</strong><span>selected</span></div></div>
 <div className="tablewrap wm-list-wrap" style={{maxHeight:430,overflow:'auto',marginTop:18}}><table className="wm-compact-table wm-permission-table"><thead><tr><th><input type="checkbox" aria-label="Select visible employees" checked={!!visibleIds.length&&visibleIds.every(id=>selected.includes(id))} onChange={e=>setSelected(s=>e.target.checked?Array.from(new Set([...s,...visibleIds])):s.filter(id=>!visibleIds.includes(id)))}/></th><th>Employee</th><th>Role</th><th>Action</th></tr></thead><tbody>{eligible.map(e=><tr key={e.id}><td><input type="checkbox" aria-label={`Select ${e.full_name||e.employee_code||'employee'}`} checked={selected.includes(e.id)} onChange={()=>toggle(e.id)}/></td><td><div className="wm-person-cell"><strong>{e.full_name||'Unnamed'}</strong><div className="muted wm-nowrap">{e.employee_code||'—'}</div></div></td><td><span className="wm-status">{roleLabel(e.role)}</span></td><td><button className="secondary" disabled={busy} onClick={()=>void load(e.id)}>View / revoke</button></td></tr>)}</tbody></table>{!eligible.length&&<p className="muted">No eligible employees found.</p>}</div>
 <div className="wm-permission-form"><div className="wm-form-heading"><strong>{selected.length} employee(s) selected</strong><span className="muted small">Temporary button attendance only</span></div><label>Permission duration (minutes)<input type="number" min={5} max={1440} step={1} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label>Reason (required)<textarea rows={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why is temporary button attendance necessary?"/></label><button disabled={busy||!selected.length} onClick={()=>void grant()}>{busy?'Processing…':`Grant permission to ${selected.length} employee(s)`}</button></div>
 {feedback&&<div role="status" className="notice" style={{marginTop:15,whiteSpace:'pre-wrap'}}>{feedback}</div>}
 {inspect&&<section style={{marginTop:24}}><h2>Permission history — {employees.find(e=>e.id===inspect)?.full_name||'Employee'}</h2><div className="tablewrap"><table className="wm-compact-table"><thead><tr><th>Reason</th><th>Valid from (IST)</th><th>Expires (IST)</th><th>Status</th><th>Action</th></tr></thead><tbody>{grants.map(g=>{const active=!g.revoked_at&&new Date(g.expires_at)>new Date();return <tr key={g.id}><td>{g.reason}</td><td className="wm-nowrap">{formatDateTime(g.valid_from)}</td><td className="wm-nowrap">{formatDateTime(g.expires_at)}</td><td><span className={permissionClass(g)}>{permissionStatus(g)}</span></td><td>{active?<button disabled={busy} className="secondary" onClick={()=>void revoke(inspect,g.id)}>Revoke</button>:'—'}</td></tr>})}</tbody></table>{!grants.length&&<p className="muted">No permissions found.</p>}</div></section>}
 </div>;
}
