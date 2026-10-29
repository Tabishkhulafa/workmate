'use client';
import {useEffect,useRef,useState} from 'react';
import {loadFaceModel,embedDetectedFace} from '@/lib/mobile-attendance/browser-face-model';
import {detectOneFace} from '@/lib/mobile-attendance/safari-face-detector';

type Office={id:string;name:string;is_default?:boolean};
type GPS={latitude:number;longitude:number;accuracy:number;timestamp:number};
type Readiness={authenticated?:boolean;enrolled?:boolean|null;error?:string};
export default function FacePreflight(){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null);
 const [status,setStatus]=useState('Ready for checks'),[busy,setBusy]=useState(false);
 const [camera,setCamera]=useState(false),[embedding,setEmbedding]=useState(false),[enrolled,setEnrolled]=useState<boolean|null>(null);
 const [gps,setGps]=useState<GPS|null>(null),[offices,setOffices]=useState<Office[]>([]),[office,setOffice]=useState('');
 const [geofence,setGeofence]=useState<boolean|null>(null),[dimension,setDimension]=useState('');
 useEffect(()=>{let active=true;void(async()=>{
  try{const [r,l]=await Promise.all([fetch('/api/mobile-attendance/readiness',{cache:'no-store'}),fetch('/api/mobile-attendance/locations',{cache:'no-store'})]);
   const a=await r.json() as Readiness;const b=await l.json() as {locations?:Office[]};
   if(!active)return;if(r.ok)setEnrolled(a.enrolled??null);else setStatus(a.error||'Enrollment status unavailable');
   const list=b.locations||[];setOffices(list);setOffice(list.find(x=>x.is_default)?.id||list[0]?.id||'');
  }catch(e){if(active)setStatus(e instanceof Error?e.message:'Network unavailable');}
 })();return()=>{active=false;stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 async function openCamera(){try{
  if(!window.isSecureContext)throw Error('HTTPS is required');
  const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false});
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=s;
  if(video.current){video.current.srcObject=s;await video.current.play();}
  setCamera(true);setEmbedding(false);setStatus('Camera ready.');
 }catch(e){setStatus(e instanceof Error?e.message:'Camera failed');}}
 async function testFace(){if(!video.current)return;setBusy(true);setEmbedding(false);
  try{const model=await loadFaceModel();setDimension(`${model.inputs[0]?.shape?.join(' × ')} → ${model.outputs[0]?.shape?.join(' × ')}`);
   const face=await detectOneFace(video.current);
   const v=await embedDetectedFace(video.current,video.current.videoWidth,video.current.videoHeight,face);
   if(v.length!==192)throw Error(`Expected 192 embedding features, got ${v.length}`);
   setEmbedding(true);setStatus('192-feature embedding generated in browser. Identity and liveness NOT verified.');
  }catch(e){setStatus(e instanceof Error?e.message:'Face inference failed');}finally{setBusy(false);}
 }
 function acquireGps(){if(!navigator.geolocation){setStatus('GPS unavailable');return;}setGeofence(null);
  navigator.geolocation.getCurrentPosition(p=>{setGps({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp});setStatus(`GPS acquired ±${Math.round(p.coords.accuracy)}m`);},e=>setStatus(e.message),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
 }
 async function checkGps(){if(!gps||!office)return;setBusy(true);setGeofence(null);
  try{const r=await fetch('/api/mobile-attendance/prepare',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'CLOCK_IN',office_id:office,gps})});const j=await r.json() as {ready?:boolean;error?:string;distance_m?:number};setGeofence(r.ok&&j.ready===true);setStatus(r.ok&&j.ready?`GPS geofence passed (${j.distance_m??'?'}m). No attendance submitted.`:(j.error||'Geofence failed'));}
  catch(e){setStatus(e instanceof Error?e.message:'Network error');}finally{setBusy(false);}
 }
 return <main style={{maxWidth:760,margin:'32px auto',padding:20,display:'grid',gap:16}}>
  <h1>Face + GPS readiness</h1><p>This preflight does not enroll anyone or record Clock In/Out. It checks the building blocks without changing staff data.</p>
  <section className="card" style={{display:'grid',gap:12,padding:18}}>
   <strong>1. Face registration</strong><p>Enrollment: {enrolled===null?'Unable to confirm':enrolled?'Registered':'Not registered'}</p><a href="/mobile-attendance/enroll">View enrollment</a>
   <strong>2. Live camera + MobileFaceNet</strong>
   <video ref={video} autoPlay muted playsInline style={{width:'100%',maxHeight:320,background:'#18181b',borderRadius:12,objectFit:'cover'}}/>
   <div style={{display:'flex',flexWrap:'wrap',gap:10}}><button type="button" onClick={()=>void openCamera()}>Open front camera</button><button type="button" disabled={!camera||busy} onClick={()=>void testFace()}>Test 192-feature embedding</button></div>
   <p>Model: {dimension||'Not loaded'} · Embedding: {embedding?'Generated':'Not verified'}</p>
   <strong>3. GPS geofence</strong>
   <select value={office} onChange={e=>{setOffice(e.target.value);setGeofence(null);}}><option value="">Choose office</option>{offices.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>
   <div style={{display:'flex',flexWrap:'wrap',gap:10}}><button type="button" onClick={acquireGps}>Acquire fresh GPS</button><button type="button" disabled={!gps||!office||busy} onClick={()=>void checkGps()}>Check office geofence</button></div>
   <p>Accuracy: {gps?`${Math.round(gps.accuracy)}m`:'Not acquired'} · Geofence: {geofence===null?'Not checked':geofence?'Passed':'Failed'}</p>
   <p role="status">{status}</p>
  </section>
  <aside className="notice" style={{padding:16,borderRadius:12}}><strong>Attendance remains locked.</strong> A browser-generated face vector is not server-verifiable anti-spoof proof. A trusted liveness service and secure one-time verification must be integrated and tested before biometric Clock In/Out can be enabled.</aside>
  <a href="/mobile-attendance/button">HR-approved Button + GPS Clock In/Out</a>
 </main>;
}
