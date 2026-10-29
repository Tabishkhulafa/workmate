import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import Link from 'next/link';
import {attendanceStatus,attendanceIsLate,attendanceFilterMatch,attendanceFilterLabel,parseAttendanceFilter, type AttendanceFilter} from '@/lib/attendance-filters';
type Row={employee_id:string;full_name:string|null;employee_code:string|null;department_name:string|null;effective_status:string;attendance:Record<string,unknown>|null};
const str=(x:unknown)=>x==null||x===''?'—':String(x);

const indiaDateTime = new Intl.DateTimeFormat('en-IN', {
 timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
 hour: '2-digit', minute: '2-digit', hour12: true,
});
function displayPunch(value: unknown): string {
 if (value == null || value === '') return '—';
 if (typeof value !== 'string') return str(value);
 const text = value.trim();
 if (!text) return '—';
 // A time-only value has no timezone. Do not invent a UTC offset.
 if (/^\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) return text;
 // ISO timestamps with an explicit offset are instants; convert to IST for display.
 if (/^\d{4}-\d{2}-\d{2}T/.test(text) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
  const time = new Date(text);
  if (!Number.isNaN(time.getTime())) return indiaDateTime.format(time);
 }
 // Unzoned datetime values cannot be shifted safely; retain their input.
 return text;
}
function displayStatus(value: string): string {
 const status = value.replace(/_/g, ' ').trim();
 return status ? status.replace(/\b\w/g, char => char.toUpperCase()) : '—';
}

