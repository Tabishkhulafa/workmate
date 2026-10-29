WORK MATE — APPROVAL NOTIFICATIONS — LOCAL-ONLY PATCH — 2026-10-26
====================================================================
DO NOT COPY THE SQL FILE INTO POWERSHELL. DO NOT RUN IT TWICE TO GUESS ERRORS.
DO NOT DEPLOY UNTIL local lint/build and a reviewed production migration pass.

PURPOSE
- Role-scoped dashboard bell, unread count, request notification popups, inbox.
- Submit/approval/rejection events for Leave, Face Change, Attendance Regularization.
- Password Reset: pending request to HR + Super Admin, code-ready/completed/dismissed to request owner; NO reset code in notification.
- Employee -> same-department active Department Head + all active HR + all active Super Admin.
- Department Head -> HR + Super Admin. HR -> Super Admin.
- Only ONE authorized reviewer needs to approve; others' pending alerts auto-close on resolution.
- Mobile Web Push opt-in button, service worker, device subscriptions and push dispatcher.
- The current password reset review endpoint allows HR/Super Admin only. This package does NOT give HOD password-reset powers.

FILE CHANGES
- components/shell.tsx                (based on latest reminder-enabled shell; notification bell and Head face link)
- components/notification-center.tsx (NEW)
- app/api/notifications/route.ts (NEW)
- app/api/notifications/subscriptions/route.ts (NEW)
- app/api/notifications/dispatch/route.ts (NEW)
- app/api/notifications/test/route.ts (NEW)
- public/workmate-sw.js               (UPDATED push and notification click, does not cache any content)
- supabase/sql/01_WORKMATE_NOTIFICATION_INBOX.sql (additive migration; NOT executed)
- supabase/sql/02_PUSH_CRON_AFTER_SECRETS_TEMPLATE.sql (manual activation ONLY)
- No original employee or attendance history is changed by this patch.

STEP 1 — REVIEW/APPLY CODE LOCALLY
cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
$zip = "$env:USERPROFILE\Downloads\WorkMate_Approval_Notifications_20261026.zip"
# Extract the ZIP to a temporary review directory and compare your customized shell.tsx first.
Expand-Archive -LiteralPath $zip -DestinationPath "$env:USERPROFILE\Downloads\WM-Notifications-Review" -Force
# ONLY after checking the files against the current local source:
Copy-Item -Path "$env:USERPROFILE\Downloads\WM-Notifications-Review\*" -Destination . -Recurse -Force

STEP 2 — ADD REQUIRED npm DEPENDENCY (updates your existing package files, preserves ExcelJS etc)
npm.cmd install --save-exact web-push@3.6.7
npm.cmd install --save-dev --save-exact @types/web-push@3.6.4
npm.cmd run lint
npm.cmd run build

STEP 3 — APPLY THE REVIEWED SQL BACKEND MIGRATION
The migration is not applied yet. Back up production before schema rollout and use the project's
Supabase SQL Editor. One transaction; creates tables/triggers/policies, does not replay historical requests.
On successful SQL, verify 4 triggers, active RLS, and authenticated grants. Do not create test employee
records in production. Real request flow testing should use authorized sandbox/test accounts.

STEP 4 — PUBLISH DASHBOARD INBOX FIRST, WITHOUT PHONE PUSH
Local build + SQL verified -> deploy new production-configured Vercel staged release (--skip-domain)
-> test authorized HR/Head/Employee accounts -> promote only after correct routing verified.
The inbox works without push keys. The push enable button will say not configured.

STEP 5 — ENABLE BACKGROUND WEB PUSH (requires secure configuration)
Generate VAPID keys with: npx.cmd web-push generate-vapid-keys
Set the following Vercel Production variables through the Vercel dashboard or CLI:
  NEXT_PUBLIC_WORKMATE_VAPID_PUBLIC_KEY = generated public key (safe public value)
  WORKMATE_VAPID_PRIVATE_KEY = generated private key (SECRET)
  WORKMATE_VAPID_SUBJECT = mailto:<your-admin-email> (no fake address)
  SUPABASE_SERVICE_ROLE_KEY = live Supabase service role key (SECRET, server-only)
  WORKMATE_PUSH_DISPATCH_SECRET = random 32+ byte secret (SECRET)
Rebuild/redeploy after setting VAPID public key: Next.js embeds NEXT_PUBLIC_ vars at build.
On Supabase Dashboard: enable pg_net extension and save WORKMATE_PUSH_DISPATCH_SECRET
in Supabase Vault as 'workmate_push_dispatch_secret'.
Test authenticated mobile subscribe, /api/notifications/test and dispatcher endpoint (secret Bearer),
then review/replace the HTTPS domain placeholder in optional SQL cron template and run it.
Cron every minute calls secured dispatcher; Vercel Hobby built-in cron does not support per-minute.
Never share keys in chat/screenshots or paste secrets into Git/SQL source files.

MOBILE
Android Chrome: open HTTPS site, sign in, bell -> Enable phone push -> Allow -> Send test push.
iOS/iPadOS 16.4+: Add Work Mate HTTPS site to Home Screen, open installed app,
then bell -> Enable phone push -> Allow -> Send test push. Safari tab alone will not suffice.
Foreground popup/bell works after inbox deployment without Push configuration.

SECURITY/OPERATIONS
- HTTPS browser origins only.
- Notification body never includes password-reset code, raw face data, or medical information.
- RLS restricts notifications to own user ID, and subscriptions to own device/user.
- Dispatch route requires strict secret and Vercel SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC).
- Request status changes generate events by DB trigger; existing Edge authorization unchanged.
- Integration/real-device notification delivery and full Next.js build have NOT been verified here.
- Rollback of code alone does not remove additive database objects; back up before migration.
