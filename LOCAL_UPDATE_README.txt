WORK MATE - LOCAL ONLY OCT 2026 FEATURE PATCH
============================================
Live Vercel and production Supabase were NOT modified by this patch.

Files:
- Employee mobile (digits only / maximum 10) and email validation; matching server check
- HR/employee personal profile phone validation
- My Profile > Change password (current password, strong new password, confirmation, sign out)
- Departments > Assign head, with same-department active employees
- Shifts > regular employee, department, organisation assignments (HR via employee scope)
- Shifts > special date-range shifts (e.g. Ramadan), with working hours and thresholds
- Organisation and department attendance table read-only status normalization: Not marked / In progress / Present / Half day / Absent. Active holidays only.
- CSV export matches the organisation attendance table.

Attendance rules:
- Clock in missing = NOT_MARKED unless explicitly ACTIVE holiday = HOLIDAY.
- Clock in exists, clock out missing = IN_PROGRESS.
- Clock out exists = worked_minutes >= required_work_minutes => PRESENT,
  >= half_day_minutes => HALF_DAY, else ABSENT.
- Existing default normal shifts are 540 minutes full and 270 minutes half day.
- Special shifts retain their own stored full/half-day minute limits.
- No historic attendance records are rewritten by this patch.

VERY IMPORTANT STAGING SAFETY
-----------------------------
Localhost can still use the LIVE database if .env.local points there.
To prevent accidental writes, this patch BLOCKS local new employee creations,
shift updates, shift plan changes, department changes through the proxy,
department head assignments, and password changes unless staging is explicitly configured.

Do NOT set the following while still pointing to live Supabase!
In a separate local staging-project .env.local, set:
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_PROJECT_REF.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=... staging project's anon key ...
  WORKMATE_STAGING_PROJECT_REF=YOUR_STAGING_PROJECT_REF
  WORKMATE_STAGING_WRITE_ENABLED=true

To test shift assignment, first deploy local file
supabase/functions/manage-shift-plans/index.ts
as the `manage-shift-plans` Edge Function on the STAGING project only.
Also deploy the original project's required existing edge functions to staging.
This patch does not deploy them automatically; new shift plan Save will
return an error if that staging Edge Function is not installed.
The regular existing manage-shift and assign-department-head functions must
also exist on staging.

Until staging is ready, you can inspect UI and attendance read-only,
but do not click existing production-connected write controls.

Correcting the ACTUAL Supabase organisation report centrally:
Current production function does not filter active holidays. Staging-only fix:
In `organisation-attendance-report` holiday lookup, add
  .eq('is_active', true)
after .eq('holiday_date', requestedDate).
Make sure any holiday fetch returns at most one ACTIVE row. Test this
Edge Function in staging before promoting it; the local web pages already
exclude inactive holidays in the read-only normalized display.

TESTS TO RUN LOCALLY ON STAGING
-------------------------------
- Mobile 0/9/10/11 characters, spaces, alphabets and pasted punctuation.
- Invalid email, valid email, email-only employee account.
- Profile change password rejects wrong current password, mismatch; sign-out on success.
- Department candidate filtering (must be active employee of same department);
  replacing existing department head updates both roles.
- Regular shifts: create/edit/deactivate, employee/department/HR assignment.
- Special shift for a single day and for a Ramadan date range; check priority.
- Single attendance punch => IN_PROGRESS; no punch => NOT_MARKED;
  full 540 => PRESENT, 270-539 => HALF_DAY, 0-269 => ABSENT.
- Inactive holiday must not show HOLIDAY; active holiday must show only for
  users without punches. CSV and filtered dashboards must agree.
- Build: npm.cmd run lint ; npm.cmd run build

This patch is based on the latest full Work Mate source ZIP uploaded in this chat.
If you have since edited any of the affected files locally, back up and compare
before overwriting. This is a changed-files-only ZIP, not a whole source tree.
