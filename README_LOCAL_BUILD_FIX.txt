WORK MATE - LOCAL BUILD HOTFIX (22 OCT 2026)
=========================================
Changes are local only. Nothing is deployed.

1. app/api/attendance/export/route.ts
   Adds missing normalizeAttendanceRow import from lib/attendance-rules.ts
   so export will apply the already-implemented active-holiday and
   attendance clock-in/out status normalization.

2. tsconfig.json
   Excludes the backup folder "New folder/**/*" from the TypeScript
   program so stale duplicate Next.js pages are not compiled twice.
   Leaves all prior Next.js compiler options and exclusions intact.

BEFORE APPLYING
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Copy-Item .\tsconfig.json .\tsconfig.json.before-compile-fix.bak -Force
  Copy-Item .\app\api\attendance\export\route.ts .\app\api\attendance\export\route.ts.before-compile-fix.bak -Force

APPLY
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Build_Compile_Fix_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build

NOTE
  If other local changes to tsconfig.json exist, do not overwrite:
  add "New folder/**/*" to the `exclude` array by hand and add the import.

  This hotfix fixes the two TypeScript errors reported, not a claim that
  every module or the full app is functionally tested.

  Do NOT run Vercel deploy; live app remains untouched. Also do not test
  create/update/delete APIs against production Supabase from localhost.
