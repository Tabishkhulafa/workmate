'use client';
import {useState, type FormEvent} from 'react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import styles from './password-change.module.css';

export default function PasswordChangeClient({stagingEnabled}:{stagingEnabled:boolean}){
 const [current,setCurrent]=useState('');const [next,setNext]=useState('');const [confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setMessage('');
  if(!stagingEnabled){setMessage('Changing passwords against live Supabase is disabled in local test mode. Connect a separate staging project first.');return;}
  if(next.length<10||!/[A-Za-z]/.test(next)||!/[0-9]/.test(next)){setMessage('Use at least 10 characters with letters and numbers.');return;}
  if(next!==confirm){setMessage('New passwords do not match.');return;}
  if(current===next){setMessage('Choose a password different from the current password.');return;}
  setBusy(true);
  try{
   const client=supabaseBrowser();const {data:{user},error:userError}=await client.auth.getUser();
   if(userError||!user)throw Error('Your login session has expired. Please sign in again.');
   const credentials=user.email?{email:user.email,password:current}:user.phone?{phone:user.phone,password:current}:null;
   if(!credentials)throw Error('Account has no verified email or phone. Contact HR to reset your password.');
   const auth=await client.auth.signInWithPassword(credentials);
   if(auth.error||auth.data.user?.id!==user.id)throw Error('Current password is incorrect.');
   const changed=await client.auth.updateUser({password:next});
   if(changed.error)throw changed.error;
   await client.auth.signOut();window.location.replace('/login?password_changed=1');
  }catch(error){setMessage(error instanceof Error?error.message:'Password change failed.');setBusy(false);}
 }
 return (
  <section className={`card ${styles.card}`} aria-labelledby="wm-password-heading">
   <div className={styles.header}>
    <div className={styles.headingText}>
     <span className={styles.kicker}>ACCOUNT SECURITY</span>
     <h2 id="wm-password-heading" className={styles.title}>Change password</h2>
     <p className={styles.subtitle}>Keep your account secure. After a successful password change, you will be signed out automatically.</p>
    </div>
    <span className={styles.securityPill} aria-hidden="true">Secure account</span>
   </div>

   {!stagingEnabled && (
    <div className={styles.readOnlyNotice} role="status">
     <span className={styles.noticeIcon} aria-hidden="true">!</span>
     <div>
      <strong>Local preview — password changes disabled</strong>
      <p>Connect a separate staging Supabase project to test password updates. Your live account credentials remain unchanged.</p>
     </div>
    </div>
   )}

   <form onSubmit={submit} className={styles.form}>
    <div className={styles.field}>
     <label htmlFor="wm-current-password">Current password</label>
     <input id="wm-current-password" required autoComplete="current-password" type={show?'text':'password'} value={current} onChange={e=>setCurrent(e.target.value)} placeholder="Enter current password"/>
    </div>
    <div className={styles.newPasswordGrid}>
     <div className={styles.field}>
      <label htmlFor="wm-new-password">New password</label>
      <input id="wm-new-password" required minLength={10} autoComplete="new-password" type={show?'text':'password'} value={next} onChange={e=>setNext(e.target.value)} placeholder="Enter new password" aria-describedby="wm-password-requirements"/>
     </div>
     <div className={styles.field}>
      <label htmlFor="wm-confirm-password">Confirm new password</label>
      <input id="wm-confirm-password" required minLength={10} autoComplete="new-password" type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter new password"/>
     </div>
    </div>
    <p id="wm-password-requirements" className={styles.requirement}>Use at least 10 characters, including letters and numbers.</p>

    <label className={styles.showPasswordRow} htmlFor="wm-show-passwords">
     <input id="wm-show-passwords" type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} />
     <span>Show passwords</span>
    </label>

    {message && <p role="alert" className={styles.errorMessage}>{message}</p>}
    <div className={styles.actions}>
     <button type="submit" className={styles.submitButton} disabled={busy||!stagingEnabled}>
      {busy?'Changing password…':'Change password and sign out'}
     </button>
     <p className={styles.footerNote}>For your security, password changes end your current session.</p>
    </div>
   </form>
  </section>
 );
}
