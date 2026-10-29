'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Logout from './logout';

type NavItem={href:string;label:string};
export default function MobileNavigation({items,punches,admin}:{items:NavItem[];punches:boolean;admin:boolean}){
  const [open,setOpen]=useState(false);
  const pathname=usePathname();
  useEffect(()=>{setOpen(false);},[pathname]);
  useEffect(()=>{
    if(!open)return;
    function onKey(e:KeyboardEvent){if(e.key==='Escape')setOpen(false);}
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[open]);
  return <>
    {open&&<div className="wm-mobile-overlay" onClick={()=>setOpen(false)} role="presentation"/>}
    {open&&<section id="wm-mobile-nav-panel" className="wm-mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Work Mate navigation">
      <div className="wm-mobile-nav-title"><div><strong>Work Mate menu</strong><p className="muted small">Choose a module</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close navigation menu">×</button></div>
      <nav className="wm-mobile-nav-list">{items.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined} onClick={()=>setOpen(false)}>{item.label}<span aria-hidden="true">→</span></Link>)}</nav>
      <div className="wm-mobile-nav-signout"><Logout/></div>
    </section>}
    <div className="mobilemenu wm-mobile-nav-bar" aria-label="Mobile quick navigation">
      <Link href="/dashboard">Home</Link>
      <Link href="/my-profile">Profile</Link>
      {punches&&<Link href="/mobile-attendance">Punch</Link>}
      {admin&&<Link href="/attendance">Attendance</Link>}
      <button type="button" className="wm-mobile-more" aria-expanded={open} aria-controls="wm-mobile-nav-panel" onClick={()=>setOpen(v=>!v)}>{open?'Close':'Menu'}</button>
    </div>
  </>;
}
