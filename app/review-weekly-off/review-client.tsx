'use client';
import {useMemo,useState} from 'react';
import styles from './review.module.css';
type Req={id:string;employee_id:string;requested_day:string;reason:string|null;created_at:string;status:string;reviewed_at:string|null;review_note:string|null;employee_name:string;employee_code:string;department_name:string;workplace:string};
type Filter='ALL'|'PENDING'|'APPROVED'|'REJECTED';
const fmt=(date:string|null)=>date?new Date(date).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}):'—';
const title=(s:string)=>s.charAt(0)+s.slice(1).toLowerCase();
export default function WeeklyOffReview({initial,blockedReason}:{initial:Req[];blockedReason:string|null}){
 const [rows,setRows]=useState(initial),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({}),[filter,setFilter]=useState<Filter>('PENDING'),[query,setQuery]=useState('');
 const visible=useMemo(()=>rows.filter(row=>(filter==='ALL'||row.status===filter)&&`${row.employee_name} ${row.employee_code} ${row.department_name}`.toLowerCase().includes(query.toLowerCase())),[rows,filter,query]);
 const count=(status:string)=>rows.filter(row=>row.status===status).length;
 async function decide(row:Req,action:'APPROVED'|'REJECTED'){
  if(busy||blockedReason)return;
  const note=(notes[row.id]||'').trim();
  if(action==='REJECTED'&&note.length<3){setError('Enter a rejection reason (at least 3 characters).');return;}
  if(!window.confirm(`${action==='APPROVED'?'Approve':'Reject'} ${row.employee_name} weekly off on ${title(row.requested_day)}?`))return;
  setBusy(row.id);setError('');setNotice('');
  try{
   const response=await fetch('/api/proxy/review-weekly-off-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:row.id,action,review_note:note})});
   const body=await response.json().catch(()=>({error:'Invalid server response'}));
   if(!response.ok||body.error||!body.success)throw Error(String(body.error||'Action failed'));
   setRows(prev=>prev.map(x=>x.id===row.id?{...x,status:action,reviewed_at:new Date().toISOString(),review_note:note||null}:x));
   setNotice(`${row.employee_name}: ${title(action)}. The approved day is now their weekly-off assignment.`);
  }catch(e){setError(e instanceof Error?e.message:'Could not review request');}finally{setBusy(null);}
 }
 return <div className={styles.root}>
  {blockedReason&&<div className={styles.warning} role="status">Read-only local preview: {blockedReason}</div>}
  {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p className={styles.success} role="status">{notice}</p>}
  <div className={styles.controls}><label>Search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Employee, code, department"/></label>
   <div className={styles.tabs}>{(['PENDING','APPROVED','REJECTED','ALL'] as Filter[]).map(x=><button key={x} type="button" aria-pressed={filter===x} className={filter===x?styles.chosen:styles.tab} onClick={()=>setFilter(x)}>{title(x)} ({x==='ALL'?rows.length:count(x)})</button>)}</div>
  </div>
  {visible.length===0?<div className={styles.empty}>No matching {title(filter).toLowerCase()} weekly-off requests.</div>:<div className={styles.list}>{visible.map(row=><article className={styles.card} key={row.id}>
   <div className={styles.head}><div><h3>{row.employee_name}</h3><p>{row.employee_code||'—'} · {row.department_name} · {row.workplace}</p></div><span className={`${styles.badge} ${row.status==='APPROVED'?styles.approved:row.status==='REJECTED'?styles.rejected:styles.pending}`}>{title(row.status)}</span></div>
   <div className={styles.detail}><div><span>Requested off</span><strong>{title(row.requested_day)}</strong></div><div><span>Requested</span><strong>{fmt(row.created_at)}</strong></div><div><span>Reason</span><strong>{row.reason||'—'}</strong></div></div>
   {row.status==='PENDING'?<div className={styles.actions}><label>Review note<textarea rows={2} maxLength={500} value={notes[row.id]||''} onChange={e=>setNotes(prev=>({...prev,[row.id]:e.target.value}))} placeholder="Rejection reason is required" disabled={!!busy||!!blockedReason}/></label><div><button disabled={!!busy||!!blockedReason} onClick={()=>void decide(row,'APPROVED')}>Approve</button><button className={styles.rejectButton} disabled={!!busy||!!blockedReason} onClick={()=>void decide(row,'REJECTED')}>Reject</button></div></div>:
   <p className={styles.reviewed}>Reviewed: {fmt(row.reviewed_at)} · Note: {row.review_note||'—'}</p>}
  </article>)}</div>}
 </div>;
}
