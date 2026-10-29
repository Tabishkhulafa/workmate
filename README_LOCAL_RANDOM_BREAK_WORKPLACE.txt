WORK MATE / RANDOM BREAK WORKPLACE TOGGLES (LOCAL / STAGING ONLY)
===================================================================
This patch is based on WorkMate_LOCAL_Break_Management_20261022.zip.
No production writes, deployments or updates were performed.

Files changed / added:
  lib/breaks.ts
  app/breaks/page.tsx
  app/breaks/breaks-client.tsx
  app/breaks/breaks.module.css
  app/api/breaks/route.ts
  supabase/sql/workmate_break_workplace_controls_STAGING_ONLY.sql (NEW)

Behavior:
  - HR + Super Admin can enable/disable Random Break by Office, Store, Warehouse.
  - All three start enabled by default, preserving prior behavior.
  - Disabled workplace cannot START a new break; backend and database enforce this.
  - A break already running can always END, even after disabling workplace.
  - All completed breaks and review permissions remain unchanged.
  - Clock In/Out, attendance status/hours, face/GPS, shifts and payroll unchanged.
  - Use assigned profiles.workplace_type; for legacy null, fallback to department_type.
  - Missing workplace/policy fails closed for new Break In (never bypass access).

INSTALL (PowerShell; local source, no Vercel):
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_RandomBreak_Workplace_Toggles_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build

STAGING (necessary for the feature to actually function):
  1. Use an isolated TEST Supabase project. Do NOT run the SQL against production.
  2. First install the previous workmate_breaks_STAGING_ONLY.sql script.
  3. Then apply supabase/sql/workmate_break_workplace_controls_STAGING_ONLY.sql.
  4. Set .env.local to the test project's NEXT_PUBLIC_SUPABASE_URL and anon key.
  5. Set WORKMATE_STAGING_WRITE_ENABLED=true and WORKMATE_STAGING_PROJECT_REF=<test project ref>.
  6. Restart local dev server. Use test HR/Admin and test employee accounts.

Test cases:
  A) HR/Admin Settings -> disable STORE -> Store cannot Break In.
  B) Office and Warehouse can still Break In if clocked in.
  C) Re-enable STORE -> Store can Break In again.
  D) Disable STORE while a break is active -> Break Out still works.
  E) HR/Admin-only setting modifications; Employee/HOD cannot alter flags.
  F) Historical break records and worked attendance hours unchanged.

NOTE: A successful build DOES NOT mean a staging database or test users were
created. Production is kept safe by lib/staging-write.ts. No live rollout.
