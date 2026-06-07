param(
  [switch]$SkipInstall,
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
  Write-Host "Creating virtual environment..."
  python -m venv .venv
}

$pythonExe = Join-Path $PSScriptRoot ".venv/Scripts/python.exe"

if (-not $SkipInstall) {
  Write-Host "Installing backend dependencies..."
  & $pythonExe -m pip install --upgrade pip
  & $pythonExe -m pip install -r requirements.txt
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created backend/.env from .env.example"
}

Write-Host "Starting FastAPI on port $Port..."
& $pythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port $Port
