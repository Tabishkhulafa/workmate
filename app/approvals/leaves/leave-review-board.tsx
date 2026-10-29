'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,Clock3,RefreshCw,Search,ShieldCheck,X} from 'lucide-react';
import {daysInclusive,displayDate,leaveLabel,statusLabel} from '@/lib/leave-view';
import s from './leave-review-board.module.css';

export type ReviewLeave={id:string;employee_id:string;status:string;employee_name:string;employee_code:string|null;department_name:string|null;start_date:string;end_date:string;total_days:number|string|null;leave_type:string;reason:string;review_note:string|null;reviewed_at:string|null;created_at:string};
type Tab='PENDING'|'REVIEWED'|'ALL';
type ReviewResult={success?:boolean;error?:string;message?:string;final_leave_type?:string};
export default function LeaveReviewBoard({initial,readOnly}:{initial:ReviewLeave[];readOnly:boolean}){
  const router=useRouter();
  const [rows,setRows]=useState(initial),[tab,setTab]=useState<Tab>('PENDING'),[search,setSearch]=useState(''),[notes,setNotes]=useState<Record<string,string>>({});
  const [working,setWorking]=useState(''),[notice,setNotice]=useState(''),[isError,setIsError]=useState(false),[refreshing,setRefreshing]=useState(false);
  useEffect(()=>{setRows(initial);setRefreshing(false);},[initial]);
  const pending=rows.filter(r=>r.status==='PENDING').length;
  const approved=rows.filter(r=>r.status==='APPROVED').length;
  const rejected=rows.filter(r=>r.status==='REJECTED').length;
  const visible=useMemo(()=>rows.filter(row=>{
    if(tab==='PENDING'&&row.status!=='PENDING')return false;
    if(tab==='REVIEWED'&&row.status==='PENDING')return false;
    const needle=search.trim().toLowerCase();
    return !needle||[row.employee_name,row.employee_code,row.department_name,row.reason,row.leave_type,row.status].some(p=>String(p??'').toLowerCase().includes(needle));
  }),[rows,search,tab]);
  async function decide(row:ReviewLeave,action:'APPROVED'|'REJECTED'){
    if(readOnly){setIsError(true);setNotice('Local write protection is active. Configure a separate staging Supabase project before testing leave approvals.');return;}
    const note=(notes[row.id]||'').trim();
    if(action==='REJECTED'&&note.length<3){setNotice('Enter a rejection reason of at least 3 characters.');setIsError(true);return;}
    if(!window.confirm(`${action==='APPROVED'?'Approve':'Reject'} ${row.employee_name}'s leave (${displayDate(row.start_date)}${row.start_date!==row.end_date?' – '+displayDate(row.end_date):''})?`))return;
    setWorking(row.id);setNotice('');setIsError(false);
    try{
      const response=await fetch('/api/proxy/review-leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leave_id:row.id,action,review_note:note})});
      const result=await response.json() as ReviewResult;
      if(!response.ok||result.error||result.success===false)throw new Error(result.error||'Unable to save decision');
      setRows(current=>current.map(r=>r.id===row.id?{...r,status:action,leave_type:result.final_leave_type||r.leave_type,review_note:note||null,reviewed_at:new Date().toISOString()}:r));
      setNotice(result.message||`Leave ${action.toLowerCase()}.`);
      router.refresh();
    }catch(e){setIsError(true);setNotice(e instanceof Error?e.message:'Could not save decision');}
    finally{setWorking('')}
  }
  return <div className={s.root}>
    {readOnly&&<div className={s.notice} role="status">Local read-only preview: approvals and rejections are disabled until a separate staging Supabase project is configured.</div>}
    <div className={s.stats}>
      <div><Clock3 size={20}/><span>Pending review</span><strong>{pending}</strong></div>
      <div><Check size={20}/><span>Approved</span><strong>{approved}</strong></div>
      <div><X size={20}/><span>Rejected</span><strong>{rejected}</strong></div>
    </div>
    <section className={s.panel}>
      <div className={s.header}><div><span className={s.kicker}>REQUEST MANAGEMENT</span><h2>Leave approval queue</h2><p>Decisions are recorded in Supabase and reflected in each employee&apos;s leave history.</p></div><button type="button" className={s.refresh} disabled={refreshing||!!working} onClick={()=>{setRefreshing(true);router.refresh();}}><RefreshCw size={16}/>{refreshing?'Refreshing…':'Refresh'}</button></div>
      <div className={s.controls}><div className={s.tabs} role="tablist" aria-label="Leave approval views">
        <button type="button" role="tab" aria-selected={tab==='PENDING'} className={tab==='PENDING'?s.selected:''} onClick={()=>setTab('PENDING')}>Pending <b>{pending}</b></button>
        <button type="button" role="tab" aria-selected={tab==='REVIEWED'} className={tab==='REVIEWED'?s.selected:''} onClick={()=>setTab('REVIEWED')}>Reviewed <b>{approved+rejected}</b></button>
        <button type="button" role="tab" aria-selected={tab==='ALL'} className={tab==='ALL'?s.selected:''} onClick={()=>setTab('ALL')}>All <b>{rows.length}</b></button>
      </div><label className={s.search}><Search size={16}/><input aria-label="Search leave requests" placeholder="Employee, department, reason" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
      {notice&&<div role="status" className={`${s.notice} ${isError?s.noticeError:''}`}>{isError?<X size={16}/>:<ShieldCheck size={16}/>} {notice}</div>}
      {visible.length>0?<div className={s.list}>{visible.map(row=><article className={s.item} key={row.id}>
        <div className={s.person}><div className={s.avatar}>{row.employee_name.trim().slice(0,1).toUpperCase()||'E'}</div><div><h3>{row.employee_name}</h3><p>{row.employee_code||'No code'} · {row.department_name||'No department'}</p></div></div>
        <div className={s.main}><div className={s.chips}><span className={s.type}>{leaveLabel(row.leave_type)}</span><span className={`${s.status} ${row.status==='APPROVED'?s.approved:row.status==='REJECTED'?s.rejected:s.pending}`}>{statusLabel(row.status)}</span></div>
          <div className={s.dates}><strong>{displayDate(row.start_date)}{row.start_date!==row.end_date?' — '+displayDate(row.end_date):''}</strong><small>{Number(row.total_days)||daysInclusive(row.start_date,row.end_date)} day(s)</small></div>
          <p className={s.reason}>{row.reason||'No reason given'}</p>
          {row.status==='PENDING'&&row.leave_type==='PAID'&&daysInclusive(row.start_date,row.end_date)>1&&<p className={s.hint}>This multi-day paid request may be converted to unpaid on approval under the one-day monthly policy.</p>}
          {row.status!=='PENDING'&&<div className={s.reviewed}><strong>{row.status==='APPROVED'?`Final: ${leaveLabel(row.leave_type)}`:'Leave rejected'}</strong>{row.review_note&&<p>Review note: {row.review_note}</p>}{row.reviewed_at&&<small>Reviewed on {new Date(row.reviewed_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'})}</small>}</div>}
        </div>
        {row.status==='PENDING'&&<div className={s.decisions}><label>Review note<input value={notes[row.id]||''} onChange={event=>setNotes(previous=>({...previous,[row.id]:event.target.value}))} maxLength={500} placeholder="Required to reject" aria-label={`Review note for ${row.employee_name}`}/></label><div className={s.actions}><button type="button" disabled={!!working||readOnly} className={s.approve} onClick={()=>void decide(row,'APPROVED')}><Check size={17}/> Approve</button><button type="button" disabled={!!working||readOnly} className={s.reject} onClick={()=>void decide(row,'REJECTED')}><X size={17}/> Reject</button></div></div>}
      </article>)}</div>:<div className={s.empty}><ShieldCheck size={30}/><strong>{pending===0&&tab==='PENDING'?'All caught up':'No matching leave requests'}</strong><p>{tab==='PENDING'?'There are no pending leave approvals in your permitted scope.':'Change the search or tab to see other requests.'}</p></div>}
      <p className={s.footnote}>Only requests in your authorized approval scope appear here. One paid day per calendar month; additional paid requests may be approved as unpaid by the backend.</p>
    </section>
  </div>;
}
