'use client';
import {type FormEvent,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
export default function InitialPasswordClient(){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setError('');
  if(password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)){setError('At least 10 characters with letters and numbers required.');return;}
  if(password!==confirm){setError('Passwords do not match.');return;}
  setBusy(true);try{
   const client=supabaseBrowser();const {data,error}=await client.functions.invoke('complete-initial-password',{body:{password}});
   if(error||data?.success!==true)throw Error(String(data?.error||'Password change failed. Please retry.'));
   await client.auth.signOut();
   window.location.replace('/login?password_changed=1');
  }catch(caught){setError(caught instanceof Error?caught.message:'Password change failed.');setBusy(false)}
 }
 return <main className="loginwrap"><form className="login card wm-auth-card" onSubmit={submit}>
  <div className="brand">WM <span>Work Mate</span></div><h1>Change your password</h1>
  <p className="muted">For security, replace your temporary password before using Work Mate. After saving, sign in again.</p>
  <label>New password<div className="wm-password-input"><input type={show?'text':'password'} autoComplete="new-password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="wm-password-toggle" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></label>
  <label>Confirm new password<input type={show?'text':'password'} autoComplete="new-password" minLength={10} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
  {error&&<p className="error" role="alert">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Save password and sign out'}</button>
 </form></main>;
}
