WORK MATE — WEB PERFORMANCE PATCH (2026-10-21)

Base: New folder(2).zip, with WorkMate_HR_Face_ClockIn_Fix.zip and
WorkMate_HR_Temporary_Button_Fix.zip applied in that order.

Install this patch LAST, after those two functional patches.
No database migration; no Supabase Edge Function deployment.

WHAT CHANGED
1. Avoid duplicate auth refresh for API routes and bypass auth middleware on public
   /models, /ort, /vendor and Next static assets. Protected pages and API handlers
   still validate Supabase sessions. API handlers can refresh cookies themselves.
2. Public model/WASM assets get one-hour HTTP caching with revalidation;
   the face model loader no longer explicitly disables browser caching.
3. Clock-in/clock-out quick enrollment check skips fetching the unrelated face
   replacement approval history; enrollment management still loads it normally.
4. Face enrollment and today's attendance checks run concurrently at punch time.
5. Employee directory and temporary-permission employee/department queries run
   in parallel while preserving their role restrictions.
6. Route-specific attendance camera CSS, not loaded into all pages.
7. Sidebar uses targeted hover/focus prefetch instead of eager prefetch for all
   role menu links; dashboard cards do not eagerly prefetch all destinations.
8. Added minimal app-wide navigation loading feedback.

NOT CHANGED
- Biometric threshold, model preprocessing, frame agreement threshold,
  GPS boundary checks, liveness, server verification, or attendance actions.
- HR, Department Head, Super Admin permissions and face-change approvals.
- Database, edge functions, employee records, or authentication credentials.
- No confidential API/page output is publicly cached.

INSTALL IN WINDOWS POWERSHELL
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_Web_Performance_Patch.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npx.cmd vercel --prod

Important: keep your own .env.local and other secrets untouched. If your actual
project has a custom next.config.ts not included in your uploaded source ZIP,
merge the headers() section instead of overwriting custom configuration.

VERIFY AFTER DEPLOYMENT
- Login/email/mobile and role-based navigation
- HR: Face change approvals and temporary button attendance
- Employee: attendance screen, enrollment status, face clock in/out, history
- DevTools Network: GET /models/mobilefacenet.onnx and /ort/* must be public
  assets; verify browser Cache-Control response header.
- DevTools Network: /api/* responses remain no-store/privately authorized.
- Compare cold and repeat navigation (browser cache must be enabled).

VALIDATION IN THIS ENVIRONMENT
- 13 changed TS/TSX files parsed successfully using TypeScript AST.
- 12 middleware route-match checks passed.
- npm dependency installation timed out in the environment, so full Next.js
  build, end-to-end browser testing and production load benchmarking have NOT
  been performed. Run npm.cmd run lint/build before deploying.
