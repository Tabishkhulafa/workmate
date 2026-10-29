import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import ShiftTable from './shift-table';

type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
  fields: Record<string, string>;
};

function display(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export default async function Shifts() {
  const {supabase, profile} = await requireAdmin();
  const {data, error} = await supabase.from('shifts').select('*').order('name', {ascending:true}).limit(500);
  const shifts: Shift[] = (data ?? []).map((entry: Record<string, unknown>) => ({
    id: display(entry.id),
    name: display(entry.name ?? entry.shift_name) || 'Unnamed shift',
    start_time: display(entry.start_time ?? entry.start_at),
    end_time: display(entry.end_time ?? entry.end_at),
    is_active: typeof entry.is_active === 'boolean' ? entry.is_active : null,
    fields: Object.fromEntries(Object.entries(entry).filter(([key]) => !['id','name','shift_name','start_time','end_time','start_at','end_at','is_active'].includes(key)).map(([key,value]) => [key,display(value)]).filter(([,value]) => value !== '')),
  }));
  return <Shell name={profile.full_name || ''} role={profile.role}>
    <div className="eyebrow">WORKPLACE</div>
    <h1>Shift management</h1>
    <p className="muted">Create, edit, deactivate or reactivate shifts. Deactivation preserves historical attendance records.</p>
    {error ? <div className="notice error">{error.message}</div> : <ShiftTable shifts={shifts} />}
  </Shell>;
}
