WORK MATE — LOCAL FACE SCAN SPEED PATCH (26 OCT 2026)
==================================================

Files replaced/added:
  app/mobile-attendance/punch.tsx            (modified)
  lib/mobile-attendance/fast-scan-consensus.ts (new)

Changes:
  - Warm-load unchanged MobileFaceNet and MediaPipe face detector after first paint.
  - Check enrollment, current attendance and fresh GPS in parallel on user action.
  - Finish capture after the first THREE agreeing face observations.
  - Keep collecting up to FIVE if first three are inconsistent, then fail closed.
  - Keep the SAME 0.72 capture consensus criterion, backend face matching,
    evidence upload, GPS geofence and attendance final confirmation.
  - Display per-stage scan times (no biometric/GPS content in telemetry).

NOT CHANGED:
  - No change to face matching threshold, enrollment data, ML model,
    anti-spoofing/liveness characteristics, GPS accuracy validation,
    original office geofence or DB/Edge Functions.
  - No production deployment, Supabase writes, Vercel changes or new dependencies.

INSTALL — PowerShell (copy ZIP into Downloads first):
  cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_LOCAL_Fast_FaceScan_20261026.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build
  npm.cmd run dev

TEST LOCALLY:
  - Open http://localhost:3000/mobile-attendance from a phone on HTTPS or
    an appropriate secure local testing setup (ordinary LAN HTTP may block camera).
  - Measure cold and warm scan timings on an enrolled employee account in a
    dedicated test environment; do not create test punches in production.
  - Verify denied GPS, weak GPS, multiple faces, face mismatch, early 3-frame
    agreement, 4/5-frame recovery, successful evidence saving and actual punch.
  - Existing face verification model must not change.

AUTOMATED CHECKS:
  - TypeScript strict focused type-check passed with local ambient stubs.
  - JS/TS transpilation syntax checks passed.
  - Consensus logic unit tests passed for early 3-frame match, low agreement
    retry, 4-frame recovery and five-frame rejection.
  - Full Next.js production build was NOT available inside the packaging
    environment; use the two commands above before preview deploy.

NOTE:
  Real scan times vary with phone, camera permissions, GPS and network;
  there is no guarantee of 3-6 seconds. Compare the Scan timing line to
  identify the slowest stage before further optimization.
