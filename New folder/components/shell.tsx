import Link from 'next/link';
import Logout from './logout';
import headerStyles from './shell-header.module.css';
import { NavLinks } from './nav-links';
import MobileNavigation from './mobile-navigation';

type NavItem={href:string;label:string};
export function Shell({children,name,role}:{children:React.ReactNode;name:string;role:string}){
 const admin=role==='HR'||role==='SUPER_ADMIN';
 const hod=role==='DEPARTMENT_HEAD';
 const approver=admin||hod;
 const punches=role!=='SUPER_ADMIN';
 const displayName = name.trim() || 'Team member';
 const initials = displayName.split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('');
 const roleLabel = role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'DEPARTMENT_HEAD' ? 'Department Head' : role === 'HR' ? 'HR' : 'Employee';
 const nav:NavItem[]=[
  {href:'/dashboard',label:'Home'},
  ...(role==='SUPER_ADMIN'?[{href:'/attendance',label:'Attendance overview'}]:[]),
  {href:'/my-profile',label:'My profile'},
  ...(punches?[
   {href:'/mobile-attendance',label:'My attendance'},
   {href:'/my-attendance-history',label:'My attendance history'},
   {href:'/mobile-attendance/enroll',label:'My face enrollment'},
   {href:'/face-change',label:'Request face change'},
   {href:'/leaves',label:'My leaves'},
   {href:'/regularizations',label:'My regularizations'},
   {href:'/weekly-off',label:'My weekly off'},
  ]:[]),
  {href:'/holidays',label:'Holiday calendar'},
  ...(approver?[{href:'/on-leave-today',label:"Who’s on leave today"}]:[]),
  ...(hod?[
   {href:'/department-employees',label:'Department employees'},
   {href:'/department-attendance',label:'Department attendance'},
  ]:[]),
  ...(approver?[
   {href:'/approvals/leaves',label:'Review leaves'},
   {href:'/approvals/regularizations',label:'Review regularizations'},
   {href:'/review-weekly-off',label:'Review weekly off'},
  ]:[]),
  ...(admin?[
   {href:'/face-reviews',label:'Face change approvals'},
   {href:'/departments',label:'Departments'},
   {href:'/employees',label:'Employees'},
   {href:'/employees/new',label:'Create employee'},
   {href:'/employees/import',label:'Excel / CSV import'},
   {href:'/permissions',label:'Button attendance permissions'},
   {href:'/attendance',label:'Organisation attendance'},
   {href:'/shifts',label:'Shift management'},
   {href:'/attendance-settings',label:'Attendance settings'},
   {href:'/locations',label:'Office locations'},
   {href:'/documents',label:'Documents / KYC'},
   {href:'/password-reset-requests',label:'Password reset requests'},
   ...(role==='SUPER_ADMIN'?[{href:'/leave-policy',label:'Leave policy'}]:[]),
  ]:[]),
  ...(punches?[
   {href:'/mobile-attendance/button',label:'Approved button + GPS'},
   {href:'/mobile-attendance/offline',label:'Offline drafts'},
  ]:[]),
 ];
 return <div className="shell"><aside className="sidebar" style={{overflowY:'auto',height:'100dvh',minHeight:0}}><div className="brand">WM <span>Work Mate</span></div><div className="navlabel">WORKSPACE</div><NavLinks items={nav}/><div className="spacer"/><Logout/></aside><div className="main"><header className={headerStyles.topbar}>
  <div className={headerStyles.workspace}>
   <span className={headerStyles.workspaceSymbol} aria-hidden="true">WM</span>
   <div className={headerStyles.workspaceText}><span>WORK MATE</span><strong>My workspace</strong></div>
  </div>
  <Link href="/my-profile" className={headerStyles.profileLink} aria-label={`Open profile for ${displayName}`}>
   <span className={headerStyles.avatar} aria-hidden="true">{initials}</span>
   <span className={headerStyles.profileText}><strong title={displayName}>{displayName}</strong><span>{roleLabel}</span></span>
   <span className={headerStyles.chevron} aria-hidden="true">›</span>
  </Link>
 </header><main>{children}</main><MobileNavigation items={nav} punches={punches} admin={admin}/></div></div>;
}
