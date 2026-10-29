WORK MATE - PRODUCTION RELEASE GATE - 24 OCT 2026

Scope: This ZIP contains ONLY a production-aware release guard and a read-only
Windows PowerShell preflight script. It DOES NOT deploy Vercel, run migrations,
change any employee data, or turn on production writes.

Confirmed production Supabase: office-attendance (oshehhznsrbumiguvhbf), ap-south-1, healthy.
Confirmed blocker: connected Vercel account has no Work Mate project.
Confirmed backend gaps: workmate_break_schedule, workmate_random_breaks,
workmate_break_workplace_settings are absent; manage-shift-plans Edge Function
is absent. Weekly-off Edge Functions still use older department-based rules.

Production writes remain OFF by default even after applying this patch.
They are permitted only when ALL of these hold:
- Backend Supabase URL is exactly https://oshehhznsrbumiguvhbf.supabase.co
- VERCEL_ENV is 'production' (Vercel-owned environment)
- Server-only WORKMATE_PRODUCTION_WRITES_ENABLED is exactly 'true'
Existing auth, role checks, RLS and Edge Functions are still required.
Do not set this flag or push to production until the full release is verified.

Local PowerShell commands:
cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_Production_Release_Preflight_20261024.zip" -DestinationPath . -Force
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\workmate-release-preflight.ps1
npm.cmd run lint
npm.cmd run build

Deployment sequence when Vercel account/project are connected and checks pass:
1. Back up production schema / Edge Functions and record current Vercel deployment.
2. Stage and test break SQL and shift + weekly-off functions against isolated staging.
3. Run a reviewed, additive production migration; verify table RLS and grants.
4. Deploy reviewed Edge Functions to production; verify role-scoped behavior.
5. Deploy frontend to an isolated Vercel preview and verify auth/read-only flows.
6. Stage production Vercel build (skip-domain), test, then promote and enable
   WORKMATE_PRODUCTION_WRITES_ENABLED only after all checks pass.
7. Test real login and read-only reports first, then permitted actions with an
   authorized internal test identity; monitor errors and keep rollback ready.

KNOWN UNRESOLVED: midnight-crossing shifts are not safely supported by the
existing attendance-action Edge Function (past-day Clock Out rejected). Do not
market overnight attendance as working without a separately tested fix.

This package is PREPARATION, not a production deployment.
