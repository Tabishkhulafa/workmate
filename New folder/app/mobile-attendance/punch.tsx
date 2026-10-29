'use client';
import {useEffect,useRef,useState} from 'react';
import {loadFaceModel} from '@/lib/mobile-attendance/browser-face-model';
import {buildStableFace, captureFaceObservation, type FaceObservation} from '@/lib/mobile-attendance/face-capture-quality';
type Office={id:string;name:string;is_default?:boolean};
type GPS={latitude:number;longitude:number;accuracy:number;timestamp:number};
type Action='CLOCK_IN'|'CLOCK_OUT';
type Today={date:string;clock_in_at:string|null;clock_out_at:string|null;clock_in_location:string|null;clock_out_location:string|null;status:string};
function clockTime(value:string|null|undefined){if(!value)return 'Not recorded';const d=new Date(value);if(Number.isNaN(d.getTime()))return 'Time unavailable';return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit',hour12:true}).format(d)+' IST';}
async function post(path:string,body:unknown){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const j=await r.json().catch(()=>({error:'Server returned an invalid response'}));if(!r.ok)throw Error(j.error||'Request failed');return j;}
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export default function MobilePunch(){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),busyRef=useRef(false);
 const [today,setToday]=useState<Today|null>(null),[todayLoading,setTodayLoading]=useState(true),[todayError,setTodayError]=useState('');
 const [offices,setOffices]=useState<Office[]>([]),[office,setOffice]=useState(''),[status,setStatus]=useState('Choose office and tap Clock In or Clock Out.'),[busy,setBusy]=useState(false),[gpsStatus,setGpsStatus]=useState(''),[success,setSuccess]=useState(false);
 useEffect(()=>{let active=true;void(async()=>{try{const r=await fetch('/api/mobile-attendance/locations',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Cannot load offices');if(active){const list=(j.locations||[]) as Office[];setOffices(list);setOffice(list.find(x=>x.is_default)?.id||list[0]?.id||'')}}catch(e){if(active)setStatus(e instanceof Error?e.message:'Office unavailable')}})();return()=>{active=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null}},[]);
 async function refreshToday(){setTodayLoading(true);try{const r=await fetch('/api/mobile-attendance/today',{cache:'no-store'});const d=await r.json().catch(()=>({error:'Invalid attendance status response'}));if(!r.ok)throw Error(d.error||'Could not load attendance status');setToday(d as Today);setTodayError('');return d as Today;}catch(e){setTodayError(e instanceof Error?e.message:'Cannot load today attendance');return null;}finally{setTodayLoading(false)}}
 useEffect(()=>{void refreshToday();const onFocus=()=>void refreshToday();const onVisible=()=>{if(document.visibilityState==='visible')void refreshToday();};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[]);
 function closeCamera(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;}
 async function openCamera(){if(!window.isSecureContext)throw Error('Use HTTPS on iPhone Safari');const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false});stream.current=s;if(!video.current)throw Error('Camera preview not ready');video.current.srcObject=s;await video.current.play();}
 const freshGps=()=>new Promise<GPS>((resolve,reject)=>{if(!navigator.geolocation)return reject(Error('GPS unavailable'));navigator.geolocation.getCurrentPosition(p=>{const g={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};setGpsStatus(`GPS ±${Math.round(g.accuracy)}m`);resolve(g)},e=>reject(Error('GPS: '+e.message)),{enableHighAccuracy:true,maximumAge:0,timeout:20000})});
 async function scan(action:Action){if(busyRef.current)return;busyRef.current=true;setBusy(true);setSuccess(false);
 try{
  if(!office)throw Error('Choose your office first');setStatus('Confirming today attendance…');const current=await refreshToday();if(!current)throw Error('Cannot verify today attendance. Please retry.');if(action==='CLOCK_IN'&&current.clock_in_at)throw Error('Already clocked in today at '+clockTime(current.clock_in_at));if(action==='CLOCK_OUT'&&!current.clock_in_at)throw Error('Clock In is required before Clock Out.');if(action==='CLOCK_OUT'&&current.clock_out_at)throw Error('Already clocked out today at '+clockTime(current.clock_out_at));setStatus('Checking precise GPS…');let gps=await freshGps();
  await post('/api/mobile-attendance/prepare',{action,office_id:office,gps});
  setStatus('Loading face model…');await loadFaceModel();
  setStatus('Opening front camera…');await openCamera();setStatus('Scanning your face… Look straight into the camera and keep still.');
  const frames:FaceObservation[]=[];const deadline=Date.now()+16000;
  while(Date.now()<deadline&&frames.length<5){
   try{
    const v=video.current;if(!v)throw Error('Camera unavailable');
    frames.push(await captureFaceObservation(v,'frame'));
    setStatus(`Checking face quality (${frames.length}/5)… Keep still.`);
   }catch(e){if(Date.now()>=deadline-1000&&frames.length<3)throw e;}
   if(frames.length<5)await sleep(450);
  }
  const stable=buildStableFace(frames);
  closeCamera();
  // Cold-start model loading can age the GPS reading; refresh and recheck
  // the office fence if the capture took too long. The server still validates.
  if(Date.now()-gps.timestamp>35000){
   setStatus('Refreshing office GPS…');gps=await freshGps();
   await post('/api/mobile-attendance/prepare',{action,office_id:office,gps});
  }
  setStatus('Matching your registered face…');
  // The server remains the only authority for identity; do not lower its 0.72 threshold.
  let verified: {verification_token:string};
  try{
   verified=await post('/api/mobile-attendance/verify',{action,embedding:stable.embedding,gps});
  }catch(e){
   const msg=e instanceof Error?e.message:String(e);
   if(!/face does not match|face_mismatch/i.test(msg))throw e;
   // One controlled fallback for existing enrollments stored as a single frame.
   // Both embeddings came from the SAME consistent multi-frame scan.
   setStatus('Checking a second stable face sample…');
   verified=await post('/api/mobile-attendance/verify',{action,embedding:stable.medoid,gps});
  }
  const captured=stable.photo;
  setStatus('Saving attendance evidence…');await post('/api/mobile-attendance/evidence',{verification_token:verified.verification_token,image_base64:captured});
  setStatus('Saving attendance…');const punched=await post('/api/mobile-attendance/punch',{action,verification_token:verified.verification_token,gps});
  if(punched.attendance_recorded!==true)throw Error('Attendance was not confirmed. Check history before retrying.');
  setSuccess(true);setStatus(action==='CLOCK_IN'?'Clock In Successful ✓':'Clock Out Successful ✓');await refreshToday();
 }catch(e){const message=e instanceof Error?e.message:'Unable to mark attendance';setStatus(/face.*match|FACE_MISMATCH/i.test(message)?'Face does not match. Try again.':message)}finally{closeCamera();setBusy(false);busyRef.current=false}}
 return <div className="card wm-face-punch">
  <div className="wm-punch-intro"><strong>Face attendance</strong><span>Scan your registered face for a few seconds inside the approved office.</span></div>
  <div className="wm-punch-today" aria-live="polite"><div className="wm-punch-today-header"><strong>Today's attendance</strong><span>{today?.date||'Loading date…'}</span><button type="button" className="wm-punch-refresh" disabled={busy||todayLoading} onClick={()=>void refreshToday()}>{todayLoading?'Checking…':'Refresh status'}</button></div><div className="wm-punch-time-grid"><div className="wm-punch-time"><span>Clock In</span><strong>{todayLoading&&!today?'Loading…':clockTime(today?.clock_in_at)}</strong><small>{today?.clock_in_at?'Completed':'Not yet recorded'}</small><div className="wm-punch-place"><span aria-hidden="true">⌖</span> {today?.clock_in_location||'Location not saved'}</div></div><div className="wm-punch-time"><span>Clock Out</span><strong>{todayLoading&&!today?'Loading…':clockTime(today?.clock_out_at)}</strong><small>{today?.clock_out_at?'Completed':'Not yet recorded'}</small><div className="wm-punch-place"><span aria-hidden="true">⌖</span> {today?.clock_out_location||(today?.clock_out_at?'Location not saved':'Pending Clock Out')}</div></div></div>{todayError&&<div className="wm-punch-status-error">{todayError} — Attendance buttons are disabled until status loads.</div>}</div>
  <label>Office<select value={office} disabled={busy} onChange={e=>setOffice(e.target.value)}><option value="">Select office</option>{offices.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
  <div className="wm-camera-frame"><video ref={video} autoPlay playsInline muted/></div>
  <div className="wm-punch-buttons"><button type="button" disabled={busy||!office||todayLoading||!today||Boolean(today.clock_in_at)} onClick={()=>void scan('CLOCK_IN')}>{busy?'Scanning…':today?.clock_in_at?'Clock In Completed':'Face Clock In'}</button><button type="button" disabled={busy||!office||todayLoading||!today||!today.clock_in_at||Boolean(today.clock_out_at)} onClick={()=>void scan('CLOCK_OUT')}>{busy?'Scanning…':today?.clock_out_at?'Clock Out Completed':'Face Clock Out'}</button></div>
  <p role="status" className={success?'wm-punch-result wm-punch-result-ok':'wm-punch-result'}>{status}</p>{gpsStatus&&<small className="muted">{gpsStatus}</small>}
  <p style={{fontSize:12,opacity:.8}}>Face matching is not anti-spoofing: a photo or screen replay may fool it. GPS must be inside an approved office. Attendance success appears only after database confirmation.</p>
  <div style={{display:'flex',gap:15,flexWrap:'wrap'}}><a href="/mobile-attendance/enroll">Face enrollment/status</a><a href="/my-attendance-history">Attendance history</a><a href="/mobile-attendance/button">HR-approved Button + GPS</a></div>
 </div>
}
