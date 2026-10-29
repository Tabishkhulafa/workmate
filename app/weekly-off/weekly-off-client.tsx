'use client';
import {useMemo,useState} from 'react';
import styles from './weekly-off.module.css';

type RequestRow={id:string;requested_day:string;reason:string|null;status:string;created_at:string;reviewed_at:string|null;review_note:string|null};
type Props={workplace:string|null;activeDay:string|null;history:RequestRow[];canRequest:boolean;blockedReason:string|null};
const days=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY'];
const label=(x:string|null)=>x?x.charAt(0)+x.slice(1).toLowerCase():'Not assigned';
const readable=(x:string|null)=>x?new Date(x).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}):'—';
export default function WeeklyOffClient({workplace,activeDay,history,canRequest,blockedReason}:Props){
 const [day,setDay]=useState('MONDAY'),[reason,setReason]=useState(''),[busy,setBusy]=useState(false);
 const [rows,setRows]=useState(history),[message,setMessage]=useState(''),[error,setError]=useState('');
 const pending=rows.some(r=>r.status==='PENDING');
 const counts=useMemo(()=>({approved:rows.filter(r=>r.status==='APPROVED').length,pending:rows.filter(r=>r.status==='PENDING').length}),[rows]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!canRequest||blockedReason||pending||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/proxy/submit-weekly-off-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requested_day:day,reason:reason.trim()})});
   const body=await response.json() as {success?:boolean;error?:string};
   if(!response.ok||!body.success)throw new Error(body.error||'Unable to submit request');
   setRows(current=>[{id:`pending-${Date.now()}`,requested_day:day,reason:reason.trim()||null,status:'PENDING',created_at:new Date().toISOString(),reviewed_at:null,review_note:null},...current]);
   setReason('');setMessage('Request submitted. Your weekly off changes only after approval.');
  }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false)}
 }
 return <div className={styles.stack}>
  <div className={styles.stats}>
   <div className={styles.stat}><span>Workplace</span><strong>{workplace||'Not assigned'}</strong></div>
   <div className={styles.stat}><span>Current assigned weekly off</span><strong>{workplace==='OFFICE'?'Sunday':counts.approved>0?label(activeDay):'Awaiting approval'}</strong></div>
   <div className={styles.stat}><span>Pending requests</span><strong>{counts.pending}</strong></div>
  </div>
  <section className={styles.panel}><div className={styles.header}><h2>Request weekly off</h2><p>Monday to Thursday · One recurring weekly-off day · No self-approval</p></div>
   {!canRequest?<p className={styles.info}>{workplace==='OFFICE'?'Office staff have Sunday as their scheduled weekly off.':'Only staff assigned to Store or Warehouse can request a Monday–Thursday weekly off.'}</p>
   :<><form onSubmit={e=>void submit(e)} className={styles.form}>
    <label>Choose weekday<select value={day} onChange={e=>setDay(e.target.value)} disabled={busy||pending||!!blockedReason}>{days.map(d=><option key={d} value={d}>{label(d)}</option>)}</select></label>
    <label>Reason (optional)<textarea value={reason} maxLength={500} rows={3} onChange={e=>setReason(e.target.value)} placeholder="Why do you need this weekly-off day?" disabled={busy||pending||!!blockedReason}/></label>
    <button type="submit" disabled={busy||pending||!!blockedReason}>{busy?'Submitting…':pending?'Request pending approval':'Submit request'}</button>
   </form>{blockedReason&&<div className={styles.info} role="status">Local testing is read-only: {blockedReason}</div>}</>}
   {message&&<p className={styles.success} role="status">{message}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
  </section>
  <section className={styles.panel}><div className={styles.header}><h2>My requests</h2><p>Approval decision and review notes stay visible after review.</p></div>
   {rows.length===0?<p className={styles.empty}>No weekly-off requests yet.</p>:<div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Requested day</th><th>Submitted (IST)</th><th>Status</th><th>Reviewed (IST)</th><th>Review note</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}><td><strong>{label(r.requested_day)}</strong></td><td>{readable(r.created_at)}</td><td><span className={`${styles.badge} ${r.status==='APPROVED'?styles.approved:r.status==='REJECTED'?styles.rejected:styles.pending}`}>{label(r.status)}</span></td><td>{readable(r.reviewed_at)}</td><td>{r.review_note||'—'}</td></tr>)}
   </tbody></table></div>}
  </section>
 </div>;
}
