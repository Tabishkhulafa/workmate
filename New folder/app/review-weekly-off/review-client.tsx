'use client';
import {useState} from 'react';
type Req={id:string;employee_id:string;requested_day:string;reason:string|null;created_at:string;status:string};
export default function WeeklyOffReview({initial}:{initial:Req[]}){
 const [rows,setRows]=useState(initial),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 async function decide(row:Req,action:'APPROVED'|'REJECTED'){
  if(!window.confirm(`${action==='APPROVED'?'Approve':'Reject'} weekly off request?`))return;
  setBusy(row.id);setError('');
  try{
   const response=await fetch('/api/proxy/review-weekly-off-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:row.id,action})});
   const body=await response.json().catch(()=>({error:'Invalid server response'}));
   if(!response.ok||body.error)throw Error(String(body.error||'Action failed'));
   setRows(prev=>prev.filter(x=>x.id!==row.id));
  }catch(e){setError(e instanceof Error?e.message:'Could not review request');}finally{setBusy(null)}
 }
 return <div className="card"><p>{rows.length} pending request(s)</p>{error&&<p className="notice error" role="alert">{error}</p>}<div className="tablewrap"><table><thead><tr><th>Employee ID</th><th>Requested day</th><th>Reason</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.employee_id}</td><td>{row.requested_day}</td><td>{row.reason||'—'}</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy!==null} onClick={()=>void decide(row,'APPROVED')}>Approve</button><button className="secondary" disabled={busy!==null} onClick={()=>void decide(row,'REJECTED')}>Reject</button></div></td></tr>)}</tbody></table>{rows.length===0&&<p className="muted">No pending weekly-off requests.</p>}</div></div>;
}
