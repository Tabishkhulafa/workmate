WORK MATE — 15 MINUTE EARLY CLOCK OUT GRACE (2026-10-26)

RULE:
- For a 540-minute shift: 525-539 minutes = PRESENT + Early Clock Out badge.
- 540+ = PRESENT without badge.
- <525 follows the existing half-day and absent thresholds.
- Other shift lengths use required_work_minutes - 15 as the grace window, never under half-day minimum.

SCOPE:
- Server Edge attendance-action and review-attendance-regularization must have the new classifier activated.
- This ZIP overlays only the 6 listed frontend/report files, preserving your existing project folder hierarchy.
- Never run any SQL to reclassify historic payroll without a reviewed request.
- Historic attendance_status values are authoritative; only future finalized punches and approved regularizations use the grace policy.
- Daily Attendance, My Attendance History, Daily Excel and Monthly Excel show Early Clock Out adjacent to Present.

WINDOWS POWERSHELL (from project root):
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_Early_ClockOut_15min_20261026.zip" -DestinationPath . -Force
  npm.cmd run lint
  npm.cmd run build

Test at 524, 525, 539, 540 minutes; test non-540 minute shifts, LATE, and approved regularization. Do not deploy if tests fail.
