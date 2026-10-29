WORK MATE — OFF-SITE CLOCK IN (LOCAL UI PATCH)

Patch scope (modified files only)
  app/my-attendance-history/page.tsx
  app/my-attendance-history/attendance-history.module.css

What it does
  • Keeps the current GPS check: a punch at ANY approved active office/store/warehouse site is allowed.
  • Shows the actual clock-in location name beneath Clock In time in attendance history.
  • Shows an amber 'Off-site Clock In' badge only when the saved clock_in_location_id differs from the employee's CURRENT profile work_location_id.
  • Available in personal history and existing Department Head / HR / Super Admin history tabs.
  • No database schema, Edge Function, settings, geofence, shift or attendance status changes.
  • No write operations added to attendance history.

Important historical limitation
  The current user profile stores the current assigned location, not a location-assignment timeline.
  Older punches may be marked off-site after a staff member's assigned location changes.
  Existing punches that have no clock_in_location_id are not guessed or marked off-site.
  Inactive/deleted locations cannot be displayed by name through the normal location lookup.

Local apply (PowerShell)
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Offsite_ClockIn_History_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npm.cmd run dev

Test (read-only):
  Login with an employee who clocked in at another approved location.
  Open http://localhost:3000/my-attendance-history and select the punch date.
  Verify location name and 'Off-site Clock In' badge show under Clock In.
  Check an in-site punch has the location name but no badge.
  Check no-location punches still render normally, with no fabricated off-site badge.
  For HR / Department Head use the existing team/organisation tabs.

No Vercel deployment or production Supabase changes performed.
TypeScript/TSX syntax validated; full Next.js lint/build needs running on the user's local project.
