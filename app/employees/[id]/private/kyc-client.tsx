'use client';
import {useState, type ChangeEvent} from 'react';

type Kind='aadhaar'|'pan';
export function KycViewer({employeeId}:{employeeId:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[url,setUrl]=useState(''),[kind,setKind]=useState<Kind|null>(null);
 async function invoke(body:Record<string,unknown>){
  const res=await fetch('/api/proxy/employee-kyc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const json=await res.json() as {error?:string,signed_url?:string,success?:boolean};
  if(!res.ok||json.error)throw Error(json.error||'Document request failed');
  return json;
 }
 async function view(documentType:Kind){
  setBusy(true);setError('');setSuccess('');setUrl('');
  try{const data=await invoke({employee_id:employeeId,document_type:documentType,action:'view'});if(!data.signed_url)throw Error('Document link missing');setKind(documentType);setUrl(data.signed_url)}
  catch(e){setError(e instanceof Error?e.message:'Unable to view document')}finally{setBusy(false)}
 }
 async function upload(event:ChangeEvent<HTMLInputElement>,documentType:Kind){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setError('');setSuccess('');setUrl('');
  if(file.size>2*1024*1024||file.size===0){setError('Choose a JPEG/PNG image under 2 MB.');return}
  if(!['image/jpeg','image/png'].includes(file.type)){setError('Only JPEG or PNG accepted.');return}
  setBusy(true);
  try{
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(Error('Unable to read image'));reader.readAsDataURL(file)});
   await invoke({employee_id:employeeId,document_type:documentType,action:'upload',base64:data});
   setSuccess(`${documentType.toUpperCase()} uploaded. The previous document has been replaced and the action recorded.`);
  }catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{setBusy(false)}
 }
 return <section className="card wm-elevated" style={{marginTop:20}}><h2>Identity documents</h2>
 <p className="muted">HR/Super Admin upload documents supplied by the employee and can view them after authorization. Only PNG/JPEG up to 2 MB. Storage is private; document actions are audited.</p>
 <div className="wm-kyc-grid">{(['aadhaar','pan'] as Kind[]).map(doc=><div className="wm-kyc-tile" key={doc}>
 <h3>{doc==='aadhaar'?'Aadhaar':'PAN'} document</h3>
 <p className="muted small">Use the employee-provided image with their permission.</p>
 <div className="wm-link-actions"><button disabled={busy} onClick={()=>void view(doc)}>View {doc.toUpperCase()}</button>
 <label className="wm-upload-button">Upload / Replace<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e=>void upload(e,doc)}/></label></div>
 </div>)}</div>
 {error&&<p role="alert" className="notice error">{error}</p>}{success&&<p role="status" className="notice">{success}</p>}
 {url&&<div className="wm-document-preview"><div className="wm-link-actions"><strong>{kind?.toUpperCase()} preview (expires in 60 seconds)</strong><button className="secondary" onClick={()=>{setUrl('');setKind(null)}}>Hide document</button></div><img src={url} alt={`${kind} identity document`} referrerPolicy="no-referrer"/></div>}
 </section>
}