export default async function Attendance({searchParams}:{searchParams:Promise<{date?:string;search?:string;department?:string;status?:string}>}){
 const {profile,supabase}=await requireAdmin();const p=await searchParams;
 const date=/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')?p.date!:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const {data,error}=await supabase.functions.invoke('organisation-attendance-report',{body:{date}});
 const response=data as {success?:boolean;rows?:Row[];departments?:{id:string;name:string}[];error?:string}|null;
 const dept=p.department||'',term=(p.search||'').toLowerCase();
 const baseRows=(response?.rows||[]).filter(r=>(!dept||r.department_name===dept)&&(!term||`${r.full_name||''} ${r.employee_code||''}`.toLowerCase().includes(term)));
 const selected=parseAttendanceFilter(p.status);
 const rows=baseRows.filter(r=>attendanceFilterMatch(r,selected));
 const params=new URLSearchParams({date,department:dept,search:p.search||'',status:selected});
 const allParams=new URLSearchParams({date,department:dept,search:p.search||''});
 const reportLink=(filter:AttendanceFilter)=>'/attendance?'+new URLSearchParams({...Object.fromEntries(allParams),status:filter}).toString()+'#employee-list';
 const buckets=['Present','Half day','Absent','In progress','Not marked'] as const;
 const tones=['#16a34a','#f59e0b','#ef4444','#2563eb','#a1a1aa'];
 const counts=buckets.map(k=>baseRows.filter(r=>attendanceFilterLabel(attendanceStatus(r))===k).length);
 const total=baseRows.length;
 let running=0;
 const segments=counts.map((v,i)=>{
  const start=running;running+=total>0?100*v/total:0;
  return `${tones[i]} ${start}% ${running}%`;
 });
 const departments=[...new Set(baseRows.map(r=>r.department_name||'Unassigned'))].sort();
 const deptSummary=departments.map(name=>({name,items:baseRows.filter(r=>(r.department_name||'Unassigned')===name)}));
 const lateCount=baseRows.filter(attendanceIsLate).length;
 const metrics:{filter:AttendanceFilter;name:string;value:number;tone:string}[]=[
  {filter:'ALL',name:'Staff',value:total,tone:'slate'},
  ...buckets.map((name,i)=>({filter:attendanceStatus({effective_status:name.replaceAll(' ','_')}) as AttendanceFilter,name,value:counts[i],tone:['green','amber','red','blue','slate'][i]})),
  {filter:'LATE',name:'Late',value:lateCount,tone:'orange'},
 ];
 return <Shell name={profile.full_name||'Administrator'} role={profile.role}><div className="eyebrow">LIVE REPORTING</div><h1>Organisation Attendance</h1><p className="muted">Same Supabase attendance data as Android. No sample records.</p>
 <form className="reportfilters"><label>Date<input type="date" name="date" defaultValue={date}/></label><label>Department<select name="department" defaultValue={dept}><option value="">All departments</option>{(response?.departments||[]).map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></label><label>Search<input name="search" defaultValue={p.search||''} placeholder="Employee name/code"/></label><button>Apply</button></form>
 {error||!response?.success?<div className="notice error">Unable to load authorized report: {response?.error||error?.message||'Unknown error'}</div>:<><div className="statgrid wm-filter-statgrid">{metrics.map(metric=><Link aria-current={selected===metric.filter?'true':undefined} aria-label={`Show ${metric.name} employees (${metric.value})`} href={reportLink(metric.filter)} className={`stat wm-filter-stat wm-filter-stat--${metric.tone}`} key={metric.filter}><strong>{metric.value}</strong><span>{metric.name}</span><small>View employees →</small></Link>)}</div><section className="wm-analytics-grid" aria-label="Attendance analytics"><div className="card wm-analytics-panel"><h2>Attendance distribution</h2><p className="muted small">Finalized statuses and pending punches remain separate.</p><div className="wm-donut-layout"><div className="wm-donut" role="img" aria-label={buckets.map((b,i)=>`${b}: ${counts[i]}`).join(', ')} style={{background:total>0?`conic-gradient(${segments.join(',')})`:'#e4e4e7'}}><div className="wm-donut-hole"><strong>{total}</strong><span>Employees</span></div></div><div className="wm-legend">{buckets.map((label,i)=><Link href={reportLink(metrics[i+1].filter)} className="wm-legend-row wm-legend-link" key={label}><span className="wm-swatch" style={{background:tones[i]}}/><span>{label}</span><strong>{counts[i]}</strong><small>{total?Math.round(counts[i]*100/total):0}%</small></Link>)}</div></div></div><div className="card wm-analytics-panel"><h2>Department-wise attendance</h2><p className="muted small">Same department filter and date as the table below.</p><div className="wm-dept-chart">{deptSummary.map(({name,items})=><div className="wm-dept-row" key={name}><div className="wm-dept-title"><strong>{name}</strong><span>{items.length} staff</span></div><div className="wm-dept-track" aria-label={`${name}: ${items.length} staff`}>{buckets.map((label,i)=>{const count=items.filter(r=>attendanceFilterLabel(attendanceStatus(r))===label).length;return <span key={label} title={`${label}: ${count}`} style={{width:`${items.length?100*count/items.length:0}%`,background:tones[i]}}/>})}</div></div>)}{deptSummary.length===0&&<p className="muted">No employees match the selected filters.</p>}</div></div></section><section id="employee-list" className="wm-report-filter-summary" aria-live="polite"><div><span className="wm-report-filter-kicker">Employee list</span><h2>{attendanceFilterLabel(selected)} <small>({rows.length})</small></h2><p className="muted small">Click any summary card to view only employees in that category, using the current date, department and search filters.</p></div>{selected!=='ALL'&&<Link className="buttonlink" href={'/attendance?'+allParams.toString()+'#employee-list'}>Clear category</Link>}</section><div className="reportactions"><a className="buttonlink" href={'/api/attendance/export?'+params.toString()}>Download CSV</a></div><div className="card wm-attendance-card"><div className="tablewrap wm-attendance-tablewrap"><table className="wm-attendance-table"><thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Status</th><th>Clock In</th><th>Clock Out</th><th>Late min</th></tr></thead><tbody>{rows.map(r=><tr key={r.employee_id}><td>{str(r.full_name)}</td><td>{str(r.employee_code)}</td><td>{str(r.department_name)}</td><td><span className={`wm-attendance-status wm-attendance-status--${r.effective_status === "PRESENT" ? "present" : r.effective_status === "IN_PROGRESS" ? "progress" : r.effective_status === "ABSENT" ? "absent" : "other"}`}>{displayStatus(r.effective_status)}</span></td><td className="wm-attendance-time">{displayPunch(r.attendance?.clock_in_at||r.attendance?.clock_in_time)}</td><td className="wm-attendance-time">{displayPunch(r.attendance?.clock_out_at||r.attendance?.clock_out_time)}</td><td>{str(r.attendance?.late_minutes)}</td></tr>)}</tbody></table></div>{rows.length===0&&<p className="muted">No employees match this selection.</p>}</div></>}
 </Shell>;
}
