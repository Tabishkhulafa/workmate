'use client';
import {useState} from 'react';
type Settings={id:string;late_grace_minutes:number;geo_location_required:boolean;face_verification_required:boolean;minimum_gps_accuracy_meters:number};
export default function AttendanceSettingsForm({initial}:{initial:Settings|null}){
 const [grace,setGrace]=useState(initial?.late_grace_minutes??15);
 const [gps,setGps]=useState(initial?.geo_location_required??true);
 const [face,setFace]=useState(initial?.face_verification_required??true);
 const [accuracy,setAccuracy]=useState(initial?.minimum_gps_accuracy_meters??100);
 const [loading,setLoading]=useState(false);const [result,setResult]=useState('');
 const save=async()=>{
  setResult('');if(!Number.isInteger(grace)||grace<0||grace>180||!Number.isInteger(accuracy)||accuracy<5||accuracy>1000){setResult('Grace must be 0–180 minutes and accuracy 5–1000 metres.');return;}
  if(!gps||!face){if(!window.confirm('This disables a face or location requirement. Confirm policy change?'))return;}
  setLoading(true);
  try{const res=await fetch('/api/attendance-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({late_grace_minutes:grace,geo_location_required:gps,face_verification_required:face,minimum_gps_accuracy_meters:accuracy})});
  const data=await res.json();setResult(res.ok?'Settings saved. Verify on Android.':data.error||'Save failed');}
  catch{setResult('Network error. Try again.')}finally{setLoading(false)}
 };
 return <div className="card" style={{maxWidth:760}}>
 <div className="formgrid"><label>Late grace minutes<input type="number" min={0} max={180} value={grace} onChange={e=>setGrace(Number(e.target.value))}/></label>
 <label>Minimum GPS accuracy (metres)<input type="number" min={5} max={1000} value={accuracy} onChange={e=>setAccuracy(Number(e.target.value))}/></label></div>
 <div style={{display:'grid',gap:14,margin:'18px 0'}}><label style={{margin:0,display:'flex',alignItems:'center',gap:12}}><input type="checkbox" checked={gps} onChange={e=>setGps(e.target.checked)} style={{width:20,margin:0}}/>Require GPS for attendance</label>
 <label style={{margin:0,display:'flex',alignItems:'center',gap:12}}><input type="checkbox" checked={face} onChange={e=>setFace(e.target.checked)} style={{width:20,margin:0}}/>Require face verification</label></div>
 <p className="muted small">Current settings {initial?'loaded from Supabase':'not found: saving will create the first active settings row'}.</p>
 <button onClick={save} disabled={loading}>{loading?'Saving...':'Save attendance settings'}</button>
 {result&&<div className="notice" role="status">{result}</div>}
 </div>;
}
