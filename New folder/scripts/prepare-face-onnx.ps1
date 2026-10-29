$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$source = 'public/models/mobilefacenet.tflite'
if (!(Test-Path $source)) { throw "Missing $source. Copy your Android model to this location first." }
if (!(Get-Command py -ErrorAction SilentlyContinue)) { throw 'Python launcher (py) required. Install Python 3.11 first.' }
py -3.11 -m venv .face-venv
$python = Join-Path (Get-Location) '.face-venv/Scripts/python.exe'
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip bootstrap failed' }
& $python -m pip install tflite2onnx onnx onnxruntime numpy
if ($LASTEXITCODE -ne 0) { throw 'ONNX converter dependencies failed to install; stop here.' }
& $python -m tflite2onnx $source 'public/models/mobilefacenet.onnx'
if ($LASTEXITCODE -ne 0) { throw 'TFLite-to-ONNX conversion failed. No verified ONNX model.' }
& $python scripts/validate-face-onnx.py
if ($LASTEXITCODE -ne 0) { throw 'ONNX validation failed. Do not deploy.' }
Write-Host 'ONNX conversion/shape sanity checks passed. NUMERICAL Android-versus-ONNX parity is still required before face enrollment.' -ForegroundColor Yellow
