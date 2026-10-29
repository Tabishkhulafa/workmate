import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import { Clock3 } from 'lucide-react';
import ShiftTable, { type Shift } from './shift-table';
import ShiftPlans from './shift-plans';
import { stagingWriteError } from '@/lib/staging-write';
import styles from './shift-management.module.css';
import type { ShiftAssignment, ShiftDepartment, ShiftOverride, ShiftStaff } from '@/lib/effective-shift-preview';

function display(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
export default async function Shifts() {
  const { supabase, profile } = await requireAdmin();
  const [shiftResponse, staffResponse, departmentResponse, assignmentResponse, overrideResponse] = await Promise.all([
    supabase.from('shifts').select('*').order('name', { ascending: true }).limit(500),
    supabase.from('profiles').select('id,full_name,employee_code,role,department_id').eq('is_active', true).in('role', ['EMPLOYEE', 'DEPARTMENT_HEAD', 'HR']).order('full_name').limit(500),
    supabase.from('departments').select('id,name').eq('is_active', true).order('name').limit(200),
    supabase.from('shift_assignments').select('id,shift_id,scope,department_id,employee_id,effective_from,effective_to,is_active,created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(500),
    supabase.from('shift_overrides').select('id,name,scope,department_id,employee_id,start_date,end_date,start_time,end_time,required_work_minutes,half_day_minutes,is_active,created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(500),
  ]);
  const shifts: Shift[] = (shiftResponse.data ?? []).map((entry: Record<string, unknown>) => ({
    id: display(entry.id), name: display(entry.name ?? entry.shift_name) || 'Unnamed shift',
    start_time: display(entry.start_time ?? entry.start_at), end_time: display(entry.end_time ?? entry.end_at),
    is_active: typeof entry.is_active === 'boolean' ? entry.is_active : null,
    fields: Object.fromEntries(Object.entries(entry).filter(([key]) => !['id', 'name', 'shift_name', 'start_time', 'end_time', 'start_at', 'end_at', 'is_active'].includes(key)).map(([key, value]) => [key, display(value)]).filter(([, value]) => value !== '')),
  }));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const readOnly = Boolean(stagingWriteError());

  return <Shell name={profile.full_name || ''} role={profile.role}>
    <div className={styles.page}>
      <div className={styles.pageHero}>
        <div><span className={styles.kicker}>WORKPLACE / TIME & ATTENDANCE</span><h1>Shift management</h1><p>Manage shift timings, assign schedules to teams and HR, and check the exact shift that applies on an attendance date.</p></div>
        <span className={styles.heroTag}><Clock3 size={17}/> All schedule times in IST</span>
      </div>
      {shiftResponse.error
        ? <div className="notice error">Unable to load shifts: {shiftResponse.error.message}</div>
        : <>
          <ShiftTable shifts={shifts} readOnly={readOnly}/>
          {[staffResponse, departmentResponse, assignmentResponse, overrideResponse].some(response => response.error)
            ? <div className="notice error">Shift assignments could not be loaded. Check the Supabase read permissions and database tables.</div>
            : <ShiftPlans shifts={shifts} staff={(staffResponse.data || []) as ShiftStaff[]} departments={(departmentResponse.data || []) as ShiftDepartment[]} assignments={(assignmentResponse.data || []) as ShiftAssignment[]} overrides={(overrideResponse.data || []) as ShiftOverride[]} viewerRole={profile.role} today={today} readOnly={readOnly}/>}
        </>}
    </div>
  </Shell>;
}
