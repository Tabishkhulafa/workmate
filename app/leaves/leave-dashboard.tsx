'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays,CheckCircle2,Clock3,CreditCard,RefreshCw,Search,XCircle} from 'lucide-react';
import {daysInclusive,displayDate,displayMonth,indiaToday,leaveLabel,monthKey,paidPendingInMonth,paidUsedInMonth,statusLabel,validDate,type LeaveRecord} from '@/lib/leave-view';
import s from './leave-dashboard.module.css';

type Filter='ALL'|'PENDING'|'APPROVED'|'REJECTED';
type AppliedResponse={success?:boolean;error?:string;message?:string;leave_request?:LeaveRecord;converted_to_unpaid?:boolean;effective_leave_type?:string};
const tabs:{key:Filter;label:string}[]=[{key:'ALL',label:'All requests'},{key:'PENDING',label:'Pending'},{key:'APPROVED',label:'Approved'},{key:'REJECTED',label:'Rejected'}];
const LIMIT=1; // Work Mate organisation policy: one paid day per calendar month.

export default function LeaveDashboard({initial,error,policyError,monthlyAllowance,readOnly}:{initial:LeaveRecord[];error:string|null;policyError:string|null;monthlyAllowance:number|null;readOnly:boolean}){
  const router=useRouter();
  const [rows,setRows]=useState(initial),[tab,setTab]=useState<Filter>('ALL'),[search,setSearch]=useState('');
  const [today]=useState(indiaToday);
  const [start,setStart]=useState(today),[end,setEnd]=useState(today),[type,setType]=useState('PAID'),[reason,setReason]=useState('');
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[noticeError,setNoticeError]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  useEffect(()=>{setRows(initial);setRefreshing(false);},[initial]);
  const month=monthKey(start)||monthKey(today);
  const paidUsed=useMemo(()=>paidUsedInMonth(rows,month),[rows,month]);
  const paidPending=useMemo(()=>paidPendingInMonth(rows,month),[rows,month]);
  const paidAvailable=Math.max(0,LIMIT-paidUsed);
  const approvedCount=rows.filter(r=>r.status==='APPROVED').length;
  const pendingCount=rows.filter(r=>r.status==='PENDING').length;
  const rejectedCount=rows.filter(r=>r.status==='REJECTED').length;
  const days=daysInclusive(start,end);
  const paidRequest=type==='PAID';
  const willUseUnpaid=paidRequest&&(paidAvailable===0||paidPending>0||days>1);
  const visible=useMemo(()=>rows.filter(r=>{
    if(tab!=='ALL'&&r.status!==tab)return false;
    const term=search.trim().toLowerCase();
    return !term||[r.reason,r.leave_type,r.status,r.start_date,r.end_date].some(v=>String(v??'').toLowerCase().includes(term));
  }),[rows,search,tab]);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(readOnly){setNoticeError(true);setNotice('Local write protection is active. Connect a separate staging Supabase project to submit test leave requests.');return;}
    setNotice('');setNoticeError(false);
    if(!validDate(start)||!validDate(end)||days<1){setNoticeError(true);setNotice('Choose valid leave dates, with the end date on or after the start date.');return;}
    if(start<today){setNoticeError(true);setNotice('Leave cannot start before today.');return;}
    if(reason.trim().length<5){setNoticeError(true);setNotice('Please enter a reason with at least 5 characters.');return;}
    // A request is one database leave_type; do not submit 2+ dates as PAID
    // (the existing backend would convert that entire request to UNPAID).
    if(paidRequest&&days>1){setNoticeError(true);setNotice('Only one day can be requested as Paid. Submit that date separately, then submit your additional dates as Unpaid leave.');return;}
    const effectiveType=willUseUnpaid?'UNPAID':type;
    setSaving(true);
    try{
      const response=await fetch('/api/proxy/apply-leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leave_type:effectiveType,start_date:start,end_date:end,reason:reason.trim()})});
      const payload=await response.json() as AppliedResponse;
      if(!response.ok||payload.error||payload.success===false)throw new Error(payload.error||'Unable to submit leave request');
      if(payload.leave_request?.id)setRows(previous=>[payload.leave_request!,...previous.filter(r=>r.id!==payload.leave_request!.id)]);
      setTab('ALL');setReason('');
      setNotice(payload.message||(effectiveType==='UNPAID'&&type==='PAID'?'Monthly paid day is already used or pending; submitted as Unpaid leave.':'Leave request submitted for approval.'));
      router.refresh();
    }catch(e){setNoticeError(true);setNotice(e instanceof Error?e.message:'Could not submit leave request');}
    finally{setSaving(false)}
  }
  return <div className={s.root}>
    {readOnly&&<div role="status" className={s.warning}>Local read-only preview: leave submissions are disabled to protect your live employee records. Configure the separate staging Supabase project for write testing.</div>}
    <div className={s.stats}>
      <div className={s.stat}><span className={s.statIcon}><CreditCard size={18}/></span><span>Paid allowance</span><strong>{LIMIT} day <small>/ month</small></strong><small>{displayMonth(month)}</small></div>
      <div className={s.stat}><span className={s.statIcon}><CheckCircle2 size={18}/></span><span>Paid used</span><strong>{paidUsed}<small> / {LIMIT} day</small></strong><small>{paidAvailable} available · {paidPending} pending</small></div>
      <div className={s.stat}><span className={s.statIcon}><Clock3 size={18}/></span><span>Awaiting review</span><strong>{pendingCount}</strong><small>Pending leave requests</small></div>
      <div className={s.stat}><span className={s.statIcon}><CalendarDays size={18}/></span><span>Decisions</span><strong>{approvedCount}<small> approved</small></strong><small>{rejectedCount} rejected</small></div>
    </div>
    {monthlyAllowance!==null&&monthlyAllowance!==LIMIT&&<p className={s.warning}>The configured leave allowance is {monthlyAllowance} days, but the approval service enforces a maximum of one paid day. Contact Super Admin to reconcile the policy before requesting paid leave.</p>}
    {policyError&&<p className={s.warning}>Leave policy could not be loaded: {policyError}</p>}
    <section className={s.panel} aria-labelledby="apply-leave-title">
      <div className={s.sectionHeader}><div><span className={s.kicker}>NEW APPLICATION</span><h2 id="apply-leave-title">Request time off</h2><p>One paid leave day per calendar month. Additional dates are unpaid, subject to approval.</p></div><span className={s.rule}>Monthly rule · 1 paid day</span></div>
      <form onSubmit={event=>void submit(event)} className={s.form}>
        <label>Leave type<select value={type} onChange={e=>setType(e.target.value)}><option value="PAID">Paid leave</option><option value="UNPAID">Unpaid leave</option><option value="OTHER">Other leave</option></select></label>
        <label>Start date<input type="date" required min={today} value={start} onChange={e=>{setStart(e.target.value);if(end<e.target.value)setEnd(e.target.value);}}/></label>
        <label>End date<input type="date" required min={start||today} value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <label className={s.full}>Reason<textarea required rows={3} minLength={5} maxLength={500} placeholder="Briefly explain the reason for your leave" value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <div className={s.formFooter}>
          <p>{paidRequest&&days>1?'For a multi-day absence, request the paid day separately and the remaining dates as unpaid.':paidRequest&&willUseUnpaid?'Paid allowance is used or pending. This one-day request will be sent as unpaid.':paidRequest?'This request will be sent as paid, pending approval.':`${days||0} day${days===1?'':'s'} requested. Final type and status are confirmed by HR.`}</p>
          <button className={s.primary} disabled={saving||readOnly} type="submit">{saving?'Submitting…':'Submit leave request'}</button>
        </div>
      </form>
      {notice&&<div className={`${s.notice} ${noticeError?s.noticeError:''}`} role="status">{noticeError?<XCircle size={18}/>:<CheckCircle2 size={18}/>}<span>{notice}</span></div>}
    </section>
    <section className={s.panel} aria-labelledby="request-list-title">
      <div className={s.sectionHeader}><div><span className={s.kicker}>APPLICATION TRACKER</span><h2 id="request-list-title">My requests</h2><p>Track pending decisions and view approved or rejected leaves with reviewer notes.</p></div><button className={s.refresh} disabled={refreshing} onClick={()=>{setRefreshing(true);router.refresh();}} type="button"><RefreshCw size={16}/>{refreshing?'Refreshing…':'Refresh status'}</button></div>
      <div className={s.controls}>
        <div className={s.tabs} role="tablist" aria-label="Filter requests by approval status">{tabs.map(item=><button key={item.key} type="button" role="tab" aria-selected={tab===item.key} className={tab===item.key?s.activeTab:''} onClick={()=>setTab(item.key)}>{item.label}<b>{item.key==='ALL'?rows.length:rows.filter(r=>r.status===item.key).length}</b></button>)}</div>
        <label className={s.search}><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search my leave requests" placeholder="Search requests"/></label>
      </div>
      {error&&<div className={s.warning} role="alert">Unable to load existing requests: {error}. Please refresh after checking your connection.</div>}
      {visible.length>0?<div className={s.list}>{visible.map(row=><article className={s.item} key={row.id}>
        <div className={s.itemMain}><div className={s.itemTop}><span className={s.type}>{leaveLabel(row.leave_type)}</span><span className={`${s.status} ${row.status==='APPROVED'?s.approved:row.status==='REJECTED'?s.rejected:s.pending}`}>{statusLabel(row.status)}</span></div><h3>{displayDate(row.start_date)} {row.start_date!==row.end_date?`— ${displayDate(row.end_date)}`:''}</h3><p className={s.muted}>{Number(row.total_days)||daysInclusive(row.start_date,row.end_date)} day(s) · {row.reason||'No reason provided'}</p></div>
        {row.status!=='PENDING'&&<div className={s.reviewInfo}><span>{row.status==='APPROVED'?'Approved leave':'Review decision'}</span><strong>{row.status==='APPROVED'?leaveLabel(row.leave_type):'Rejected'}</strong>{row.review_note&&<small>Reviewer note: {row.review_note}</small>}{row.reviewed_at&&<small>Reviewed {new Date(row.reviewed_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'})}</small>}</div>}
      </article>)}</div>:<div className={s.empty}><CalendarDays size={26}/><strong>No {tab==='ALL'?'leave':tab.toLowerCase()} requests to show</strong><p>{rows.length?'Try a different filter or search.':'Submit your first leave request to see its approval status here.'}</p></div>}
    </section>
  </div>;
}
