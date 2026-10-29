'use client';
import {useMemo,useState} from 'react';

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

type Row={id:string;employee_id:string;status:string;employee_name:string;employee_code:string|null;department_name:string|null;start_date?:string;end_date?:string;attendance_date?:string;leave_type?:string;reason?:string;requested_clock_in?:string|null;requested_clock_out?:string|null;request_type?:string;original_clock_in?:string|null;original_clock_out?:string|null};

export function ApprovalTable({initial,kind}:{initial:Row[];kind:'leave'|'regularization'}){
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
      if(!response.ok||result.error)throw new Error(result.error||'Review failed');
      setRows(previous=>previous.filter(x=>x.id!==row.id));
      setMessage(result.message||`Request ${action.toLowerCase()}.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Request failed');}
    finally{setWorking('');}
  }
  return <>
    <p className="muted">Only requests visible to your signed-in account are listed. Final permission checks happen in Supabase.</p>
    <div className="reportactions" style={{marginBottom:12}}>
      <input aria-label="Search employee name, code, department or request" placeholder="Search employee, code, department..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:370}}/>
      <span className="muted">{visible.length} of {rows.length} pending</span>
    </div>
    {message&&<p className="notice" role="status">{message}</p>}
    <div className="card tablewrap"><table>
      <thead><tr><th>Employee</th><th>Department</th><th>Date / period</th><th>Details</th><th>Review note</th><th>Decision</th></tr></thead>
      <tbody>{visible.map(row=><tr key={row.id}>
        <td><strong>{row.employee_name}</strong><div className="muted small">{row.employee_code||'Code unavailable'}</div></td>
        <td>{row.department_name||'—'}</td>
        <td>{kind==='leave'?`${row.start_date||'—'} to ${row.end_date||'—'}`:row.attendance_date||'—'}</td>
        <td>{kind==='leave'?row.leave_type||'—':<div style={{display:'grid',gap:6,minWidth:185,maxWidth:360}}>
          <strong>{regTypeLabels[row.request_type||'']||'Time correction'}</strong>
          {row.requested_clock_in&&<div><span className="muted small">New Clock In: </span><strong>{ist(row.requested_clock_in)}</strong></div>}
          {row.requested_clock_out&&<div><span className="muted small">New Clock Out: </span><strong>{ist(row.requested_clock_out)}</strong></div>}
          {row.original_clock_in&&<div className="muted small">Existing Clock In: {ist(row.original_clock_in)}</div>}
          {row.original_clock_out&&<div className="muted small">Existing Clock Out: {ist(row.original_clock_out)}</div>}
          <span className="muted small" style={{overflowWrap:'anywhere'}}>Reason: {row.reason||'—'}</span>
        </div>}</td>
        <td><input aria-label={`Review note for ${row.employee_name}`} maxLength={500} value={notes[row.id]||''} onChange={e=>setNotes(n=>({...n,[row.id]:e.target.value}))}/></td>
        <td><div className="reportactions"><button disabled={working!==''} onClick={()=>void submit(row,'APPROVED')}>Approve</button><button className="secondary" disabled={working!==''} onClick={()=>void submit(row,'REJECTED')}>Reject</button></div></td>
      </tr>)}</tbody>
    </table>{!visible.length&&<p className="muted">{rows.length?'No matching requests.':'No visible pending requests.'}</p>}</div>
  </>;
}
