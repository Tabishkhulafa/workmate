'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
type Location = {id:string;name:string;address:string|null;latitude:number;longitude:number;allowed_radius_meters:number;is_active:boolean;is_default:boolean};
const blank={name:'',address:'',latitude:'',longitude:'',allowed_radius_meters:'100'};
export default function LocationManager({locations}:{locations:Location[]}){
 const router=useRouter();const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState(blank),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const start=(location?:Location)=>{setEditing(location?.id||'NEW');setForm(location?{name:location.name,address:location.address||'',latitude:String(location.latitude),longitude:String(location.longitude),allowed_radius_meters:String(location.allowed_radius_meters)}:blank);setError('');setSuccess('');};
 const submit=async (action:string,locationId?:string)=>{
   setBusy(true);setError('');setSuccess('');
   try {
     const body=action==='CREATE'||action==='UPDATE'?{action,location_id:locationId,...form}: {action,location_id:locationId};
     const response=await fetch('/api/locations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
     const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Unable to save location');
     setSuccess('Saved successfully');setEditing(null);router.refresh();
   }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}
 };
 const field=(key:keyof typeof blank,label:string,type='text')=><label style={{margin:0}}>{label}<input required type={type} value={form[key]} onChange={e=>setForm(s=>({...s,[key]:e.target.value}))} /></label>;
 return <div style={{display:'grid',gap:18}}>
 <div><button type="button" onClick={()=>start()}>+ Add office location</button></div>
 {error&&<p className="notice error" role="alert">{error}</p>}{success&&<p className="notice">{success}</p>}
 {editing&&<form className="card" onSubmit={e=>{e.preventDefault();void submit(editing==='NEW'?'CREATE':'UPDATE',editing==='NEW'?undefined:editing);}}>
 <h2>{editing==='NEW'?'New office location':'Edit office location'}</h2>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
 {field('name','Location name')}{field('address','Address')}{field('latitude','Latitude','number')}{field('longitude','Longitude','number')}{field('allowed_radius_meters','Allowed radius (metres)','number')}
 </div><div style={{display:'flex',gap:12,marginTop:16}}><button disabled={busy} type="submit">{busy?'Saving…':'Save location'}</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancel</button></div>
 </form>}
 <div className="card tablewrap"><table><thead><tr><th>Location</th><th>Coordinates</th><th>Radius</th><th>Status</th><th>Actions</th></tr></thead><tbody>
 {locations.map(l=><tr key={l.id}><td><strong>{l.name}</strong>{l.is_default?' · Default':''}<div className="muted small">{l.address||'—'}</div></td><td>{l.latitude}, {l.longitude}</td><td>{l.allowed_radius_meters} m</td><td>{l.is_active?'Active':'Inactive'}</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" disabled={busy} onClick={()=>start(l)}>Edit</button><button type="button" disabled={busy||(l.is_default&&l.is_active)} className="secondary" onClick={()=>void submit(l.is_active?'DEACTIVATE':'ACTIVATE',l.id)}>{l.is_active?'Deactivate':'Activate'}</button></div></td></tr>)}
 {!locations.length&&<tr><td colSpan={5}>No office locations found.</td></tr>}
 </tbody></table></div><p className="muted small">Default location is protected from deactivation. To change the default location, use the verified Android workflow until atomic switching is available on Web.</p>
 </div>;
}
