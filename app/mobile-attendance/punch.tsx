'use client';
import {useEffect,useRef,useState} from 'react';
import {loadFaceModel} from '@/lib/mobile-attendance/browser-face-model';
import {captureFaceObservation, type FaceObservation, type StableFace} from '@/lib/mobile-attendance/face-capture-quality';
import {loadSafariDetector} from '@/lib/mobile-attendance/safari-face-detector';
import {selectStableScan} from '@/lib/mobile-attendance/fast-scan-consensus';
import {acquireVerifiedGps} from '@/lib/mobile-attendance/compatible-gps';
type Office={id:string;name:string;is_default?:boolean};
type GPS={latitude:number;longitude:number;accuracy:number;timestamp:number};
type Action='CLOCK_IN'|'CLOCK_OUT';
type Today={date:string;clock_in_at:string|null;clock_out_at:string|null;clock_in_location:string|null;clock_out_location:string|null;status:string};
function clockTime(value:string|null|undefined){if(!value)return 'Not recorded';const d=new Date(value);if(Number.isNaN(d.getTime()))return 'Time unavailable';return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit',hour12:true}).format(d)+' IST';}
class AttendanceRequestError extends Error {constructor(message:string,readonly code:string){super(message);this.name='AttendanceRequestError';}}
async function post(path:string,body:unknown){
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const j=await r.json().catch(()=>({error:'Server returned an invalid response'}));
 if(!r.ok)throw new AttendanceRequestError(String(j.error||'Request failed'),String(j.code||''));
 return j;
}
async function checkFaceEnrollment(){
 const r=await fetch('/api/mobile-attendance/enrollment?mode=punch',{cache:'no-store'});
 const j=await r.json().catch(()=>({error:'Unable to check face enrollment'}));
 if(!r.ok)throw Error(j.error||'Unable to check face enrollment');
 if(j.enrolled!==true)throw new AttendanceRequestError('FACE_NOT_ENROLLED','FACE_NOT_ENROLLED');
 if(j.model_name&&j.model_name!=='mobilefacenet')throw Error('Enrolled face uses an incompatible model. Request an approved face change.');
}

const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const seconds=(milliseconds:number|undefined)=>milliseconds===undefined?'–':(milliseconds/1000).toFixed(1)+'s';
export default function MobilePunch(){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),busyRef=useRef(false);
 const [today,setToday]=useState<Today|null>(null),[todayLoading,setTodayLoading]=useState(true),[todayError,setTodayError]=useState('');
 const [offices,setOffices]=useState<Office[]>([]),[office,setOffice]=useState(''),[status,setStatus]=useState('Choose office and tap Clock In or Clock Out.'),[busy,setBusy]=useState(false),[gpsStatus,setGpsStatus]=useState(''),[success,setSuccess]=useState(false);
 const [scanTimings,setScanTimings]=useState('');
 const [gpsRetryBusy,setGpsRetryBusy]=useState(false);
 const [gpsFailed,setGpsFailed]=useState(false);
 const gpsRetryCache=useRef<GPS|null>(null);
 useEffect(()=>{let active=true;void(async()=>{try{const r=await fetch('/api/mobile-attendance/locations',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Cannot load offices');if(active){const list=(j.locations||[]) as Office[];setOffices(list);setOffice(list.find(x=>x.is_default)?.id||list[0]?.id||'')}}catch(e){if(active)setStatus(e instanceof Error?e.message:'Office unavailable')}})();return()=>{active=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null}},[]);
 async function refreshToday(){setTodayLoading(true);try{const r=await fetch('/api/mobile-attendance/today',{cache:'no-store'});const d=await r.json().catch(()=>({error:'Invalid attendance status response'}));if(!r.ok)throw Error(d.error||'Could not load attendance status');setToday(d as Today);setTodayError('');return d as Today;}catch(e){setTodayError(e instanceof Error?e.message:'Cannot load today attendance');return null;}finally{setTodayLoading(false)}}
 useEffect(()=>{void refreshToday();const onFocus=()=>void refreshToday();const onVisible=()=>{if(document.visibilityState==='visible')void refreshToday();};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[]);
 // Start downloading and initializing the recognition model after first paint.
 // Both loaders already share a single cached promise across calls, so a quick
 // button tap can safely join the warm-up rather than starting a duplicate load.
 // Run sequentially to avoid loading two large WASM runtimes simultaneously on iOS.
 // The warm-up never opens the camera, requests GPS, or sends biometric data.
 useEffect(()=>{const id=window.setTimeout(()=>{void loadFaceModel().then(()=>loadSafariDetector()).catch(()=>{
  // Warm-up is optional: the explicit scan path reports loader errors and can retry.
 });},450);return()=>window.clearTimeout(id)},[]);
 function closeCamera(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;}
 async function openCamera(){if(!window.isSecureContext)throw Error('Use HTTPS on iPhone Safari');const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false});stream.current=s;if(!video.current)throw Error('Camera preview not ready');video.current.srcObject=s;await video.current.play();}
 const freshGps=async():Promise<GPS>=>{
  setGpsStatus('Locating… GPS may take up to 40 seconds on older devices.');
  try{
   const gps=await acquireVerifiedGps();
   setGpsStatus(`GPS ready ±${Math.round(gps.accuracy)}m`);
   setGpsFailed(false);
   return gps;
  }catch(e){setGpsFailed(true);throw e;}
 };
 async function retryLocation(){
  if(busyRef.current||gpsRetryBusy)return;
  setGpsRetryBusy(true);setGpsFailed(false);
  try{
   const gps=await freshGps();
   gpsRetryCache.current=gps;
   setStatus('GPS ready. Tap Face Clock In or Face Clock Out.');
  }catch(e){setStatus(e instanceof Error?e.message:'GPS unavailable. Check Location and retry.');}
  finally{setGpsRetryBusy(false);}
 }
 async function scan(action:Action){
  if(busyRef.current)return;
  busyRef.current=true;
  setBusy(true);
  setSuccess(false);
  setScanTimings('');
  const began=performance.now();
  const steps:Record<string,number>={};
  const timed=async <T,>(name:string, work:()=>Promise<T>):Promise<T>=>{
   const started=performance.now();
   try{return await work();}finally{steps[name]=performance.now()-started;}
  };
  try{
   if(!office)throw Error('Choose your office first');
   setStatus('Checking enrollment, attendance and precise GPS…');
   // These are independent preconditions. Run them concurrently but do not
   // bypass or cache their answers; every scan receives fresh server checks.
   const cached=gpsRetryCache.current;
   gpsRetryCache.current=null;
   const usableCached=cached && Date.now()-cached.timestamp<=15000 && cached.accuracy<=100;
   const [,current,initialGps]=await Promise.all([
    timed('enrollment',checkFaceEnrollment),
    timed('attendance',refreshToday),
    timed('gps',()=>usableCached?Promise.resolve(cached as GPS):freshGps()),
   ]);
   if(!current)throw Error('Cannot verify today attendance. Please retry.');
   if(action==='CLOCK_IN'&&current.clock_in_at)throw Error('Already clocked in today at '+clockTime(current.clock_in_at));
   if(action==='CLOCK_OUT'&&!current.clock_in_at)throw Error('Clock In is required before Clock Out.');
   if(action==='CLOCK_OUT'&&current.clock_out_at)throw Error('Already clocked out today at '+clockTime(current.clock_out_at));
   let gps=initialGps;
   setStatus('Verifying approved office geofence…');
   await timed('geofence',()=>post('/api/mobile-attendance/prepare',{action,office_id:office,gps}));

   setStatus('Preparing face scanner…');
   // Load both dependencies before opening the camera. A successful idle warm-up
   // makes this almost instantaneous; cold-start remains supported.
   await timed('model',()=>Promise.all([loadFaceModel(),loadSafariDetector()]));
   setStatus('Opening front camera…');
   await timed('camera',openCamera);
   setStatus('Scanning your face… Look straight into the camera and keep still.');
   const captureStart=performance.now();
   const frames:FaceObservation[]=[];
   const deadline=Date.now()+16000;
   let lastCaptureFailure='';
   let stable:StableFace|null=null;
   try{
    while(Date.now()<deadline && frames.length<5 && !stable){
     try{
      const v=video.current;
      if(!v)throw Error('Camera unavailable');
      frames.push(await captureFaceObservation(v,'frame'));
      // Keep at least three agreeing captures, exactly as before. Do not stop
      // early if quality/consistency checks reject the first three frames.
      stable=selectStableScan(frames);
      if(!stable){setStatus(`Checking face quality (${frames.length}/5)… Keep still.`);}
     }catch(e){
      // A bad frame is ignored, but a terminal consensus error is not.
      if(frames.length>=5)throw e;
      lastCaptureFailure=e instanceof Error?e.message:'Face capture failed';
      if(Date.now()>=deadline-1000&&frames.length<3)throw Error(lastCaptureFailure);
     }
     if(!stable&&frames.length<5)await sleep(450);
    }
    if(!stable){
     if(frames.length<3)throw Error(lastCaptureFailure||'Face not detected consistently. Keep one face centered in good light.');
     // If 3–4 frames never agreed, preserve the original final consensus error.
     stable=selectStableScan(frames,frames.length);
     if(!stable)throw Error('Face scan is incomplete. Try again in even light.');
    }
   }finally{steps.capture=performance.now()-captureStart;}
   closeCamera();
   // Model loading on older phones can age GPS; refresh and recheck its office
   // geofence when necessary. Server-side verification is always authoritative.
   if(Date.now()-gps.timestamp>35000){
    setStatus('Refreshing office GPS…');
    gps=await timed('gpsRefresh',freshGps);
    await timed('geofenceRefresh',()=>post('/api/mobile-attendance/prepare',{action,office_id:office,gps}));
   }
   setStatus('Matching your registered face…');
   let verified:{verification_token:string};
   try{
    verified=await timed('faceMatch',()=>post('/api/mobile-attendance/verify',{action,embedding:stable.embedding,gps}));
   }catch(e){
    const code=e instanceof AttendanceRequestError?e.code:'';
    if(code!=='FACE_MISMATCH')throw e;
    // Existing controlled compatibility fallback, from the SAME scan only.
    setStatus('Checking a second stable face sample…');
    verified=await timed('faceMatchRetry',()=>post('/api/mobile-attendance/verify',{action,embedding:stable.medoid,gps}));
   }
   setStatus('Saving attendance evidence…');
   await timed('evidence',()=>post('/api/mobile-attendance/evidence',{verification_token:verified.verification_token,image_base64:stable.photo}));
   setStatus('Saving attendance…');
   const punched=await timed('punch',()=>post('/api/mobile-attendance/punch',{action,verification_token:verified.verification_token,gps}));
   if(punched.attendance_recorded!==true)throw Error('Attendance was not confirmed. Check history before retrying.');
   setSuccess(true);
   setStatus(action==='CLOCK_IN'?'Clock In Successful ✓':'Clock Out Successful ✓');
   await refreshToday();
  }catch(e){
   const message=e instanceof Error?e.message:'Unable to mark attendance';
   const code=e instanceof AttendanceRequestError?e.code:'';
   setStatus(code==='FACE_NOT_ENROLLED'?'No enrolled face found for this account. Open My face enrollment and register your face before Clock In.':code==='FACE_MISMATCH'?'Registered face did not match. Retry in good light; if it persists, submit a Face Change request for HR approval.':message);
  }finally{
   closeCamera();
   setBusy(false);
   busyRef.current=false;
   // Local-only stage metrics: no face vectors, photos, GPS coordinates or
   // employee identifiers are logged or sent to any analytics service.
   setScanTimings(`Total ${seconds(performance.now()-began)} · GPS ${seconds(steps.gps)} · Scanner ${seconds(steps.model)} · Face capture ${seconds(steps.capture)} · Match ${seconds((steps.faceMatch||0)+(steps.faceMatchRetry||0))} · Evidence ${seconds(steps.evidence)} · Save ${seconds(steps.punch)}`);
  }
 }
 return <div className="card wm-face-punch">
  <div className="wm-punch-intro"><strong>Face attendance</strong><span>Scan your registered face for a few seconds inside the approved office.</span></div>
  <div className="wm-punch-today" aria-live="polite"><div className="wm-punch-today-header"><strong>Today's attendance</strong><span>{today?.date||'Loading date…'}</span><button type="button" className="wm-punch-refresh" disabled={busy||todayLoading} onClick={()=>void refreshToday()}>{todayLoading?'Checking…':'Refresh status'}</button></div><div className="wm-punch-time-grid"><div className="wm-punch-time"><span>Clock In</span><strong>{todayLoading&&!today?'Loading…':clockTime(today?.clock_in_at)}</strong><small>{today?.clock_in_at?'Completed':'Not yet recorded'}</small><div className="wm-punch-place"><span aria-hidden="true">⌖</span> {today?.clock_in_location||'Location not saved'}</div></div><div className="wm-punch-time"><span>Clock Out</span><strong>{todayLoading&&!today?'Loading…':clockTime(today?.clock_out_at)}</strong><small>{today?.clock_out_at?'Completed':'Not yet recorded'}</small><div className="wm-punch-place"><span aria-hidden="true">⌖</span> {today?.clock_out_location||(today?.clock_out_at?'Location not saved':'Pending Clock Out')}</div></div></div>{todayError&&<div className="wm-punch-status-error">{todayError} — Attendance buttons are disabled until status loads.</div>}</div>
  <label>Office<select value={office} disabled={busy} onChange={e=>setOffice(e.target.value)}><option value="">Select office</option>{offices.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
  <div className="wm-camera-frame"><video ref={video} autoPlay playsInline muted/></div>
  <div className="wm-punch-buttons"><button type="button" disabled={busy||!office||todayLoading||!today||Boolean(today.clock_in_at)} onClick={()=>void scan('CLOCK_IN')}>{busy?'Scanning…':today?.clock_in_at?'Clock In Completed':'Face Clock In'}</button><button type="button" disabled={busy||!office||todayLoading||!today||!today.clock_in_at||Boolean(today.clock_out_at)} onClick={()=>void scan('CLOCK_OUT')}>{busy?'Scanning…':today?.clock_out_at?'Clock Out Completed':'Face Clock Out'}</button></div>
  {gpsFailed&&<div style={{margin:'10px 0'}}><button type="button" disabled={busy||gpsRetryBusy} onClick={()=>void retryLocation()}>{gpsRetryBusy?'Finding GPS…':'Retry GPS Location'}</button><small style={{display:'block',marginTop:6}}>Switch on Location, move near a window, and allow browser location access. GPS accuracy and approved office checks still apply.</small></div>}
  <p role="status" className={success?'wm-punch-result wm-punch-result-ok':'wm-punch-result'}>{status}</p>{scanTimings&&<p className="muted" style={{fontSize:12,lineHeight:1.55}} aria-label="Face scan performance details">Scan timing: {scanTimings}</p>}{(/enrolled face|incompatible model|Face Change request/i.test(status))&&<p><a href="/mobile-attendance/enroll">Check / enroll my face →</a> · <a href="/face-change">Request face change →</a></p>}{gpsStatus&&<small className="muted">{gpsStatus}</small>}
  <p style={{fontSize:12,opacity:.8}}>Face matching is not anti-spoofing: a photo or screen replay may fool it. GPS must be inside an approved office. Attendance success appears only after database confirmation.</p>
  <div style={{display:'flex',gap:15,flexWrap:'wrap'}}><a href="/mobile-attendance/enroll">Face enrollment/status</a><a href="/my-attendance-history">Attendance history</a><a href="/mobile-attendance/button">HR-approved Button + GPS</a></div>
 </div>
}
