'use client';
import { useCallback, useEffect, useState } from 'react';

type Request={id:string;full_name:string;requested_login:string;requested_role:string;department_name:string|null;email:string|null;phone:string|null;requested_at:string;reset_code_expires_at:string|null};
type CodeResult={code:string;email:string;expires_at:string;request_id:string};
async function request(body:Record<string,unknown>){
 const r=await fetch('/api/proxy/review-password-reset-request',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({error:'Invalid API response'}));
 if(!r.ok||d.error) throw Error(String(d.error||'Password reset review failed'));
 return d;
}
const dateIst=(value:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value));
export default function PasswordResetReview(){
 const [items,setItems]=useState<Request[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[generated,setGenerated]=useState<CodeResult|null>(null),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{const d=await request({action:'LIST'});setItems((d.requests||[]) as Request[])}catch(e){setError(e instanceof Error?e.message:'Unable to load requests')}finally{setLoading(false)}},[]);
 useEffect(()=>{void refresh()},[refresh]);
 async function generate(item:Request){if(busy)return;if(!window.confirm(`Generate a new 8-digit reset code for ${item.full_name}?`))return;setBusy(item.id);setError('');setGenerated(null);setNotice('');try{const d=await request({action:'GENERATE_CODE',request_id:item.id});if(!/^\d{8}$/.test(String(d.code)))throw Error('Backend did not return a valid code.');setGenerated({code:d.code,email:d.email,expires_at:d.expires_at,request_id:item.id});setNotice('New code generated. Share it privately with the employee.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to generate code')}finally{setBusy('')}}
 async function dismiss(item:Request){if(busy)return;if(!window.confirm(`Dismiss the password-reset request for ${item.full_name}?`))return;setBusy(item.id);setError('');setGenerated(null);try{await request({action:'DISMISS',request_id:item.id});await refresh()}catch(e){setError(e instanceof Error?e.message:'Dismiss failed')}finally{setBusy('')}}
 return <section className="card wm-reset-panel">
  <div className="wm-reset-toolbar"><div><strong>Pending requests ({items.length})</strong><p className="muted small">Mobile-friendly cards on phone, full controls on desktop.</p></div><button type="button" className="secondary" disabled={loading||Boolean(busy)} onClick={()=>void refresh()}>{loading?'Loading…':'Refresh requests'}</button></div>
  {generated&&<div className="wm-reset-code" role="status"><div><strong>One-time code</strong><p className="muted small">For {generated.email} · Expires {dateIst(generated.expires_at)} IST</p></div><div className="wm-reset-code-row"><code>{generated.code}</code><button type="button" onClick={()=>void navigator.clipboard.writeText(generated.code)}>Copy code</button></div><p className="muted small">This code appears only after generation. Do not share it publicly.</p></div>}
  {notice&&<p className="notice" role="status">{notice}</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {!loading&&items.length===0&&<div className="wm-reset-empty"><strong>All caught up</strong><p className="muted">No pending password reset requests.</p></div>}
  <div className="wm-reset-grid">{items.map(item=><article key={item.id} className="wm-reset-request">
   <div className="wm-reset-header"><div><strong>{item.full_name}</strong><p className="muted small">{item.requested_role.replaceAll('_',' ')} · {item.department_name||'Department not assigned'}</p></div><small className="muted">{dateIst(item.requested_at)} IST</small></div>
   <div className="wm-reset-meta">
    <div><span>Request login</span><b>{item.requested_login}</b></div>
    <div><span>Registered email</span><b>{item.email||'Not registered'}</b></div>
    <div><span>Mobile</span><b>{item.phone||'Not registered'}</b></div>
   </div>
   <div className="wm-reset-buttons"><button type="button" disabled={Boolean(busy)||!item.email} onClick={()=>void generate(item)}>{busy===item.id?'Working…':'Generate 8-digit code'}</button><button type="button" className="secondary" disabled={Boolean(busy)} onClick={()=>void dismiss(item)}>Dismiss</button></div>
   {!item.email&&<p className="muted small">A registered email is required by the current backend for verification.</p>}
  </article>)}</div>
 </section>;
}
