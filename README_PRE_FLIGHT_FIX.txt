Work Mate release preflight fix - 24 October 2026

ONLY 2 source files changed/added:
scripts/workmate-release-preflight.ps1 (replacement)
scripts/workmate-preflight-dependencies.cjs (new)

Reason:
Windows PowerShell 5.1 ConvertFrom-Json can throw an InvalidArgument
for npm's package-lock.json, which contains an empty-string packages key.
The new checker uses Node.js JSON.parse and never prints credentials.
It validates package.json versus package-lock.json without writing anything.

Apply ZIP:
cd C:\AFFAN_LAPTOP_BACKUP\workmate-web
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\WorkMate_Preflight_PS_JSON_Fix_20261024.zip" -DestinationPath . -Force

Run this command ON ITS OWN:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\workmate-release-preflight.ps1

Then separately run:
npm.cmd run lint
npm.cmd run build

If ExcelJS MISSING, run:
npm.cmd install exceljs@4.4.0 --save-exact
Then rerun preflight/lint/build.

Vercel and Supabase are NOT changed. No production migrations or deploys.
A preflight PASS is not an approval to deploy: check the actual Vercel
project, dependencies, backups, database migrations and backend functions.
