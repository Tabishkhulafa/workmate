WORK MATE - EMPLOYEE DIRECTORY SEARCH (LOCAL-ONLY)

Files changed:
  app/employees/page.tsx
  app/employees/directory.module.css (new)

What changed:
- Adds a GET search field to /employees, alongside the existing Add employee / Import Excel / CSV actions.
- Filters profiles by name, employee code, email, phone (case-insensitive; partial matches).
- Filters server-side BEFORE the existing 200-result limit, rather than searching only among the first 200 records.
- Keeps existing requireAdmin() and Supabase Row Level Security; no permission changes.
- Search + Enter or click Search; Clear returns to the unfiltered directory.
- Responsive desktop/mobile layout; no global CSS changes.
- No Supabase migration, Edge Function changes, live write or Vercel deploy.

Windows PowerShell:
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Employee_Directory_Search_20261023.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npm.cmd run dev

Browser: http://localhost:3000/employees

Verification: TSX syntax checks in tool environment. A full Next.js project build must run on your own project before deployment.
