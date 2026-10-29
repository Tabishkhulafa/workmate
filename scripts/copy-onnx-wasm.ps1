$ErrorActionPreference='Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$dir = 'node_modules/onnxruntime-web/dist'
if (!(Test-Path $dir)) { throw 'onnxruntime-web not installed. Run npm.cmd install onnxruntime-web' }
New-Item -ItemType Directory -Force -Path 'public/ort' | Out-Null
$items=Get-ChildItem $dir -File | Where-Object { $_.Name -match '^ort-wasm.*\.(wasm|mjs)$' }
if (!$items) { throw 'No ORT WASM runtime found in node_modules' }
$items | Copy-Item -Destination 'public/ort' -Force
Write-Host "Copied $($items.Count) WASM/MJS assets to public/ort"
