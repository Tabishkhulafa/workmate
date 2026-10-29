'use client';

import {useEffect,useMemo,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Clock3,Coffee,TimerReset,ArrowRightFromLine,ArrowLeftToLine,Users,CalendarDays,Settings2,CheckCircle2,ShieldCheck,AlertTriangle} from 'lucide-react';
import {durationLabel,durationSeconds,indiaWeekday,shortIST,timeLabel,WEEKDAYS,isBreakManager,isBreakReviewer,isBreakUser,type BreakReason,type BreakRow,type BreakSchedule,type BreakWorkplace,type BreakWorkplacePolicy,BREAK_WORKPLACES,breakWorkplaceAllowed} from '@/lib/breaks';
import styles from './breaks.module.css';

type Props={role:string;name:string;date:string;today:string;schedule:BreakSchedule[];workplace:BreakWorkplace|null;workplacePolicies:BreakWorkplacePolicy[];mine:BreakRow[];team:BreakRow[];canClockBreak:boolean;disabledReason:string|null;issues:string[]};
const names:Record<BreakReason,string>={FOOD:'Food / refreshments',PERSONAL:'Personal work',OTHER:'Other reason'};
async function sendAction(payload:Record<string,unknown>):Promise<void>{
 const resp=await fetch('/api/breaks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin',cache:'no-store'});
 let data:{error?:string}={};
 try{data=await resp.json();}catch{throw Error(`Request failed (${resp.status}).`);}
 if(!resp.ok)throw Error(data.error||`Request failed (${resp.status}).`);
}
function Summary({label,value,sub,icon}:{label:string;value:string;sub:string;icon:React.ReactNode}){
 return <div className={styles.summary}><div className={styles.summaryIcon}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>;
}
function Duration({row,now}:{row:BreakRow;now:number}){
 return <span className={styles.number}>{durationLabel(durationSeconds(row.started_at,row.ended_at,now))}</span>;
}
function ScheduleEditor({row,disabledReason}:{row:BreakSchedule;disabledReason:string|null}){
 const [start,setStart]=useState(row.start_time.slice(0,5));
 const [end,setEnd]=useState(row.end_time.slice(0,5));
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const router=useRouter();
 useEffect(()=>{setStart(row.start_time.slice(0,5));setEnd(row.end_time.slice(0,5));},[row.start_time,row.end_time]);
 async function save(){setBusy(true);setMessage('');try{await sendAction({action:'schedule',weekday:row.weekday,start_time:start,end_time:end});setMessage('Saved');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}}
 return <div className={styles.scheduleEdit}><span className={styles.dayLabel}>{WEEKDAYS[row.weekday-1]}</span><label>Start<input aria-label={`${WEEKDAYS[row.weekday-1]} break start`} type="time" value={start} onChange={e=>setStart(e.target.value)} disabled={busy||!!disabledReason}/></label><label>End<input aria-label={`${WEEKDAYS[row.weekday-1]} break end`} type="time" value={end} onChange={e=>setEnd(e.target.value)} disabled={busy||!!disabledReason}/></label><button type="button" className={styles.save} onClick={save} disabled={busy||!!disabledReason||(!start||!end)}>{busy?'Saving…':'Save'}</button>{message&&<span className={styles.editorMessage} role="status">{message}</span>}</div>;
}

