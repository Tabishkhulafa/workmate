WORK MATE - DAILY + MONTHLY ATTENDANCE EXCEL EXPORT
LOCAL MODIFIED-FILES-ONLY PATCH | 2026-10-23

FILES
- app/attendance/page.tsx                      Daily Excel and monthly download controls
- app/api/attendance/export/route.ts           Keeps original CSV; adds formatted daily XLSX
- app/api/attendance/monthly-export/route.ts   Read-only authorised monthly XLSX report
- lib/attendance-xlsx.ts                       Server-only OOXML workbook writer, no npm dependency
- lib/monthly-attendance-report.ts             Pure employee-day aggregation logic

APPLY (WINDOWS POWERSHELL)
cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Attendance_Excel_Daily_Monthly_20261023.zip" -DestinationPath . -Force
npm.cmd run lint
npm.cmd run build
npm.cmd run dev

LOGIN: HR or Super Admin
PAGE: http://localhost:3000/attendance

VERIFY
1. Choose report day and apply filters.
2. Click Download Daily Excel; open .xlsx in desktop Excel. Check title, filtered employees, Clock In/Out in IST, Late, and verified location comparison.
3. Click Download CSV; existing basic CSV remains unchanged. CSV itself cannot carry style, formatting, widths, or colours.
4. Choose a month and click Download Monthly Excel.
5. In monthly workbook review two sheets: Monthly Summary and Daily Breakdown. Filter, freeze heading, coloured status cells and widths are saved in XLSX.
6. Reconcile selected employees' counts with their real attendance, holiday, weekly-off and approved-leave records before production release.

MONTHLY COUNT DEFINITIONS
- Present: completed punch and full-shift worked-time threshold reached.
- Half-day: completed punch in half-day interval; separate from Present.
- Absent: explicit absence or a completed punch below half-day threshold.
- Approved leave: APPROVED leave date with no punch, not pending/rejected.
- Weekly off: date matches a recorded/approved weekly-off day and has no punch/leave/holiday.
- Holiday: active holiday without punch/approved leave.
- Not marked: no recorded punch and no verified attendance exception. Kept separate rather than guessed as absent.
- Pending punch: incomplete clock-in/clock-out; not falsely treated as Present or Absent.
- For current month, dates after today (India Standard Time) are NOT counted.
- For employees with Date of Joining, days before joining are excluded.
- Employee's historical weekly-off assignment cannot always be reconstructed from current profile: see report note. An approved change takes effect from India-local review date; earlier unverified days remain not marked.
- HR may not be authorised to read leave requests from OTHER HR peers; export flags the RLS limitation in sheet notes. Super Admin has fuller authorised access.

AUTH / SAFETY
- Existing requireAdmin() enforces HR/Super Admin access.
- Supabase user-session RLS is respected; no service-role keys.
- No writes, no migrations, no changes to live attendance / clock-in/out / face / GPS.
- Monthly report paginates to avoid 1000-row silent truncation; refuses oversized/partial datasets.
- The OOXML writer uses strings rather than formulas for text (safer for spreadsheet injection).
- No new npm packages. No Vercel deploy.

IMPLEMENTATION VALIDATION
- All modified TypeScript/TSX files transpile without syntax errors.
- Monthly tests: present, absent, half-day, leave, holiday, weekly off, pending leave, effective approval date, date of joining, future-day exclusion.
- Generated Excel sample passes ZIP integrity, XML parsing and artifact_tool XLSX import/render validation.
- Full local Next.js lint/build and authenticated real-report integration remain to be verified on user's laptop.
