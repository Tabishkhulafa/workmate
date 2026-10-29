WORK MATE — ORGANISATION ATTENDANCE ON-SITE / OFF-SITE COLUMN
Date: 23 October 2026 | Local patch only

WHAT CHANGES
- Adds Location column to HR/Super Admin Employee attendance table and responsive cards.
- Shows Clock In and Clock Out site separately with On-site / Off-site badge and matched office location name.
- On-site = GPS-verified clock site ID equals employee profile's assigned work_location_id.
- Off-site = GPS-verified clock site ID differs from assigned work_location_id.
- Unassigned = an actual clock location exists but employee has no assigned work location.
- Unavailable = a punch exists but required location ID / profile is missing.
- No punch = dash. Never marks a not-yet-clocked-in employee as on-site/off-site.

IMPLEMENTATION
- Existing organisation-attendance-report response contains punch timestamps but not clock_in_location_id, clock_out_location_id or profile work_location_id.
- The server page reads the location IDs via authenticated Supabase queries scoped to the employee IDs returned by the existing authorized HR/Admin report, and reads active office location names.
- Does not modify attendance Edge Functions, database, GPS, permissions, exports, existing attendance status/late rules, or clock-in/out logic.
- The assigned work_location_id is the CURRENT assignment, not a historical snapshot. If the assignment changed in the past, viewing historical attendance compares against today's assigned site; use a historical assignment audit for an exact old-day comparison in the future.

ONLY MODIFIED/NEW FILES IN THIS ZIP
- app/attendance/page.tsx
- app/attendance/responsive-attendance-list.tsx
- app/attendance/responsive-attendance-list.module.css
- lib/attendance-location.ts (new)

LOCAL INSTALL FROM WINDOWS POWERSHELL
cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Attendance_OnSite_OffSite_20261023.zip" -DestinationPath . -Force
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
Open http://localhost:3000/attendance as HR or Super Admin.

CHECKS
1. Staff assigned Office A punches Office A -> On-site, Office A shown.
2. Staff assigned Office A punches Office B -> Off-site, Office B shown.
3. If Clock In A and Clock Out B -> separate In On-site and Out Off-site lines.
4. No attendance punch -> dash.
5. Missing assigned site -> Unassigned (do not imply off-site).
6. Missing GPS site ID -> Unavailable (do not infer using manually supplied address).
7. Mobile card layout includes Location.

VALIDATION
- TS/TSX transpiler syntax checks passed for the three TypeScript files.
- 7 JavaScript assertions passed for classification function.
- Full Next.js lint/build must still be run locally with project dependencies.
- No production writes, deployments, or schema changes performed.
