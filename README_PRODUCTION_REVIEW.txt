WORK MATE — BACKEND PRODUCTION RELEASE REVIEW — OCT 24 2026
STATUS: NOT DEPLOYED. Project: oshehhznsrbumiguvhbf. Vercel: tabish-1954/workmate-web.

WHAT THIS PACKAGE PREPARES
1) Three additive tables: workmate_break_schedule (Fri 1–2 PM, others 1–1:45 PM),
   workmate_random_breaks (1 active per person, unlimited history) and
   workmate_break_workplace_settings (Office/Store/Warehouse enabled initially).
2) RLS and trigger protections: HR/Admin edit lunch/workplace toggles; random breaks
   only while clocked in; server timestamps; immutable completed records; scoped read.
3) Atomic weekly-off RPC. Approval can update a profile's weekly_off_day, but this
   update ONLY happens when a properly authorized reviewer approves later.
4) Three Edge Functions: manage-shift-plans (new), revised submit/review weekly off.
5) Production write gate in lib/staging-write.ts and proxy role checks.

STILL REQUIRED BEFORE ANY PRODUCTION CHANGE
- VERIFIED RECOVERABLE BACKUP and rollback procedure; SQL Editor does not create a backup.
- Review three Edge Functions and migration, then execute DB SQL using authorized Supabase workflow.
- Deploy each Edge Function (JWT verification ON); verify deployed versions.
- Add Vercel production-only WORKMATE_PRODUCTION_WRITES_ENABLED=true once endpoints pass tests.
- Rebuild/test production candidate with npm run lint and npm run build; stage Vercel
  with --skip-domain before promoting, not directly replacing live.
- Do not modify attendance-action for overnight shifts without separate testing.

RISKS TO RESOLVE
- Existing overnight shift clock-out after midnight is blocked by attendance-action.
- Current date/weekday derivation of old attendance should not be rewritten.
- Some permissions need authenticated end-to-end testing before live promotion.
- Old Edge Functions can remain live until new endpoint version is ready.

No secrets or employee private records are in this ZIP.
