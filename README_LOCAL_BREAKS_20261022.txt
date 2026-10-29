WORK MATE — Scheduled Lunch + Random Breaks
LOCAL PATCH / 22 OCT 2026

WHAT IS IN THIS ZIP
- /breaks dashboard for Employee, Department Head, HR, Super Admin
- Scheduled lunch display (default Monday-Thursday, Saturday-Sunday 1:00 PM-1:45 PM;
  Friday 1:00 PM-2:00 PM, IST)
- HR / Super Admin day-by-day lunch schedule editor
- Random Break In / Break Out for Employee, Department Head, HR
- One ongoing break per person; unlimited completed random breaks in a day
- Individual history rows, live timer and total duration (server timestamps)
- Department Head: own random breaks + own department employees' breaks
- HR: own random breaks + employee & department head break records
- Super Admin: review all random breaks, edit lunch schedule
- Server-enforced scope via PostgreSQL Row-Level Security (RLS)
- NO modifications to existing attendance, worked_minutes, shifts, salary or punch API.

ONLY FILES CHANGED / ADDED
 app/breaks/page.tsx
 app/breaks/breaks-client.tsx
 app/breaks/breaks.module.css
 app/api/breaks/route.ts
 lib/breaks.ts
 components/shell.tsx
 app/dashboard/page.tsx
 supabase/sql/workmate_breaks_STAGING_ONLY.sql
 README_LOCAL_BREAKS_20261022.txt

LOCAL INSTALL (PowerShell)
 cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
 Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Break_Management_20261022.zip" -DestinationPath . -Force
 npm.cmd run lint
 npm.cmd run build
 npm.cmd run dev
 Open: http://localhost:3000/breaks

CRITICAL: KEEP PRODUCTION WORKING
 1) Do not deploy to Vercel.
 2) Do not execute the included SQL in the live office-attendance Supabase
    project (oshehhznsrbumiguvhbf).
 3) Do not point local write tests at production.
 4) The code respects the existing stagingWriteError() guard. Reads are possible,
    but writes are blocked unless a separate staging Supabase project is configured.
 5) A fresh empty Supabase project is NOT sufficient: the staging DB needs the
    existing Work Mate profiles, attendance tables, roles and RLS foundations.
    Clone schema/configuration and create synthetic test employees and test punches.

STAGING DATABASE SETUP (only when staging schema is ready)
 - Open the SQL editor for your SEPARATE STAGING project.
 - Review and execute: supabase/sql/workmate_breaks_STAGING_ONLY.sql
 - Verify 7 schedule rows, one Friday ending 14:00, and both new tables have RLS.
 - Set local .env.local to use ONLY the staging Supabase project:
     NEXT_PUBLIC_SUPABASE_URL=https://<STAGING_REF>.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=<STAGING_ANON_OR_PUBLISHABLE_KEY>
     WORKMATE_STAGING_PROJECT_REF=<STAGING_REF>
     WORKMATE_STAGING_WRITE_ENABLED=true
 - Do not paste Supabase service-role keys into NEXT_PUBLIC_ variables.
 - Restart npm.cmd run dev after editing environment variables.
 - The protected API allows writes ONLY when the staging guard passes.

ACCEPTANCE TESTS — on dummy staging users / attendance ONLY
 01 Employee with no Clock In: Break In blocked; does not create a record.
 02 Clocked-in Employee: Break In starts server-authoritative timer.
 03 Same user attempts a second Break In: blocked (one active constraint).
 04 Break Out closes session and creates a completed history row.
 05 Break In / Out again: a separate new history row (not overwrite).
 06 Check 2, 5, 60-minute duration displays and running second-by-second timer.
 07 Clock-out attendance afterward: original worked minutes/status unchanged.
 08 Employee cannot see another employee's history.
 09 Department Head can see only EMPLOYEE records of own department.
 10 HR sees employees/department heads, NOT other HR staff's breaks.
 11 Super Admin sees all staff break records (including HR).
 12 HR/Super Admin can edit daily lunch schedule; other roles cannot.
 13 Friday seeded lunch end = 2 PM, other days = 1:45 PM.
 14 Revoked/inactive account cannot open a new break; completed rows immutable.
 15 Refresh mid-break: active session resumes with accurate elapsed timer.
 16 Open browser on narrow mobile screen: scroll/card layout without overlapping.

SPECIAL DESIGN DECISION
The scheduled lunch window and random breaks DO NOT automatically deduct
attendance worked minutes. That would change production payroll/status rules and
could double-deduct time. Any such attendance-policy change needs a separate
explicit requirement, controlled migration and testing.

VERIFICATION PERFORMED IN THIS ENVIRONMENT
- New / changed TS/TSX transpilation syntax checks passed.
- IST date, weekday and elapsed-time helper tests passed.
- Full Next.js npm build could not run here because npm dependency installation
  failed in the provided runtime. Run both lint and build on your Windows PC.
- Database migration was NOT executed anywhere. RLS/trigger integration testing
  remains pending on the separate staging project.
