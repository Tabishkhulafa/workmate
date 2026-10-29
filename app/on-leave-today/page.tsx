import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';

type Leave = { id:string; employee_id:string; leave_type:string; start_date:string; end_date:string };
type Staff = { id:string; full_name:string|null; employee_code:string|null; department_id:string|null; is_active:boolean };
type Department = { id:string; name:string };

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const value = (part:string) => parts.find(p => p.type === part)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function friendlyDate(value: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : value;
}
function friendlyToday(value:string){
  return new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date(`${value}T12:00:00+05:30`));
}

export default async function OnLeaveToday(){
  const { profile, supabase } = await requireProfile();
  const allowed = ['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role);
  if(!allowed) redirect('/dashboard');
  const today=todayInIndia();

  const { data:leaves, error:leavesError } = await supabase.from('leave_requests').select('id,employee_id,leave_type,start_date,end_date').eq('status','APPROVED').lte('start_date',today).gte('end_date',today).limit(250);
  const requests=(leaves||[]) as Leave[];
  const ids=Array.from(new Set(requests.map(r=>r.employee_id)));
  const { data:staff, error:staffError } = ids.length ? await supabase.from('profiles').select('id,full_name,employee_code,department_id,is_active').in('id',ids) : { data: [] as Staff[], error:null };
  const people=(staff||[]) as Staff[];
  const byId=new Map(people.map(p=>[p.id,p]));
  const departmentIds = Array.from(new Set(people.map(p=>p.department_id).filter((id):id is string => Boolean(id))));
  const { data:depts, error:deptError } = departmentIds.length ? await supabase.from('departments').select('id,name').in('id',departmentIds) : { data: [] as Department[], error:null };
  const deptMap=new Map(((depts||[]) as Department[]).map(d=>[d.id,d.name]));

  const visible = requests.flatMap(leave=>{
    const employee = byId.get(leave.employee_id);
    if(!employee || !employee.is_active) return [];
    if(profile.role==='DEPARTMENT_HEAD' && employee.department_id !== profile.department_id) return [];
    return [{ leave, employee, department: employee.department_id ? deptMap.get(employee.department_id) || 'Department' : 'Not assigned' }];
  }).sort((a,b)=>(a.employee.full_name||'').localeCompare(b.employee.full_name||''));

  const paid = visible.filter(r=>r.leave.leave_type==='PAID').length;
  const unpaid = visible.filter(r=>r.leave.leave_type==='UNPAID').length;
  const deptCount = new Set(visible.map(r=>r.department)).size;
  const error = leavesError?.message || staffError?.message || deptError?.message;

  return <Shell name={profile.full_name || 'Team member'} role={profile.role}><section className="wm-onleave"><div className="eyebrow">TEAM AVAILABILITY</div><div className="wm-onleave-header"><div><h1>Who&apos;s on leave today?</h1><p className="muted">{friendlyToday(today)} · Approved leaves only · {profile.role === 'DEPARTMENT_HEAD' ? 'Your department' : 'Your authorized organisation scope'}</p></div><span className="wm-onleave-today-tag">Today · IST</span></div>{error ? <div className="notice error">Unable to load today&apos;s approved leaves: {error}</div> : <><div className="wm-onleave-stats"><div className="wm-onleave-stat wm-onleave-stat--total"><span>Employees on leave</span><strong>{visible.length}</strong></div><div className="wm-onleave-stat wm-onleave-stat--paid"><span>Paid leave</span><strong>{paid}</strong></div><div className="wm-onleave-stat wm-onleave-stat--unpaid"><span>Unpaid leave</span><strong>{unpaid}</strong></div><div className="wm-onleave-stat wm-onleave-stat--dept"><span>Departments</span><strong>{deptCount}</strong></div></div>{visible.length ? <div className="wm-onleave-grid">{visible.map(row=><article className="wm-onleave-person" key={row.leave.id}><div className="wm-onleave-person-top"><div className="wm-onleave-avatar" aria-hidden="true">{(row.employee.full_name || '?').trim().slice(0,1).toUpperCase()}</div><div className="wm-onleave-person-name"><h2>{row.employee.full_name || 'Employee'}</h2><p>{row.employee.employee_code || 'No code'}</p></div><span className={`wm-onleave-type wm-onleave-type--${row.leave.leave_type === 'PAID' ? 'paid' : row.leave.leave_type === 'UNPAID' ? 'unpaid' : 'other'}`}>{row.leave.leave_type.toLowerCase().replace(/^\w/, m=>m.toUpperCase())}</span></div><div className="wm-onleave-person-bottom"><div><span>Department</span><strong>{row.department}</strong></div><div><span>Approved leave dates</span><strong>{friendlyDate(row.leave.start_date)} – {friendlyDate(row.leave.end_date)}</strong></div></div></article>)}</div> : <div className="wm-onleave-empty"><span aria-hidden="true">✓</span><h2>No approved leaves today</h2><p>Everyone in your authorized team scope is available according to approved leave records.</p></div>}</>}<p className="muted small">Only approved leave dates are shown. Pending/rejected requests and private reasons are not displayed.</p></section></Shell>;
}
