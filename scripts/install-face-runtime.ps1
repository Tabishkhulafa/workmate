# Execute from the Work Mate project root: powershell -ExecutionPolicy Bypass -File .\scripts\install-face-runtime.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $root 'node_modules\@tensorflow\tfjs-tflite\dist'
$dest = Join-Path $root 'public\vendor\face-runtime'
if (!(Test-Path $source)) { throw 'Missing @tensorflow/tfjs-tflite. Run npm.cmd install first.' }
$js = Join-Path $source 'tf-tflite.min.js'
if (!(Test-Path $js)) { throw 'TFLite UMD bundle missing. Verify installed package version.' }
$tfjs = Join-Path $root 'node_modules\@tensorflow\tfjs\dist\tf.min.js'
if (!(Test-Path $tfjs)) { throw 'Full TensorFlow JS bundle missing. Run npm.cmd install @tensorflow/tfjs@4.11.0 --save-exact first.' }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item $js (Join-Path $dest 'tf-tflite.min.js') -Force
Copy-Item $tfjs (Join-Path $dest 'tf.min.js') -Force
$wasm = @(Get-ChildItem $source -Filter '*.wasm' -Recurse -File)
if ($wasm.Count -eq 0) { throw 'The installed TFLite package has no WASM binaries. Cannot fix Safari by shipping JS alone. Check installed @tensorflow/tfjs-tflite package assets.' }
foreach ($file in $wasm) { Copy-Item $file.FullName (Join-Path $dest $file.Name) -Force }
Write-Host 'Bundled model runtime and WASM assets:' -ForegroundColor Green
Get-ChildItem $dest | Select-Object Name, Length | Format-Table
Write-Host 'Next: npm.cmd run lint; npm.cmd run build; npx.cmd vercel' -ForegroundColor Cyan