function WorkplacePolicyEditor({workplace,policy,disabledReason}:{workplace:BreakWorkplace;policy:BreakWorkplacePolicy|undefined;disabledReason:string|null}){
 const router=useRouter();
 const [saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const enabled=policy?.is_enabled===true;
 async function toggle(){
  if(!policy)return;
  setSaving(true);setMessage('');
  try{
   await sendAction({action:'workplace_policy',workplace_type:workplace,is_enabled:!enabled});
   setMessage('Saved');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to update workplace access.');}
  finally{setSaving(false);}
 }
 return <div className={styles.workplaceCard}>
  <div><strong>{workplace==='OFFICE'?'Office':workplace==='STORE'?'Store':'Warehouse'}</strong>
   <small>{!policy?'Not configured':enabled?'New random breaks allowed':'New random breaks blocked'}</small></div>
  <button type="button" className={enabled?styles.enabledToggle:styles.disabledToggle}
    aria-label={`${workplace} Random Break ${enabled?'enabled':'disabled'}; click to ${enabled?'disable':'enable'}`}
    aria-pressed={enabled} disabled={saving||!!disabledReason||!policy} onClick={toggle}>
    {saving?'Saving…':enabled?'Enabled':'Disabled'}
  </button>
  {message&&<small role="status" className={styles.editorMessage}>{message}</small>}
 </div>;
}

export default function BreaksClient({role,name,date,today,schedule,workplace,workplacePolicies,mine,team,canClockBreak,disabledReason,issues}:Props){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
 const [reason,setReason]=useState<BreakReason>('FOOD');
 const [now,setNow]=useState(0);
 const [term,setTerm]=useState(''),[department,setDepartment]=useState('');
 const [tab,setTab]=useState<'mine'|'team'|'settings'>(isBreakUser(role)?'mine':isBreakReviewer(role)?'team':'settings');
 const [isNavigating,startTransition]=useTransition();
 useEffect(()=>{setNow(Date.now());const id=window.setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id);},[]);
 const manager=isBreakManager(role),canTake=isBreakUser(role),reviewer=isBreakReviewer(role);
 const workplaceIsEnabled=breakWorkplaceAllowed(workplace,workplacePolicies);
 const workplaceWarning=!workplace?'Workplace is not assigned. Ask HR to update your employee profile.':
  !workplacePolicies.some(row=>row.workplace_type===workplace)?'Random Break workplace controls are not configured on this database.':
  !workplaceIsEnabled?`Random Break is currently disabled for ${workplace.toLowerCase()} staff.`:null;
 const currentSchedule=schedule.find(r=>r.weekday===indiaWeekday());
 const active=mine.find(row=>row.ended_at===null);
 const selectedDays=mine.filter(row=>row.started_at&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.started_at))===date);
 const completed=selectedDays.filter(r=>r.ended_at!==null);
 const totalSeconds=completed.reduce((sum,row)=>sum+durationSeconds(row.started_at,row.ended_at,now),0);
 const completedCount=completed.length;
 const departments=useMemo(()=>[...new Set(team.map(x=>x.department_name||'Unassigned'))].sort(),[team]);
 const filtered=useMemo(()=>team.filter(row=>{
  const search=`${row.employee_name||''} ${row.employee_code||''} ${row.department_name||''}`.toLowerCase();
  return (!term||search.includes(term.toLowerCase()))&&(!department||row.department_name===department);
 }),[team,term,department]);
 const teamTotals=useMemo(()=>{
  const sums=new Map<string,{id:string;name:string;code:string;department:string;seconds:number;completed:number;active:boolean}>();
  for(const row of filtered){
   const old=sums.get(row.employee_id)||{id:row.employee_id,name:row.employee_name||'Employee',code:row.employee_code||'',department:row.department_name||'Unassigned',seconds:0,completed:0,active:false};
   if(row.ended_at){old.seconds+=durationSeconds(row.started_at,row.ended_at,now);old.completed++;}else old.active=true;
   sums.set(row.employee_id,old);
  }
  return [...sums.values()].sort((a,b)=>a.name.localeCompare(b.name));
 },[filtered,now]);
 async function doAction(action:'start'|'stop'){
  setBusy(true);setActionError('');
  try{await sendAction(action==='start'?{action,reason}:{action,break_id:active?.id});router.refresh();}
  catch(e){setActionError(e instanceof Error?e.message:'Break request failed.');}
  finally{setBusy(false);}
 }
 function changeDay(nextDate:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(nextDate))return;startTransition(()=>router.push(`/breaks?date=${encodeURIComponent(nextDate)}`));}
 return <div className={styles.page}>
  <div className={styles.heading}><div><div className="eyebrow">WORK MATE / BREAK MANAGEMENT</div><h1>Break time</h1><p className="muted">Scheduled lunch and personal random breaks, with time-stamped history and role-based team visibility.</p></div><span className={styles.ist}><Clock3 size={16}/> All times in IST</span></div>
  {issues.length>0&&<div className={styles.warning} role="alert"><AlertTriangle size={18}/><div><b>Break module is not ready on this database.</b><p>{issues[0]}</p><small>Run the included SQL only on your separate staging Supabase project. Live attendance remains unchanged.</small></div></div>}
  {disabledReason&&<div className={styles.readOnly} role="status"><ShieldCheck size={18}/><div><strong>Read-only local preview</strong><span>{disabledReason} Break In/Out and schedule editing will unlock on an isolated staging project.</span></div></div>}
  <div className={styles.summaryGrid}>
   <Summary icon={<Coffee size={21}/>} label="Scheduled lunch (today)" value={currentSchedule?`${timeLabel(currentSchedule.start_time)} – ${timeLabel(currentSchedule.end_time)}`:'Not configured'} sub={currentSchedule?WEEKDAYS[currentSchedule.weekday-1]:'Staging setup required'}/>
   <Summary icon={<TimerReset size={21}/>} label="My random break" value={!canTake?'Review only':active?'In progress':`${completedCount} completed`} sub={active?'Timer running':date===today?'Today':'Selected date'}/>
   <Summary icon={<Clock3 size={21}/>} label="My completed break time" value={canTake?durationLabel(totalSeconds):'—'} sub="Separate from worked attendance hours"/>
  </div>
  <div className={styles.tabs} role="tablist" aria-label="Break views">
   {canTake&&<button className={tab==='mine'?styles.selected:''} role="tab" aria-selected={tab==='mine'} onClick={()=>setTab('mine')}>My random breaks</button>}
   {reviewer&&<button className={tab==='team'?styles.selected:''} role="tab" aria-selected={tab==='team'} onClick={()=>setTab('team')}>{role==='DEPARTMENT_HEAD'?'Team breaks':role==='HR'?'Staff breaks':'All staff breaks'}</button>}
   {manager&&<button className={tab==='settings'?styles.selected:''} role="tab" aria-selected={tab==='settings'} onClick={()=>setTab('settings')}>Lunch & workplace settings</button>}
  </div>
  {tab==='mine'&&canTake&&<section className={styles.panel} aria-label="Personal break timer">
   <div className={styles.panelHead}><div><span className={styles.kicker}>RANDOM BREAK TIMER</span><h2>{active?'Your break is running':'Start a random break'}</h2><p className="muted">For food, errands or stepping away during working hours. Every completed break creates a separate history row.</p></div><span className={active?styles.activeBadge:styles.idleBadge}>{active?'● In progress':'Not on break'}</span></div>
   {!active&&workplaceWarning&&<div className={styles.workplaceNotice} role="status"><AlertTriangle size={17}/><span>{workplaceWarning}</span></div>}
   <div className={styles.timerArea}><div className={styles.timerText}><span>{active?'Elapsed time':'Break duration'}</span><strong>{active?durationLabel(durationSeconds(active.started_at,null,now)):'0m 00s'}</strong><small>{active?`Started ${shortIST(active.started_at)}`:'Time is recorded by the database server'}</small></div><div className={styles.timerActions}>
    {!active&&<label className={styles.reason}>Reason<select value={reason} onChange={e=>setReason(e.target.value as BreakReason)} disabled={busy||!!disabledReason}>{Object.entries(names).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
    {active?<button type="button" className={styles.stop} onClick={()=>doAction('stop')} disabled={busy||!!disabledReason}><ArrowLeftToLine size={17}/>{busy?'Ending…':'Break Out'}</button>:<button type="button" className={styles.start} onClick={()=>doAction('start')} disabled={busy||!!disabledReason||!canClockBreak||!workplaceIsEnabled}><ArrowRightFromLine size={17}/>{busy?'Starting…':'Break In'}</button>}
    {!active&&!canClockBreak&&<small className={styles.help}>Clock In first to enable Random Break.</small>}
   </div></div>
   {actionError&&<p className={styles.actionError} role="alert">{actionError}</p>}
   <div className={styles.sectionTitle}><div><h3>My break history</h3><p>Individual records; unlimited completed breaks per day.</p></div><label className={styles.dateFilter}><CalendarDays size={16}/>Date<input type="date" value={date} onChange={e=>changeDay(e.target.value)} disabled={isNavigating}/></label></div>
   {selectedDays.length===0?<div className={styles.empty}><TimerReset size={25}/><strong>No random breaks on this date</strong><p>After a Break In and Break Out, a new record appears here.</p></div>:<div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Break</th><th>Reason</th><th>Break In</th><th>Break Out</th><th>Duration</th><th>Status</th></tr></thead><tbody>{selectedDays.map((row,i)=><tr key={row.id}><td>#{selectedDays.length-i}</td><td>{names[row.reason]}</td><td>{shortIST(row.started_at)}</td><td>{row.ended_at?shortIST(row.ended_at):'—'}</td><td><Duration row={row} now={now}/></td><td><span className={row.ended_at?styles.doneBadge:styles.activeBadge}>{row.ended_at?'Completed':'In progress'}</span></td></tr>)}</tbody></table></div>}
  </section>}
  {tab==='team'&&reviewer&&<section className={styles.panel} aria-label="Staff break report"><div className={styles.panelHead}><div><span className={styles.kicker}>ROLE-SCOPED REVIEW</span><h2>{role==='DEPARTMENT_HEAD'?'My department':role==='HR'?'Employees & department heads':'Entire organisation'}</h2><p className="muted">View only staff permitted by your role. Completed and ongoing breaks remain separate from attendance hours.</p></div><Users size={27} className={styles.headIcon}/></div>
   <div className={styles.filters}><label>Date<input type="date" value={date} onChange={e=>changeDay(e.target.value)} disabled={isNavigating}/></label><label>Search<input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Name or employee code"/></label><label>Department<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All visible departments</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label></div>
   <div className={styles.sectionTitle}><div><h3>Employee-wise summary</h3><p>{teamTotals.length} staff with break records (up to 500 per date)</p></div></div>
   {teamTotals.length===0?<div className={styles.empty}><Users size={24}/><strong>No matching breaks</strong><p>Change the date or search filters to see authorized staff activity.</p></div>:<div className={styles.staffGrid}>{teamTotals.map(x=><article className={styles.staffCard} key={x.id}><div><strong>{x.name}</strong><small>{x.code} · {x.department}</small></div><div><b>{durationLabel(x.seconds)}</b><small>{x.completed} completed {x.active?'· 1 running':''}</small></div></article>)}</div>}
   <div className={styles.sectionTitle}><div><h3>Detailed break log</h3><p>Every individual Break In and Break Out is recorded.</p></div></div>
   <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Employee</th><th>Department</th><th>Reason</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th></tr></thead><tbody>{filtered.length?filtered.map(row=><tr key={row.id}><td><strong>{row.employee_name}</strong><small>{row.employee_code}</small></td><td>{row.department_name}</td><td>{names[row.reason]}</td><td>{shortIST(row.started_at)}</td><td>{row.ended_at?shortIST(row.ended_at):'—'}</td><td><Duration row={row} now={now}/></td><td><span className={row.ended_at?styles.doneBadge:styles.activeBadge}>{row.ended_at?'Completed':'Ongoing'}</span></td></tr>):<tr><td colSpan={7} className={styles.emptyCell}>No breaks found for these filters.</td></tr>}</tbody></table></div>
  </section>}
  {tab==='settings'&&manager&&<section className={styles.panel} aria-label="Scheduled break management"><div className={styles.panelHead}><div><span className={styles.kicker}>COMPANY BREAK SETTINGS</span><h2>Regular lunch break schedule</h2><p className="muted">Editable by HR and Super Admin. Friday is longer by default. This schedule is informational and does not alter attendance calculations.</p></div><Settings2 className={styles.headIcon} size={27}/></div>
   <div className={styles.workplaceSection}>
    <div className={styles.sectionTitle}><div><h3>Random Break access by workplace</h3><p>HR and Super Admin control who can start a new Random Break. Defaults: enabled for all three workplaces.</p></div></div>
    <div className={styles.workplaceGrid}>{BREAK_WORKPLACES.map(workplaceType=><WorkplacePolicyEditor
      key={workplaceType} workplace={workplaceType}
      policy={workplacePolicies.find(policy=>policy.workplace_type===workplaceType)}
      disabledReason={disabledReason}/> )}</div>
    <div className={styles.explain}><ShieldCheck size={18}/> Disabling a workplace blocks new Break In only. Already running breaks can still Break Out. Previous break records remain unchanged.</div>
   </div>
   <div className={styles.sectionTitle}><div><h3>Scheduled lunch break timetable</h3><p>Editing lunch times does not change Random Break access.</p></div></div>
   <div className={styles.scheduleList}>{schedule.length?schedule.map(row=><ScheduleEditor key={row.weekday} row={row} disabledReason={disabledReason}/>):<p className="muted">No break schedule yet. Install the staging SQL to create Monday–Sunday settings.</p>}</div><div className={styles.explain}><CheckCircle2 size={18}/> The default is 1:00–1:45 PM, except Friday 1:00–2:00 PM. Changes apply to the displayed schedule only, not past attendance.</div>
  </section>}
  <p className={styles.footer}>Work Mate · Random breaks are tracked independently. Existing Clock In/Out, shifts, payroll, attendance status and GPS/face verification are not modified.</p>
 </div>;
}
