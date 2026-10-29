WORK MATE — SHIFT MANAGEMENT UI + EFFECTIVE SHIFT PREVIEW
Date: 23 Oct 2026
Local only. Modified/new files; no production Supabase changes; no Vercel deploy.

CHANGED FILES
1. app/shifts/page.tsx
2. app/shifts/shift-table.tsx
3. app/shifts/shift-plans.tsx
4. app/shifts/shift-management.module.css (new)
5. lib/effective-shift-preview.ts (new, READ-ONLY calculator)

APPLY
cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Shift_Management_UI_20261023.zip" -DestinationPath . -Force
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
Visit http://localhost:3000/shifts as HR or Super Admin.

WHAT CHANGED
- Responsive, redesigned shift template cards; clear start and end times, full/half-day thresholds, next-day indicators.
- Updated regular/special shift assignment UI with searchable target lists and explicit effective dates.
- Read-only inspector shows the shift applicable to any staff member (including HR) on a selected date.
- Shows assignments and allows deactivation through existing endpoint; no backend changes.
- Restricts UI organisation-wide assignments to Super Admin and hides HR target assignments from HR (server enforces too).
- Default assignment date range: today to same date next year (up to 2 years supported by pre-existing staging Edge Function).

ALREADY IMPLEMENTED IN CURRENT LIVE ATTENDANCE-ACTION BACKEND (READ-ONLY INSPECTION)
- Clock In resolves shift: SPECIAL (employee > department > organisation), then REGULAR (employee > department > organisation).
- Saves scheduled_start_time, scheduled_end_time, required_work_minutes, half_day_minutes and calculated late_minutes in new attendance row.
- Uses actual Clock In/Out timestamps for worked_minutes (NOT an automatic punch at scheduled start).
- Existing attendance history is not recalculated by assigning or changing a shift.

IMPORTANT LIMITATIONS (UNMODIFIED BACKEND)
- Current live attendance-action rejects Clock Out after midnight (PAST_DAY_CLOCK_OUT_DISABLED).
  An overnight Marketing shift (18:05 to 03:05) WILL NOT be fully supported by the current live backend.
  The UI explicitly flags this. Fix overnight attendance in a separate staging-tested backend patch before use.
- Existing proxy staging safety lock remains unchanged. Shift create/update and assignment actions
  remain read-only on localhost connected to production Supabase.
- Currently the live production project does NOT have manage-shift-plans deployed. Source for this
  staging-only Edge Function was previously included in WorkMate_LOCAL_Staff_Shifts_Attendance_Patch.zip.
  Deploy only to a separate staging Supabase instance after its schema/auth environment is ready.
- No automatic Clock In when a shift begins. Face/GPS attendance punch still required.
- If an assignment does not apply to a date, clock-in can be rejected with NO_SHIFT.

VALIDATION PERFORMED HERE
- TypeScript/TSX transpilation: 4 files syntax passed.
- CSS class references: all present.
- Effective shift resolver: 8 runtime scenarios passed (precedence, expiry, inactive, HR, no shift).
- Full Next.js npm lint/build NOT run in this environment due to missing node_modules;
  run the commands above before deploying.

DO NOT deploy to production until UI, shift assignments, HR access, midnight behavior and user permissions have been tested on staging.
