# Read-only Work Mate release preflight (Windows PowerShell 5.1 and PowerShell 7).
# Does NOT write to Supabase, deploy to Vercel or enable production writes.
$ErrorActionPreference = 'Stop'
$scriptRoot = $PSScriptRoot
$projectRoot = Split-Path -Parent $scriptRoot
$passed = $true

Push-Location -LiteralPath $projectRoot
try {
  Write-Host 'WORK MATE - RELEASE PREFLIGHT' -ForegroundColor Cyan
  Write-Host ('Folder: ' + (Get-Location).Path)

  $required = @(
    'package.json', 'package-lock.json',
    'scripts/workmate-preflight-dependencies.cjs', 'lib/staging-write.ts',
    'app/attendance/page.tsx', 'app/api/attendance/monthly-export/route.ts',
    'lib/attendance-xlsx.ts', 'app/breaks/page.tsx',
    'app/review-weekly-off/page.tsx', 'app/shifts/page.tsx',
    'supabase/sql/workmate_breaks_STAGING_ONLY.sql',
    'supabase/sql/workmate_break_workplace_controls_STAGING_ONLY.sql',
    'supabase/functions/manage-shift-plans/index.ts'
  )
  $missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) })
  if ($missing.Count -gt 0) {
    Write-Warning ('Missing release files: ' + ($missing -join ', '))
    $passed = $false
  } else {
    Write-Host 'Required files: PRESENT' -ForegroundColor Green
  }

  $node = Get-Command 'node' -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Warning 'Node.js not available in PATH. Cannot verify npm dependencies.'
    $passed = $false
  } elseif (Test-Path -LiteralPath 'scripts/workmate-preflight-dependencies.cjs') {
    Write-Host 'Dependency check (Node.js JSON parser):' -ForegroundColor Cyan
    & node '.\scripts\workmate-preflight-dependencies.cjs'
    if ($LASTEXITCODE -ne 0) { $passed = $false }
  }

  if (Test-Path -LiteralPath '.env.local') {
    # Inspect target REF only; do not display environment variable values.
    $envFile = Get-Content -Raw -LiteralPath '.env.local'
    if ($envFile -match 'NEXT_PUBLIC_SUPABASE_URL\s*=\s*["\x27]?https://oshehhznsrbumiguvhbf\.supabase\.co') {
      Write-Host 'Local Supabase target: LIVE PRODUCTION (do not test writes here)' -ForegroundColor Yellow
    } else {
      Write-Warning 'Local Supabase target is NOT the confirmed Work Mate production ref. Verify manually.'
    }
  } else {
    Write-Warning 'Local .env.local is missing.'
  }

  if (Get-Command 'git' -ErrorAction SilentlyContinue) {
    Write-Host 'Git status:' -ForegroundColor Cyan
    & git status --short --branch
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Git status could not be read.'; $passed = $false }
    # Avoid printing remote URLs: they may contain credentials.
    Write-Host 'Git remote names (URLs hidden):' -ForegroundColor Cyan
    & git remote
  } else {
    Write-Warning 'Git not found in PATH.'
  }

  if (Get-Command 'vercel' -ErrorAction SilentlyContinue) {
    Write-Host 'Vercel CLI account:' -ForegroundColor Cyan
    & vercel whoami
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Vercel account is not authenticated.'; $passed = $false }
  } else {
    Write-Warning 'Vercel CLI is not available; deployment target cannot be verified by this script.'
    $passed = $false
  }

  if (Test-Path -LiteralPath '.vercel/project.json' -PathType Leaf) {
    $vercelProject = Get-Content -Raw -LiteralPath '.vercel/project.json' | ConvertFrom-Json
    Write-Host ('Linked Vercel Project ID: ' + $vercelProject.projectId)
    Write-Host ('Linked Vercel Org ID: ' + $vercelProject.orgId)
    Write-Host 'Verify this is the Work Mate production Vercel project before deployment.' -ForegroundColor Yellow
  } else {
    Write-Warning 'Work Mate Vercel project is not linked locally (.vercel/project.json missing).'
    $passed = $false
  }

  if ($passed) {
    Write-Host 'PREFLIGHT CHECKS PASS (does NOT authorize or perform deployment).' -ForegroundColor Green
  } else {
    Write-Warning 'PREFLIGHT HAS BLOCKERS. Do not deploy until they are resolved.'
  }
} catch {
  Write-Error ('PREFLIGHT ERROR: ' + $_.Exception.Message)
  $passed = $false
} finally {
  Pop-Location
}

if (-not $passed) { exit 1 }
exit 0
