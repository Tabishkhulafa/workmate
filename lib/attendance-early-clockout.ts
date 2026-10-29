/** 15-minute attendance grace, not a shorter working shift.
 * Historic stored statuses remain authoritative until a separately approved correction.
 * Clock In/Out timestamps, scheduled shift and salary calculations are unchanged.
 */
export const EARLY_CLOCK_OUT_GRACE_MINUTES = 15;
export type FinalAttendance = 'PRESENT' | 'HALF_DAY' | 'ABSENT';

export function workStatus(worked: number, required = 540, halfDay = 270): FinalAttendance {
  if (!Number.isFinite(worked) || worked < 0) return 'ABSENT';
  const requiredMinutes = Number.isFinite(required) && required > 0 ? required : 540;
  const halfMinutes = Number.isFinite(halfDay) && halfDay > 0 ? halfDay : 270;
  const presentMinimum = Math.max(halfMinutes, requiredMinutes - EARLY_CLOCK_OUT_GRACE_MINUTES);
  return worked >= presentMinimum ? 'PRESENT' : worked >= halfMinutes ? 'HALF_DAY' : 'ABSENT';
}

export function isEarlyClockOut(
  status: string | null | undefined,
  worked: number | null | undefined,
  required: number | null | undefined = 540,
  clockedOut = true,
): boolean {
  const full = typeof required === 'number' && Number.isFinite(required) && required > 0 ? required : 540;
  return clockedOut && status === 'PRESENT' && typeof worked === 'number' &&
    Number.isFinite(worked) && worked >= full - EARLY_CLOCK_OUT_GRACE_MINUTES && worked < full;
}
