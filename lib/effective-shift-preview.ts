/** Mirrors the attendance-action resolver for read-only UI. The backend is authoritative at punch time. */
export type ShiftScope = 'ORGANISATION' | 'DEPARTMENT' | 'EMPLOYEE';
export type ShiftTemplate = { id: string; name: string; start_time: string; end_time: string; is_active: boolean | null; fields: Record<string, string> };
export type ShiftStaff = { id: string; full_name: string | null; employee_code: string | null; role: string; department_id: string | null };
export type ShiftDepartment = { id: string; name: string };
export type ShiftAssignment = { id: string; shift_id: string; scope: ShiftScope; department_id: string | null; employee_id: string | null; effective_from: string; effective_to: string | null; is_active: boolean; created_at?: string | null };
export type ShiftOverride = { id: string; name: string; scope: ShiftScope; department_id: string | null; employee_id: string | null; start_date: string; end_date: string; start_time: string; end_time: string; required_work_minutes: number; half_day_minutes: number; is_active: boolean; created_at?: string | null };
export type EffectiveShift = { name: string; start_time: string; end_time: string; required_work_minutes: number; half_day_minutes: number; source: 'Special' | 'Regular'; level: ShiftScope };
const scopeMatches = (scope: ShiftScope, targetId: string | null, user: ShiftStaff) => scope === 'ORGANISATION' || (scope === 'EMPLOYEE' ? targetId === user.id : Boolean(user.department_id) && targetId === user.department_id);
const latestFirst = <T extends { created_at?: string | null }>(rows: T[]) => [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
export function resolveEffectiveShiftPreview({ employee, date, shifts, assignments, overrides }: { employee: ShiftStaff; date: string; shifts: ShiftTemplate[]; assignments: ShiftAssignment[]; overrides: ShiftOverride[] }): EffectiveShift | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const activeSpecials = latestFirst(overrides.filter(o => o.is_active && o.start_date <= date && o.end_date >= date));
  const activeRegulars = latestFirst(assignments.filter(a => a.is_active && a.effective_from <= date && (!a.effective_to || a.effective_to >= date)));
  for (const level of ['EMPLOYEE', 'DEPARTMENT', 'ORGANISATION'] as const) {
    const hit = activeSpecials.find(row => row.scope === level && scopeMatches(row.scope, row.scope === 'EMPLOYEE' ? row.employee_id : row.department_id, employee));
    if (hit) return { name: hit.name, start_time: hit.start_time, end_time: hit.end_time, required_work_minutes: Number(hit.required_work_minutes), half_day_minutes: Number(hit.half_day_minutes), source: 'Special', level };
  }
  for (const level of ['EMPLOYEE', 'DEPARTMENT', 'ORGANISATION'] as const) {
    const hit = activeRegulars.find(row => row.scope === level && scopeMatches(row.scope, row.scope === 'EMPLOYEE' ? row.employee_id : row.department_id, employee) && shifts.some(s => s.id === row.shift_id && s.is_active === true));
    if (hit) {
      const shift = shifts.find(s => s.id === hit.shift_id)!;
      return { name: shift.name, start_time: shift.start_time, end_time: shift.end_time, required_work_minutes: Number(shift.fields.required_work_minutes || 540), half_day_minutes: Number(shift.fields.half_day_minutes || 270), source: 'Regular', level };
    }
  }
  return null;
}
