'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function ProfileIdentityEditor({initialName,initialDesignation,accessRole}:{initialName:string;initialDesignation:string;accessRole:string}){
  const router=useRouter();
  const [name,setName]=useState(initialName);
  const [designation,setDesignation]=useState(initialDesignation);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(saving)return;
    setError('');setMessage('');
    const full_name=name.trim();const jobTitle=designation.trim();
    if(full_name.length<2||full_name.length>120){setError('Name must be between 2 and 120 characters.');return;}
    if(jobTitle.length>120){setError('Designation must be 120 characters or fewer.');return;}
    setSaving(true);
    try{
      // This authenticated backend action ONLY changes full_name + designation.
      // It never accepts the authorization role, department or employee code.
      const {data,error:invokeError}=await supabaseBrowser().functions.invoke('self-private-profile',{
        body:{action:'update_identity',full_name,designation:jobTitle},
      });
      if(invokeError){
        let reason=invokeError.message;
        try{const response=await (invokeError as {context?:Response}).context?.json();reason=String(response?.error??reason);}catch{}
        throw Error(reason);
      }
      if(data?.success!==true)throw Error(String(data?.error||'Unable to update profile.'));
      setMessage('Name and designation saved.');
      router.refresh();
    }catch(err){setError(err instanceof Error?err.message:'Unable to update profile.');}
    finally{setSaving(false);}
  }
  return <section className="card wm-identity-editor" aria-label="Edit my identity">
    <div className="wm-profile-editor-head"><div><span className="eyebrow">PERSONAL DETAILS</span><h2>Edit my profile</h2><p className="muted">Update your own name and job designation. These changes also appear in the employee directory.</p></div><span className="wm-profile-edit-tag">Self-service</span></div>
    <form onSubmit={save} className="wm-identity-form">
      <label>Full name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={120} required autoComplete="name" disabled={saving}/></label>
      <label>Job designation <span className="muted small">(e.g. Sales Executive, IT Assistant)</span><input value={designation} onChange={e=>setDesignation(e.target.value)} maxLength={120} placeholder="Your job title" disabled={saving}/></label>
      <div className="wm-access-role"><small>Account access role</small><strong>{accessRole.replaceAll('_',' ')}</strong><span>Only HR / Super Admin can change account permissions or role.</span></div>
      <div className="wm-identity-actions"><button type="submit" disabled={saving}>{saving?'Saving…':'Save profile changes'}</button></div>
    </form>
    {message&&<p className="notice" role="status">{message}</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
  </section>;
}
