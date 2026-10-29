Work Mate - Face Matching Reliability Patch (modified files only)

Includes:
  lib/mobile-attendance/face-capture-quality.ts (new)
  app/mobile-attendance/enroll/enroll-client.tsx
  app/mobile-attendance/punch.tsx

Fixes:
- Capture one frozen camera snapshot immediately after live face detection;
  compute embedding and photo from exactly that snapshot, reducing crop drift
  as phones move while asynchronous WASM inference runs.
- Same quality and preprocessing path for initial/approved replacement enrollment
  and normal Face Clock In/Out.
- Screen for extreme low light, high exposure, blur and tiny faces.
- Collect up to 5 face frames, choose a consistent cluster, normalize a
  consensus 192D MobileFaceNet embedding. Discard outliers.
- One bounded fallback using medoid if consensus is rejected as a face mismatch.
  Backend face threshold 0.72 is not lowered.
- Refresh stale GPS and recheck the office fence if a scan takes too long.
- Attendance evidence JPEG comes from same matched sample.

No backend/DB/schema/threshold/GPS radius/role/approval changes.
No change to the ONNX model or its underlying preprocessing constants.
No blink/head turn and no liveness provider.

WARNING: This is a quality/reliability improvement, not a validated accuracy
score or anti-spoof security. Real-world acceptance tests are required.
Existing enrolled faces are not replaced. If a particular employee's stored
face template is poor, require the existing HR face-change approval and use
re-enrollment. Do not delete or overwrite a face bypassing approval.

Apply to the existing fully patched project:
  cd "C:\AFFAN_LAPTOP_BACKUP\workmate-web"
  Expand-Archive -Path "$env:USERPROFILE\Downloads\WorkMate_Face_Matching_Accuracy_Stability_Patch.zip" -DestinationPath "." -Force
  npm.cmd run lint
  npm.cmd run build
  npx.cmd vercel --archive=tgz

Manual test in Preview only:
1. Test enrolled user who previously succeeded on iPhone/Android.
2. Test same person on an Android Chrome device (selfie camera, good lighting).
3. Test a different person: must continue to reject.
4. Test extreme blur/low light: should request a clearer image.
5. Test office GPS off-site: must reject; no attendance recorded.
6. Test already clocked in/out: button disabled, no duplicate punch.
7. Test first-time / approved replacement enrollment, and recheck matching.
8. View Today's Attendance + Attendance History to confirm DB result.

Source-level transpile and synthetic consensus tests passed. Full Next.js
build and real-device accuracy are NOT verified here.
