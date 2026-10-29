import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';

type Card={title:string;detail:string;href:string;tone:'blue'|'green'|'purple'|'orange'|'pink'|'slate';tag?:string};

function CardSection({title,desc,cards}:{title:string;desc:string;cards:Card[]}){
  if(!cards.length) return null;
  return (
    <section className="wm-dashboard-section">
      <div className="wm-dashboard-section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{desc}</p>
        </div>
        <span className="wm-dashboard-count">{cards.length} modules</span>
      </div>
      <div className="wm-dashboard-grid">
        {cards.map(card=>(
          <Link className={`wm-dashboard-card wm-tone-${card.tone}`} href={card.href} prefetch={false} key={card.href}>
            <div className="wm-dashboard-card-top">
              {card.tag ? <span className="wm-dashboard-badge">{card.tag}</span> : <span className="wm-dashboard-badge">Work Mate</span>}
            </div>
            <div className="wm-dashboard-card-body">
              <strong>{card.title}</strong>
              <p>{card.detail}</p>
            </div>
            <div className="wm-dashboard-card-foot">
              <span>Open module</span>
              <span aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function Dashboard(){
  const { profile } = await requireProfile();
  const role = profile.role;

  // Super Admin dashboard opens the existing live organisation attendance report.
  // Reuse its authorization, analytics, filtering, and export logic.
  if (role === 'SUPER_ADMIN') redirect('/attendance');

  const admin = role === 'HR' || role === 'SUPER_ADMIN';
  const hod = role === 'DEPARTMENT_HEAD';
  const approver = admin || hod;
  const isPunchUser = role !== 'SUPER_ADMIN';

  const selfCards:Card[]=[
    ...(role === 'SUPER_ADMIN' ? ([
      {title:'Attendance overview',detail:'View organisation attendance, staff summaries, filters and reports.',href:'/attendance',tone:'green',tag:'Overview'},
    ] satisfies Card[]) : []),
    {title:'My profile',detail:'Personal profile, account details and private information.',href:'/my-profile',tone:'blue',tag:'Profile'},
    ...(isPunchUser?([{title:'Break time',detail:'Scheduled lunch window, Random Break In / Out and your break history.',href:'/breaks',tone:'orange',tag:'New'}] satisfies Card[]):[]),
    ...(role === 'SUPER_ADMIN' ? ([
      {title:'Holiday calendar',detail:'View and manage official organisation holidays.',href:'/holidays',tone:'orange',tag:'Calendar'},
      {title:"Who’s on leave today",detail:'See approved leaves across your authorized organisation scope.',href:'/on-leave-today',tone:'purple',tag:'Team'},
    ] satisfies Card[]) : []),
    ...(isPunchUser?([
      {title:'My attendance',detail:'Face + office GPS Clock In / Clock Out from the attendance screen.',href:'/mobile-attendance',tone:'green',tag:'Attendance'},
      {title:'Face enrollment',detail:'Enroll your face or check your current enrollment status.',href:'/mobile-attendance/enroll',tone:'purple',tag:'Face'},
      {title:'Button Clock In / Out',detail:'Use only when HR or Super Admin has granted active permission.',href:'/mobile-attendance/button',tone:'orange',tag:'Permission'},
      {title:'My attendance history',detail:'View stored attendance punches, status and worked minutes.',href:'/my-attendance-history',tone:'blue',tag:'History'},
      {title:'Face change request',detail:'Request a fresh face enrollment approval.',href:'/face-change',tone:'pink',tag:'Request'},
      {title:'My leave requests',detail:'Apply for leave and review the status of your requests.',href:'/leaves',tone:'green',tag:'Leave'},
      {title:'My regularizations',detail:'Submit attendance correction requests for missed punches.',href:'/regularizations',tone:'orange',tag:'Correction'},
      {title:'My weekly off',detail:'Check your assigned weekly off and related requests.',href:'/weekly-off',tone:'purple',tag:'Weekly off'},
      {title:'Holidays',detail:'View the holiday calendar available for your organisation.',href:'/holidays',tone:'slate',tag:'Calendar'},
      {title:"Who’s on leave today",detail:'See approved staff who are on leave today within your visible scope.',href:'/on-leave-today',tone:'green',tag:'Live'},
      {title:'Offline draft reminders',detail:'Review offline punch drafts which are not yet submitted.',href:'/mobile-attendance/offline',tone:'slate',tag:'Offline'},
    ] satisfies Card[]):[]),
  ];

  const teamCards:Card[]=[
    ...(approver?([{title:'Staff break review',detail:'Review team random breaks with employee, date and department filters.',href:'/breaks',tone:'slate',tag:'Break log'}] satisfies Card[]):[]),
    ...(role==='HR'?([{title:'Temporary button attendance',detail:'Grant or revoke short-term button + GPS attendance exceptions for employees and department heads.',href:'/permissions',tone:'pink',tag:'HR access'}] satisfies Card[]):[]),
    ...(hod?([
      {title:'Department employees',detail:'See employees mapped to your department.',href:'/department-employees',tone:'blue',tag:'Department'},
      {title:'Department attendance',detail:'Track department attendance with filtered records.',href:'/department-attendance',tone:'green',tag:'Department'},
    ] satisfies Card[]):[]),
    ...(approver?([
      {title:'Review leaves',detail:'Review pending leave requests in your reporting scope.',href:'/approvals/leaves',tone:'green',tag:'Approval'},
      {title:'Review regularizations',detail:'Review attendance correction requests.',href:'/approvals/regularizations',tone:'orange',tag:'Approval'},
      {title:'Review weekly off',detail:'Approve or reject weekly-off requests.',href:'/review-weekly-off',tone:'purple',tag:'Approval'},
    ] satisfies Card[]):[]),
    ...(admin?([
      {title:'Face change approvals',detail:'Approve employee face re-enrollment requests.',href:'/face-reviews',tone:'pink',tag:'Approval'},
      {title:'Password reset requests',detail:'Generate and copy 8-digit reset codes for staff.',href:'/password-reset-requests',tone:'blue',tag:'Access'},
    ] satisfies Card[]):[]),
  ];

  const adminCards:Card[]=[
    ...(role==='SUPER_ADMIN'?([{title:'Break management',detail:'Manage lunch-break schedule and review every staff random break.',href:'/breaks',tone:'blue',tag:'Breaks'}] satisfies Card[]):[]),
    ...(admin?([
      {title:'Employees',detail:'Employee directory, details and KYC overview.',href:'/employees',tone:'blue',tag:'Admin'},
      {title:'Create employee',detail:'Add one employee manually with validated details.',href:'/employees/new',tone:'green',tag:'Admin'},
      {title:'Excel / CSV import',detail:'Preview and bulk create employees from file import.',href:'/employees/import',tone:'purple',tag:'Admin'},
      {title:'Organisation attendance',detail:'View daily organisation attendance, reports and export options.',href:'/attendance',tone:'orange',tag:'Admin'},
      ...(role==='SUPER_ADMIN'?([{title:'Button attendance permissions',detail:'Grant or revoke temporary button attendance permissions.',href:'/permissions',tone:'pink',tag:'Admin'}] satisfies Card[]):[]),
      {title:'Shift management',detail:'Create and manage shifts and working hours.',href:'/shifts',tone:'green',tag:'Admin'},
      {title:'Departments',detail:'Manage departments and department setup.',href:'/departments',tone:'blue',tag:'Admin'},
      {title:'Office locations',detail:'Manage approved office / store / warehouse geofence points.',href:'/locations',tone:'orange',tag:'Admin'},
      {title:'Attendance settings',detail:'Configure face, GPS, grace and attendance rules.',href:'/attendance-settings',tone:'purple',tag:'Admin'},
      {title:'Documents / KYC',detail:'Open employee document workspace and KYC records.',href:'/documents',tone:'slate',tag:'Admin'},
      ...(role==='SUPER_ADMIN'?[{title:'Leave policy',detail:'Create or update leave policy rules for the organisation.',href:'/leave-policy',tone:'green',tag:'Admin'} as Card]:[]),
    ] satisfies Card[]):[]),
  ];

  return (
    <Shell name={profile.full_name||'Team member'} role={role}>
      <div className="eyebrow">WORK MATE / DASHBOARD</div>
      <div className="wm-dashboard-hero card">
        <div>
          <h1>Welcome, {profile.full_name?.split(' ')[0] || 'there'}.</h1>
          <p className="muted">Modules available to your {role.replaceAll('_',' ').toLowerCase()} account. All cards below keep the same existing Work Mate functionality.</p>
        </div>
        <div className="wm-dashboard-hero-pill">{role.replaceAll('_',' ')}</div>
      </div>
      <CardSection title="My workspace" desc={role === 'SUPER_ADMIN' ? 'Quick access to your overview, profile and organisation calendar.' : 'Your day-to-day attendance, profile and personal request modules.'} cards={selfCards} />
      <CardSection title="Team review" desc="Approvals and review tools available in your current reporting scope." cards={teamCards} />
      <CardSection title="Administration" desc="Management screens available for HR and administrative control." cards={adminCards} />
    </Shell>
  );
}
