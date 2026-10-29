WORK MATE | ATTENDANCE LOCATION + 12 PM CLOCK IN ALERT | 2026-10-26

FILES: ONLY relevant changes (4 TypeScript files + 1 new TS helper included among them + 1 SQL).

CHANGES
1) Attendance: remove visible Download CSV button; keep Download Daily Excel and Download Monthly Excel.
   Legacy CSV API remains for backwards compatibility, with the same location filter when accessed.
2) Location selector: defaults to existing ACTIVE site "Sitafalwadi Office"; "All locations" and other
   active site choices available. Uses profile.work_location_id, NOT punch GPS site. Keeps the
   selected location across attendance summary/filter links and both Excel downloads.
   Staff without an assigned location appear only under "All locations".
3) Monthly Excel's existing half-day count is labelled "Half Day (days)" explicitly; remains
   separate from Present, Absent and Leave. No new calculations were invented.
4) 12:05 PM IST alert SQL: for active EMPLOYEE/DEPARTMENT_HEAD/HR who have not recorded Clock In by 12:00 PM IST,
   generates one notification per missing person for every active HR/SUPER_ADMIN except themselves.
   Skips approved leave, organisation holiday, assigned weekly off, users not yet joined, and
   later-starting shifts. Idempotent per recipient/employee/day; no attendance status changes.

IMPORTANT DEPENDENCY
The prior WorkMate_Approval_Notifications_20261026.zip has NOT yet been activated in the live
Supabase database. "workmate_notifications" currently does not exist (checked 2026-10-26).
DO NOT run 03_WORKMATE_NOON_CLOCKIN_ALERT.sql until:
 - the prior 01_WORKMATE_NOTIFICATION_INBOX.sql migration is reviewed/applied;
 - the notification-center + /api/notifications routes are deployed and tested;
 - the dashboard inbox works and push devices are properly subscribed.
Mobile background delivery additionally needs VAPID keys, secure dispatcher, pg_net cron + secret
as described in prior Notifications README. Dashboard alerts work only when the app is open.

LOCAL INSTALL (PowerShell)
 cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
 Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_Attendance_Location_Noon_20261026.zip" -DestinationPath . -Force
 npm.cmd run lint
 npm.cmd run build

NO production deployment or database change is performed by this ZIP.
IMPORTANT: This patch is based on the latest downloadable attendance Excel repair/local attendance
source; compare customized files before overlay. Use backup of each target first.
