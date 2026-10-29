'use client';
import {useCallback,useEffect,useState} from 'react';
type Request={id:string;employee_id:string;reason:string;created_at:string;status:string;reviewed_at?:string|null;review_note?:string|null;approved_until?:string|null;consumed_at?:string|null;full_name?:string;employee_code?:string;department_name?:string};
async function invoke(body:Record<string,unknown>){
 const r=await fetch('/api/proxy/manage-face-reenrollment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const j=await r.json().catch(()=>({error:'Unable to read server response'}));
 if(!r.ok||j.error)throw new Error(j.error||'Request failed');return j;
}
const displayDate=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value))+' IST':'—';
export function FaceReviewClient(){
 const [pending,setPending]=useState<Request[]>([]),[history,setHistory]=useState<Request[]>([]);
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{
  setLoading(true);
  try{
   const [queueData,historyData]=await Promise.all([invoke({action:'review_queue'}),invoke({action:'review_history'})]);
   const allPending=(Array.isArray(queueData.requests)?queueData.requests:[]) as Request[];
   const allHistory=(Array.isArray(historyData.requests)?historyData.requests:[]) as Request[];
   let identities:Record<string,{full_name:string;employee_code:string;department_name:string}>={};
   try{const r=await fetch('/api/face-review-identities',{cache:'no-store'});if(r.ok){const j=await r.json() as {identities?:typeof identities};identities=j.identities||{}}}catch{}
   setPending(allPending.map(item=>({...item,...(identities[item.employee_id]||{})})));
   setHistory(allHistory.map(item=>({...item,...(identities[item.employee_id]||{})})));
   setMessage('');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not load approvals');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload()},[reload]);
 async function review(id:string,decision:'APPROVED'|'REJECTED'){
  setBusy(id);setMessage('');
  try{await invoke({action:'review',request_id:id,decision,note:notes[id]||''});await reload();setMessage(`Request ${decision.toLowerCase()} successfully.`);}
  catch(e){setMessage(e instanceof Error?e.message:'Review failed');}
  finally{setBusy('');}
 }
 return <section className="wm-review-section">
  <div className="wm-review-toolbar"><div><h2>Pending approval</h2><p className="muted small">{loading?'Loading requests…':`${pending.length} pending request${pending.length===1?'':'s'}`}</p></div><button type="button" className="secondary" disabled={loading||!!busy} onClick={()=>void reload()}>Refresh requests</button></div>
  {message&&<p role="status" className="notice">{message}</p>}
  <div className="wm-review-list">{pending.map(r=><article className="wm-review-item" key={r.id}>
   <div className="wm-review-top"><div><span className="wm-review-kicker">Face change request</span><h3>{r.full_name||'Employee details unavailable'}</h3><p className="muted small">{r.employee_code||'No employee code'} · {r.department_name||'Department unavailable'}</p></div><span className="wm-review-date">{displayDate(r.created_at)}</span></div>
   <div className="wm-review-details"><div className="wm-review-reason"><span className="wm-review-kicker">Employee's reason</span><p>{r.reason||'No reason provided'}</p></div><label className="wm-review-note">Review note <span className="muted small">(optional)</span><textarea aria-label={`Review note for ${r.full_name||'employee'}`} rows={2} value={notes[r.id]||''} maxLength={500} onChange={e=>setNotes(n=>({...n,[r.id]:e.target.value}))} placeholder="Add a note for your decision…"/></label></div>
   <div className="wm-review-buttons"><button disabled={!!busy||loading} onClick={()=>void review(r.id,'APPROVED')}>{busy===r.id?'Processing…':'Approve'}</button><button className="secondary" disabled={!!busy||loading} onClick={()=>void review(r.id,'REJECTED')}>Reject</button></div>
  </article>)}{!loading&&!pending.length&&<div className="wm-review-empty"><strong>No pending requests</strong><p className="muted">Previously approved requests are shown in the history below.</p></div>}</div>
  <h2 style={{marginTop:28}}>Review history</h2>
  <p className="muted small">Recent face-change requests in your authorized review scope. Completed requests cannot be approved twice.</p>
  <div className="card tablewrap"><table><thead><tr><th>Employee</th><th>Requested</th><th>Reason</th><th>Status</th><th>Reviewed</th><th>Approval valid until</th><th>Review note</th></tr></thead><tbody>{history.map(r=><tr key={r.id}><td><strong>{r.full_name||'Employee'}</strong><div className="muted small">{r.employee_code||'—'}</div></td><td>{displayDate(r.created_at)}</td><td>{r.reason||'—'}</td><td><b>{r.status}</b></td><td>{displayDate(r.reviewed_at)}</td><td>{displayDate(r.approved_until)}</td><td>{r.review_note||'—'}</td></tr>)}</tbody></table>{!loading&&!history.length&&<p className="muted">No completed requests in your review scope.</p>}</div>
 </section>;
}
