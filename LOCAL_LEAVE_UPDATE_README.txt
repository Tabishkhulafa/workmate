Work Mate — Leave UI and Monthly Paid Leave local patch (22 October 2026)

CHANGED FILES ONLY. Overlay into C:\AFFAN_LAPTOP_BACKUP\workmate-web.
No Vercel deployment, SQL migration, Edge Function deployment, or live database modification.

What changed:
- My leaves redesigned with allowance / used / pending / decisions, better form, search,
  status tabs, rejected/approved history, notes and a Refresh status control.
- After a successful application, the newly returned leave row appears immediately;
  Next.js server data is revalidated in the background through router.refresh().
- Paid leave is one single day per request. Multi-day PAID applications are blocked
  in the web form with instructions to submit one paid day separately and additional
  days as UNPAID. This avoids the current server behavior converting the ENTIRE
  multi-day request to unpaid.
- The web form auto-sends a one-day PAID selection as UNPAID when the month has
  approved paid days already or another pending PAID request. Supabase remains
  the authority for final leave type, overlap, eligibility and review decisions.
- Leave approvals includes Pending / Reviewed / All, employee and department info,
  date, reason, accurate final type, review notes, and review history.
- Approval queue is further filtered to the reviewer role/dept rules already
  enforced server-side; RLS is retained on all reads.
- The active live policy (read-only verified) was one paid day/month.

LOCAL STEPS:
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Leave_UI_Policy_20261022.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npm.cmd run dev

IMPORTANT:
- No staging project has been created or configured by this patch.
- If localhost points to live Supabase, submitting/reviewing leave WILL affect live
  users. To test workflows, configure a separate test project first.
- Browser and production build were not validated in the user's exact project.
- The existing apply-leave and review-leave Edge Functions are NOT modified.
  Those backend functions already enforce the one paid day/month review rule.
- Supabase stores one leave_type for a request range: for multi-day paid+unpaid,
  submit separate single-day paid and multi-day unpaid applications.

LOCAL SAFETY: This patch additionally protects apply-leave and review-leave
API proxy calls with stagingWriteError(). In default localhost configuration,
buttons are disabled and server rejects writes. This is intentional.
