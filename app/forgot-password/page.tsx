'use client';
import {type FormEvent,useState} from 'react';
import Link from 'next/link';
import {Eye,EyeOff} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Stage='request'|'code'|'change'|'complete';
async function invoke(functionName:string,body:Record<string,unknown>){
 const {data,error}=await supabaseBrowser().functions.invoke(functionName,{body});
 if(error){
  const context=(error as {context?:Response}).context;
  if(context&&typeof context.clone==='function'){
   try{const reason=await context.clone().json() as {error?:string};if(reason.error)throw Error(reason.error)}catch(e){if(e instanceof Error&&e.message!==error.message)throw e}
  }
  throw Error('Could not complete request. Please try again.');
 }
 if(data?.error||data?.success===false) throw Error(String(data.error||'Request failed'));
 return data as {success?:boolean;message?:string};
}
export default function ForgotPassword(){
 const [stage,setStage]=useState<Stage>('request');const [identifier,setIdentifier]=useState('');
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   if(stage==='request'){
    if(!identifier.trim()) throw Error('Enter your registered email or mobile number.');
    await invoke('request-password-reset',{login:identifier.trim()});
    if(identifier.includes('@')) setEmail(identifier.trim());
    setNotice('If the account exists, a request has been sent to HR / Super Admin. Ask them for the 8-digit code.');
    setStage('code');
   }else if(stage==='code'){
    if(!/^\S+@\S+\.\S+$/.test(email.trim())||!/^[0-9]{8}$/.test(code.trim())) throw Error('Enter your registered email and the 8-digit code.');
    await invoke('complete-password-reset',{action:'VERIFY',email:email.trim(),code:code.trim()});
    setStage('change');setNotice('Code verified. Set your new password.');
   }else if(stage==='change'){
    if(password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)) throw Error('Password must be at least 10 characters and include letters and numbers.');
    if(password!==confirm) throw Error('Both passwords must match.');
    await invoke('complete-password-reset',{action:'RESET',email:email.trim(),code:code.trim(),new_password:password});
    setPassword('');setConfirm('');setCode('');setStage('complete');setNotice('Password reset successfully. Sign in with your new password.');
   }
  }catch(err){setError(err instanceof Error?err.message:'Request failed. Please retry.');}
  finally{setBusy(false)}
 }
 return <main className="loginwrap"><form className="login card wm-auth-card" onSubmit={submit}>
  <div className="brand">WM <span>Work Mate</span></div><h1>Reset password</h1>
  {stage==='request'&&<><p className="muted">Enter your registered email or 10-digit mobile number. HR / Super Admin will review your request.</p><label>Email / Mobile Number<input value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoComplete="username" placeholder="Email or 10-digit mobile number"/></label><button disabled={busy}>{busy?'Sending request…':'Send request'}</button><button type="button" className="secondary wm-auth-secondary" disabled={busy} onClick={()=>{setError('');setStage('code');}}>I have a code</button></>}
  {stage==='code'&&<><p className="muted">Enter the 8-digit code shared by HR / Super Admin. Your registered email is required to verify it.</p><label>Registered email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="yourname@example.com"/></label><label>8-digit verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]{8}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} required placeholder="12345678"/></label><button disabled={busy}>{busy?'Verifying…':'Verify code'}</button><button type="button" className="secondary wm-auth-secondary" disabled={busy} onClick={()=>setStage('request')}>Request a code</button></>}
  {stage==='change'&&<><p className="muted">Choose a new password of at least 10 characters including letters and numbers.</p><label>New password<div className="wm-password-input"><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={10} autoComplete="new-password"/><button type="button" className="wm-password-toggle" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></label><label>Confirm new password<input type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={10} autoComplete="new-password"/></label><button disabled={busy}>{busy?'Updating…':'Change password'}</button></>}
  {notice&&<p className="notice" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
  {stage==='complete'&&<Link className="buttonlink wm-auth-back" href="/login">Back to sign in</Link>}
  {stage!=='complete'&&<div className="wm-auth-actions"><Link href="/login">← Back to sign in</Link></div>}
 </form></main>;
}
