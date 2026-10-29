Work Mate — Change Password UI Fix (Local only)

Modified code: app/my-profile/password-change-client.tsx
New scoped stylesheet: app/my-profile/password-change.module.css

Fix:
- Show passwords checkbox no longer grows to full-width because of global input CSS.
- Improved field spacing, responsive layout, readable safety message, and action layout.
- No changes to validation, Supabase authentication, sign-out, route, database, or staging-write lock.

Install (PowerShell):
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Password_UI_Fix_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build

Then open http://localhost:3000/my-profile

Note: This does NOT enable password changes on a production-connected local environment. No live deployment.
