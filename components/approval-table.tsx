'use client';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays, Check, Clock3, Search, X} from 'lucide-react';
import styles from './approval-table.module.css';

const regTypeLabels:Record<string,string>={
 MISSING_ATTENDANCE:'Attendance Miss',
 INCORRECT_CLOCK_IN:'Fix Clock In Time',
 INCORRECT_CLOCK_OUT:'Fix Clock Out Time',
 INCORRECT_BOTH:'Fix Both Times',
};
function ist(value?:string|null){
 if(!value)return '—';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '—';
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(date);
}
function dateLabel(value?:string|null){
 if(!value)return '—';
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(match)return `${match[3]}/${match[2]}/${match[1]}`;
 return value;
}
type Row={id:string;employee_id:string;status:string;employee_name:string;employee_code:string|null;department_name:string|null;start_date?:string;end_date?:string;attendance_date?:string;leave_type?:string;reason?:string;requested_clock_in?:string|null;requested_clock_out?:string|null;request_type?:string;original_clock_in?:string|null;original_clock_out?:string|null};

export function ApprovalTable({initial,kind}:{initial:Row[];kind:'leave'|'regularization'}){
 const router=useRouter();
 const [rows,setRows]=useState(initial);
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [working,setWorking]=useState('');
 const [message,setMessage]=useState('');
 const [search,setSearch]=useState('');
 const visible=useMemo(()=>rows.filter(row=>{
  const text=[row.employee_name,row.employee_code,row.department_name,row.reason,row.leave_type,regTypeLabels[row.request_type||'']].filter(Boolean).join(' ').toLowerCase();
  return text.includes(search.toLowerCase().trim());
 }),[rows,search]);
 async function submit(row:Row,action:'APPROVED'|'REJECTED'){
  const note=(notes[row.id]||'').trim();
  if(action==='REJECTED'&&note.length<3){setMessage('Rejection reason must contain at least 3 characters.');return;}
  if(!window.confirm(`${action==='APPROVED'?'Approve':'Reject'} ${row.employee_name}'s ${kind==='leave'?'leave':'regularization'} request?`))return;
  setWorking(row.id);setMessage('');
  try{
   const endpoint=kind==='leave'?'review-leave':'review-attendance-regularization';
   const body=kind==='leave'?{leave_id:row.id,action,review_note:note}:{regularization_id:row.id,action,review_note:note};
   const response=await fetch(`/api/proxy/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();
   if(!response.ok||result.error||result.success===false)throw new Error(result.error||result.message||'Review failed');
   // Only remove after the server confirms the decision. Refresh server data too,
   // so a later navigation does not resurrect an already-reviewed request.
   setRows(previous=>previous.filter(x=>x.id!==row.id));
   setMessage(result.message||`Request ${action.toLowerCase()}.`);
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Request failed');}
  finally{setWorking('');}
 }
 return <section className={styles.section} aria-label={`${kind==='leave'?'Leave':'Regularization'} requests for approval`}>
  <div className={styles.toolbar}>
   <div className={styles.searchWrap}>
    <Search size={17} aria-hidden="true"/>
    <input aria-label="Search employee name, code, department or request" placeholder="Search employee, code, department…" value={search} onChange={e=>setSearch(e.target.value)}/>
    {search&&<button type="button" aria-label="Clear search" onClick={()=>setSearch('')}><X size={15}/></button>}
   </div>
   <span className={styles.count}>{visible.length} of {rows.length} pending</span>
  </div>
  {message&&<p role="status" className={styles.message}>{message}</p>}
  <div className={styles.cards}>
   {visible.map(row=><article key={row.id} className={styles.card}>
    <div className={styles.identity}>
     <div className={styles.avatar} aria-hidden="true">{row.employee_name?.trim().slice(0,1).toUpperCase()||'E'}</div>
     <div className={styles.person}>
      <h3>{row.employee_name}</h3>
      <span className={styles.code}>{row.employee_code||'Code unavailable'}</span>
      <span className={styles.department}>{row.department_name||'Department not assigned'}</span>
     </div>
     <span className={styles.pending}>Pending</span>
    </div>
    <div className={styles.details}>
     <div className={styles.detailHead}>
      <span className={styles.requestType}>{kind==='leave'?row.leave_type||'Leave':regTypeLabels[row.request_type||'']||'Time correction'}</span>
      <span className={styles.date}><CalendarDays size={14}/>{kind==='leave'?`${dateLabel(row.start_date)} – ${dateLabel(row.end_date)}`:dateLabel(row.attendance_date)}</span>
     </div>
     {kind==='regularization'&&<div className={styles.times}>
       {row.requested_clock_in&&<div className={styles.timeBox}><span><Clock3 size={13}/> New Clock In</span><strong>{ist(row.requested_clock_in)}</strong></div>}
       {row.requested_clock_out&&<div className={styles.timeBox}><span><Clock3 size={13}/> New Clock Out</span><strong>{ist(row.requested_clock_out)}</strong></div>}
       {row.original_clock_in&&<div className={styles.previousTime}><span>Existing Clock In</span><strong>{ist(row.original_clock_in)}</strong></div>}
       {row.original_clock_out&&<div className={styles.previousTime}><span>Existing Clock Out</span><strong>{ist(row.original_clock_out)}</strong></div>}
     </div>}
     {row.reason&&<div className={styles.reason}><span>Reason</span><p>{row.reason}</p></div>}
    </div>
    <div className={styles.decision}>
     <label htmlFor={`wm-review-note-${row.id}`}>Review note <span>(optional for approval)</span></label>
     <textarea id={`wm-review-note-${row.id}`} aria-label={`Review note for ${row.employee_name}`} maxLength={500} rows={3}
      value={notes[row.id]||''} onChange={e=>setNotes(n=>({...n,[row.id]:e.target.value}))} placeholder="Add a note or rejection reason…"/>
     <div className={styles.actions}>
      <button type="button" className={styles.approve} disabled={working!==''} onClick={()=>void submit(row,'APPROVED')}>
       <Check size={16}/>{working===row.id?'Saving…':'Approve'}
      </button>
      <button type="button" className={styles.reject} disabled={working!==''} onClick={()=>void submit(row,'REJECTED')}>
       <X size={16}/>Reject
      </button>
     </div>
    </div>
   </article>)}
   {!visible.length&&<div className={styles.empty}>{rows.length?'No matching requests.':'No pending requests for review.'}</div>}
  </div>
 </section>;
}
