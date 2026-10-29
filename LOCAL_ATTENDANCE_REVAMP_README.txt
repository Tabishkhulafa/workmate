Work Mate — local-only Attendance Centre UI patch (22 Oct 2026)

Files to overlay:
  app/my-attendance-history/page.tsx
  app/my-attendance-history/attendance-history.module.css
  components/shell.tsx

Role access:
  Employee: My attendance
  Department Head: My attendance / Team attendance (scoped department-overview endpoint)
  HR: My attendance / Department attendance / Organisation attendance
  Super Admin: Organisation attendance

Implementation:
- Server-rendered tabs with URL filters; avoids unnecessary client-side requests.
- Clean desktop table and dedicated mobile cards (never both displayed together).
- Status cards, date filters, employee search, department selector (HR), summary and empty states.
- Attendance timestamps shown in Asia/Kolkata.
- Only reads existing attendance data; does not write to Supabase or change matching/attendance logic.
- Team attendance is retrieved via the existing role-protected Supabase Edge Functions.
- Date range summary for My attendance is based only on saved attendance records; absent records are NOT guessed.

Local apply (no Vercel deploy):
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Attendance_Centre_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npm.cmd run dev

Check:
  Employee: /my-attendance-history
  Department Head: /my-attendance-history?view=team
  HR: /my-attendance-history?view=department, then select a department
  HR: /my-attendance-history?view=organisation

No production changes.
