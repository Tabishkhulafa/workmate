'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabase/browser';

const EDITABLE = [
 ['current_address','Current address'],['permanent_address','Permanent address'],
 ['emergency_contact_1_name','Emergency contact 1 name'],['emergency_contact_1_relation','Emergency contact 1 relationship'],
 ['emergency_contact_1_phone','Emergency contact 1 mobile'],['emergency_contact_2_name','Emergency contact 2 name'],
 ['emergency_contact_2_relation','Emergency contact 2 relationship'],['emergency_contact_2_phone','Emergency contact 2 mobile'],
] as const;
type Field = typeof EDITABLE[number][0];
type Details = Partial<Record<Field,string>> & Record<string,unknown>;
const initial = Object.fromEntries(EDITABLE.map(([field])=>[field,''])) as Record<Field,string>;

export default function PrivateProfileClient(){
 const [form,setForm]=useState<Record<Field,string>>({...initial});
 const [bank,setBank]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const invoke=useCallback(async (action:'read'|'update',details?:Record<Field,string>)=>{
  const supabase=supabaseBrowser();
  const {data,error}=await supabase.functions.invoke('self-private-profile',{body:action==='read'?{action}:{action,details}});
  if(error){let reason=error.message;try{const raw=await (error as {context?:Response}).context?.json();reason=String(raw?.error??reason)}catch{}throw new Error(reason)}
  if(data?.error)throw new Error(String(data.error));
  return data as {details?:Details;success?:boolean};
 },[]);
 const load=useCallback(async()=>{
  setLoading(true);setMessage('');
  try{
   const data=await invoke('read');const details=data.details??{};
   setForm(Object.fromEntries(EDITABLE.map(([field])=>[field,String(details[field]??'')])) as Record<Field,string>);
   setBank({bank_name:String(details.bank_name??''),bank_ifsc:String(details.bank_ifsc??''),bank_branch:String(details.bank_branch??''),bank_account_masked:String(details.bank_account_masked??'')});
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to load profile')}finally{setLoading(false)}
 },[invoke]);
 useEffect(()=>{void load()},[load]);
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(saving)return;
  for(const field of ['emergency_contact_1_phone','emergency_contact_2_phone'] as Field[]){
   const phone=form[field].trim();if(phone&&!/^\d{10}$/.test(phone)){setMessage('Emergency mobile must contain exactly 10 digits.');return}
  }
  setSaving(true);setMessage('');
  try{await invoke('update',form);setMessage('Contact details saved.');await load();setMessage('Contact details saved.')}catch(e){setMessage(e instanceof Error?e.message:'Save failed')}finally{setSaving(false)}
 }
 return <section className="card" style={{display:'grid',gap:18}}>
  <div><h2>My contact and emergency details</h2><p className="muted">Your own profile only. Changes are saved through the authenticated Supabase function.</p></div>
  {message&&<div className="notice" role="status">{message}</div>}
  {loading?<p>Loading secure profile...</p>:<>
   <form onSubmit={save} style={{display:'grid',gap:16}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,250px),1fr))',gap:16}}>
     {EDITABLE.map(([field,label])=><label key={field} style={{display:'grid',gap:6}}>{label}
      {field.includes('address')?<textarea rows={3} maxLength={1000} value={form[field]} onChange={e=>setForm(s=>({...s,[field]:field.endsWith('phone')?e.target.value.replace(/\D/g,'').slice(0,10):e.target.value}))}/>:<input onInput={field.endsWith('phone')?(e)=>{e.currentTarget.value=e.currentTarget.value.replace(/\D/g,'').slice(0,10)}:undefined} maxLength={field.endsWith('phone')?10:500} inputMode={field.endsWith('phone')?'numeric':undefined} value={form[field]} onChange={e=>setForm(s=>({...s,[field]:field.endsWith('phone')?e.target.value.replace(/\D/g,'').slice(0,10):e.target.value}))}/>}
     </label>)}
    </div>
    <div><button disabled={saving} type="submit">{saving?'Saving...':'Save contact details'}</button></div>
   </form>
   <div><h2>Bank details (read only)</h2><div className="details">
    {([['bank_name','Bank'],['bank_ifsc','IFSC'],['bank_branch','Branch'],['bank_account_masked','Account']] as const).map(([key,label])=><div key={key}><small>{label}</small><strong>{bank[key]||'—'}</strong></div>)}
   </div><p className="muted">Bank details cannot be edited by employees.</p></div>
  </>}
 </section>;
}
