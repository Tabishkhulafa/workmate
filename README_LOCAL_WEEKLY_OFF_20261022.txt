WORK MATE — LOCAL WEEKLY-OFF UPDATE (22 OCT 2026)
================================================
IMPORTANT: LOCAL PATCH ONLY. DO NOT deploy Vercel, execute SQL against production,
or overwrite the active Supabase Edge Functions. Real attendance must continue normally.

WHAT THIS PATCH ADDS
- /weekly-off: employee's assigned day; store/warehouse request Monday, Tuesday,
  Wednesday or Thursday; own Pending/Approved/Rejected request history and notes.
- /review-weekly-off: Department Head, HR or Super Admin sees only requests they
  are authorised to review, including reviewed request history.
- /my-attendance-history: approved weekly-off days displayed, including personal
  days with no attendance record. Pending requests do not become weekly offs.
- Office staff retain Sunday. Store/warehouse approval is effective from the
  approval date in Asia/Kolkata, not retroactively against prior attendance.
- No changes to clock-in/out, GPS, face recognition, shifts, payroll, or worked hours.

AUTHORIZATION
- Employee: submits own request; cannot approve.
- Department Head: submits own request and reviews employees in own department.
- HR: reviews employees and department heads; cannot approve own or other HR.
- Super Admin: reviews all including HR (but cannot approve own request).
- ONLY workplace STORE/WAREHOUSE can request; fallback to department type for
  legacy users with no workplace_type. Only MON-THU accepted.

WHAT WAS WRONG
The prior /weekly-off page was view-only; proxy didn't allow weekly-off actions.
Existing Edge Functions checked department_type instead of workplace_type.
Many active STORE/WAREHOUSE accounts still have the legacy Sunday assignment.
The old personal attendance history only showed saved punch rows, so approved
weekly-off days without punches never appeared. The patch does NOT bulk-change
these existing profile records.

WINDOWS LOCAL INSTALL
1. cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
2. Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_WeeklyOff_20261022.zip" -DestinationPath . -Force
3. npm.cmd run lint
4. npm.cmd run build
5. npm.cmd run dev
6. Open http://localhost:3000/weekly-off and /review-weekly-off
7. Check /my-attendance-history on an approved weekly-off day.

STAGING-ONLY BACKEND SETUP (NO PRODUCTION CHANGES)
The two local files under supabase/functions are staging-only replacements for
submit-weekly-off-request and review-weekly-off-request. The latter calls
workmate_review_weekly_off_atomic, which MUST first be installed via the
included SQL in a separate staging DB. That routine is transaction-atomic and
only callable by service_role, after the Edge Function verifies user roles.

Your staging project must already have the Work Mate schema and dummy test
accounts. A blank Supabase project is insufficient. Then:
A. Run supabase/sql/STAGING_ONLY_weekly_off_atomic_review.sql in STAGING SQL Editor.
B. Deploy the two functions to the STAGING project ONLY, using Supabase CLI.
C. Configure .env.local to STAGING URL and public anon key (not service_role).
D. Configure WORKMATE_STAGING_WRITE_ENABLED=true and
   WORKMATE_STAGING_PROJECT_REF=<STAGING_REF> in .env.local.
E. Restart local dev server. Only after this should test writes be enabled.

If .env.local still targets production, the /api/proxy staging safety guard
returns 409 and Submit/Approve/Reject controls remain disabled. This is
intentional. NEVER remove or bypass that guard to test with real employee data.

TEST MATRIX
1. Office employee sees Sunday; request form unavailable.
2. Store/Warehouse employee requests Tuesday => Pending, no weekly off yet.
3. Employee cannot send second pending request.
4. Dept Head only sees own department's employee requests.
5. HR sees employee + Department Head requests but not HR requests.
6. Super Admin can review HR requests.
7. Rejection keeps weekly-off day unchanged; rejection note visible.
8. Approve Tuesday => weekly_off_day=TUESDAY and employee history displays
   weekly off on Tuesday if no punch, starting from approval date.
9. Reassign by approving Thursday later => old Tuesday historical dates before
   that second approval remain Tuesday; new dates follow Thursday.
10. Clock-in record always takes precedence over weekly-off label.
11. Employees outside Store/Warehouse cannot submit even via API.
12. All tests remain on staging; no production data changed.

VALIDATION NOTES
- Nine changed TypeScript/TSX files passed transpilation/syntax checks.
- Ten weekday/effective-date/history-rule cases passed.
- A full Next.js typecheck/build must still be run in the Windows project.
- Staging Edge Function invocation/SQL migration not executed yet.

CHANGED/NEW FILES ONLY — ORIGINAL HIERARCHY PRESERVED
app/weekly-off/page.tsx
app/weekly-off/weekly-off-client.tsx
app/weekly-off/weekly-off.module.css
app/review-weekly-off/page.tsx
app/review-weekly-off/review-client.tsx
app/review-weekly-off/review.module.css
app/my-attendance-history/page.tsx
app/api/proxy/[endpoint]/route.ts
lib/weekly-off-policy.ts
supabase/functions/submit-weekly-off-request/index.ts
supabase/functions/review-weekly-off-request/index.ts
supabase/sql/STAGING_ONLY_weekly_off_atomic_review.sql
