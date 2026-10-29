'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

type Props={employeeId:string;employeeName:string;employeeCode:string;employeeRole:string;employeeActive:boolean;viewerRole:string;isSelf:boolean};
export default function ArchiveEmployeeButton(props:Props){
  const canDelete=props.employeeActive&&!props.isSelf&&props.employeeRole!=='SUPER_ADMIN'&&
    (props.viewerRole==='SUPER_ADMIN'||(props.viewerRole==='HR'&&['EMPLOYEE','DEPARTMENT_HEAD'].includes(props.employeeRole)));
  const [open,setOpen]=useState(false);
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const router=useRouter();
  if(!canDelete)return null;
  async function archive(){
    if(busy||confirmation.trim().toUpperCase()!==props.employeeCode.trim().toUpperCase())return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/employees/'+encodeURIComponent(props.employeeId)+'/archive',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({confirm_code:confirmation.trim()}),
      });
      const result=await response.json().catch(()=>({error:'Server returned an invalid response'}));
      if(!response.ok||result?.success!==true)throw Error(result?.error||'Unable to deactivate employee');
      setOpen(false);
      if(result.auth_banned!==true){
        setError('Employee record deactivated, but the login ban was not confirmed. Check staff access with Super Admin.');
        router.refresh();return;
      }
      router.push('/employees');router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Unable to deactivate employee');}
    finally{setBusy(false);}
  }
  return <div style={{marginTop:12,maxWidth:680}}>
    <button type="button" onClick={()=>{setOpen(!open);setError('');setConfirmation('');}} style={{background:'#fff',color:'#9b1c1c',border:'1px solid #f3b8b8',borderRadius:11,padding:'10px 16px',fontWeight:750}}>
      Delete employee
    </button>
    {open&&<section aria-label="Confirm employee deletion" style={{marginTop:12,border:'1px solid #f0c1c1',background:'#fffafa',padding:18,borderRadius:14,display:'grid',gap:12}}>
      <strong>Remove {props.employeeName} from active staff?</strong>
      <p style={{margin:0,lineHeight:1.55}}>This deactivates their account and bans future sign-in. Existing face enrollment is deleted by the current backend. Past attendance, leaves and regularization records are preserved. Super Admin accounts cannot be deleted.</p>
      <label style={{display:'grid',gap:5}}>Type employee code <strong>{props.employeeCode}</strong> to confirm
        <input autoComplete="off" spellCheck={false} value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Employee code" />
      </label>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button type="button" disabled={busy||!props.employeeCode||confirmation.trim().toUpperCase()!==props.employeeCode.trim().toUpperCase()} onClick={archive} style={{background:'#aa2222',color:'#fff',padding:'11px 16px',borderRadius:11}}>{busy?'Removing…':'Confirm delete'}</button>
        <button type="button" disabled={busy} onClick={()=>{setOpen(false);setConfirmation('');}}>Cancel</button>
      </div>
    </section>}
    {error&&<p role="alert" className="notice error" style={{marginTop:10}}>{error}</p>}
  </div>;
}
