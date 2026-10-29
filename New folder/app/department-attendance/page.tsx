import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
type Attendance={clock_in_at?:string|null;clock_out_at?:string|null;attendance_status?:string|null;late_minutes?:number|null};
type Employee={id:string;full_name?:string|null;employee_code?:string|null};
type Row={employee:Employee;effective_status:string;attendance:Attendance|null};
function ist(value:string|undefined|null){if(!value)return '—';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '—';return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(date);}
export default async function DepartmentAttendance({searchParams}:{searchParams:Promise<{date?:string}>}){
 const {supabase,profile}=await requireProfile();if(profile.role!=='DEPARTMENT_HEAD')redirect('/dashboard');
 const params=await searchParams;const date=/^\d{4}-\d{2}-\d{2}$/.test(params.date||'')?params.date!:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const {data,error}=await supabase.functions.invoke('department-overview',{body:{mode:'ATTENDANCE',date}});
 const result=data as {success?:boolean;rows?:Row[];department?:{name?:string};error?:string}|null;
 const rows=result?.success?result.rows||[]:[];
 const progress=rows.filter(row=>row.effective_status==='IN_PROGRESS').length;
 const present=rows.filter(row=>row.effective_status==='PRESENT').length;
 const half=rows.filter(row=>row.effective_status==='HALF_DAY').length;
 return <Shell name={profile.full_name||''} role={profile.role}><div className="eyebrow">MY DEPARTMENT</div><h1>Department attendance</h1><p className="muted">{result?.department?.name||'Assigned department'} · verified live report, IST</p>
 <form className="reportfilters"><label>Date<input type="date" name="date" defaultValue={date}/></label><button>View attendance</button></form>
 {error||!result?.success?<p className="notice error">{result?.error||error?.message||'Unable to load department attendance'}</p>:<><div className="statgrid"><div className="stat"><strong>{rows.length}</strong><span>Employees</span></div><div className="stat"><strong>{present}</strong><span>Present</span></div><div className="stat"><strong>{half}</strong><span>Half day</span></div><div className="stat"><strong>{progress}</strong><span>In progress</span></div></div><div className="card tablewrap"><table><thead><tr><th>Employee</th><th>Code</th><th>Status</th><th>Clock In (IST)</th><th>Clock Out (IST)</th></tr></thead><tbody>{rows.map((row,i)=><tr key={row.employee?.id||i}><td>{row.employee?.full_name||'—'}</td><td>{row.employee?.employee_code||'—'}</td><td>{row.effective_status.replaceAll('_',' ')}</td><td>{ist(row.attendance?.clock_in_at)}</td><td>{ist(row.attendance?.clock_out_at)}</td></tr>)}</tbody></table>{rows.length===0&&<p className="muted">No attendance rows found for this date.</p>}</div></>}
 </Shell>;
}
