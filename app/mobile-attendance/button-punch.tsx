 'use client';
import {useEffect,useState} from 'react';
type Status={active:boolean;expires_at:string|null};
export default function ButtonPunch(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('Checking temporary button attendance permission...');
 async function call(body:Record<string,unknown>){const res=await fetch('/api/mobile-attendance/button',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Request failed');return data}
 async function refresh(){try{const r=await call({action:'STATUS'});setStatus(r);setMessage(r.active?'Temporary manual attendance permission active':'No active temporary button permission')}catch(e){setMessage(e instanceof Error?e.message:'Could not check permissions')}}
 useEffect(()=>{void refresh()},[]);
 async function punch(action:'CLOCK_IN'|'CLOCK_OUT'){
  if(!window.isSecureContext){setMessage('Open Work Mate using an HTTPS URL on your iPhone to use GPS.');return}
  if(!navigator.geolocation){setMessage('GPS not supported');return}
  setBusy(true);setMessage('Getting fresh GPS location...');
  try{const loc=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
    const result=await call({action,latitude:loc.coords.latitude,longitude:loc.coords.longitude,accuracy:loc.coords.accuracy,captured_at:loc.timestamp});
    setMessage(result.success?`${action==='CLOCK_IN'?'Clock In':'Clock Out'} recorded successfully. Open My Attendance History to verify.`:'Attendance not recorded');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Punch failed')}finally{setBusy(false)}
 }
 return <div className="card" style={{padding:20,marginTop:20}}><h2>Temporary button attendance</h2><p>Only works with an active HR/Super Admin approval. GPS and server checks are compulsory.</p><p role="status">{message}</p>{status?.active&&<p>Permission active until HR / Super Admin revokes it{status.expires_at?` (legacy grant expires ${new Date(status.expires_at).toLocaleString('en-IN')})`:''}.</p>}<div className="reportactions"><button onClick={()=>void refresh()} disabled={busy}>Refresh permission</button><button onClick={()=>void punch('CLOCK_IN')} disabled={busy||!status?.active}>Button Clock In</button><button onClick={()=>void punch('CLOCK_OUT')} disabled={busy||!status?.active}>Button Clock Out</button></div><p><a href="/my-attendance-history">View my attendance history →</a></p><p style={{fontSize:13,opacity:.75}}>Regular Face + GPS attendance requires separate verified biometric proof. This temporary button option is available only while HR approval remains active.</p></div>
}
