'use client';
import {useState} from 'react';
type Policy={id:string;monthly_paid_leave_days:number};
export default function LeavePolicyEditor({initial}:{initial:Policy|null}){
 const [days,setDays]=useState(initial?.monthly_paid_leave_days??1),[id,setId]=useState(initial?.id||''),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 async function save(){if(!Number.isInteger(days)||days<0||days>31){setNotice('Enter a whole number from 0 to 31.');return;}if(!window.confirm('Save organisation-wide monthly paid leave policy?'))return;
  setSaving(true);setNotice('');try{const res=await fetch('/api/leave-policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({monthly_paid_leave_days:days})});const body=await res.json() as {error?:string;id?:string};if(!res.ok)throw Error(body.error||'Unable to save leave policy');setId(body.id||id);setNotice('Leave policy saved.');}catch(e){setNotice(e instanceof Error?e.message:'Save failed');}finally{setSaving(false)}
 }
 return <div className="card" style={{maxWidth:560,display:'grid',gap:16}}><label>Monthly paid leave allowance<input type="number" min={0} max={31} step={1} value={days} onChange={e=>setDays(Number(e.target.value))}/></label><button type="button" disabled={saving} onClick={()=>void save()}>{saving?'Saving...':id?'Save leave policy':'Create leave policy'}</button>{notice&&<p role="status" className="notice">{notice}</p>}</div>;
}
