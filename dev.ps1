#!/usr/bin/env pwsh
# VoxBox Dev Launcher — starts both frontend and backend

Write-Host ""
Write-Host "  ██╗   ██╗ ██████╗ ██╗  ██╗██████╗  ██████╗ ██╗  ██╗" -ForegroundColor Magenta
Write-Host "  ██║   ██║██╔═══██╗╚██╗██╔╝██╔══██╗██╔═══██╗╚██╗██╔╝" -ForegroundColor Magenta
Write-Host "  ██║   ██║██║   ██║ ╚███╔╝ ██████╔╝██║   ██║ ╚███╔╝ " -ForegroundColor Cyan
Write-Host "  ╚██╗ ██╔╝██║   ██║ ██╔██╗ ██╔══██╗██║   ██║ ██╔██╗ " -ForegroundColor Cyan
Write-Host "   ╚████╔╝ ╚██████╔╝██╔╝ ██╗██████╔╝╚██████╔╝██╔╝ ██╗" -ForegroundColor Blue
Write-Host "    ╚═══╝   ╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝" -ForegroundColor Blue
Write-Host ""
Write-Host "  AI Vocal Chain Matching" -ForegroundColor DarkGray
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "backend"

# ── Start Python Backend ──────────────────────────────────────────────────────
Write-Host "▶  Starting Python backend (FastAPI)..." -ForegroundColor Yellow
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "   ⚠  venv not found — setting up..." -ForegroundColor Red
    Set-Location $backendDir
    python -m venv venv
    & ".\venv\Scripts\pip.exe" install -r requirements.txt --quiet
}

$backendJob = Start-Job -ScriptBlock {
    param($dir, $py)
    Set-Location $dir
    & $py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
} -ArgumentList $backendDir, $venvPython

Write-Host "   ✓  Backend starting at http://localhost:8000" -ForegroundColor Green
Write-Host "   ✓  API docs at http://localhost:8000/docs" -ForegroundColor DarkGray
Write-Host ""

# ── Wait for backend ──────────────────────────────────────────────────────────
Write-Host "   ⏳ Waiting for backend to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# ── Start Next.js Frontend ────────────────────────────────────────────────────
Write-Host "▶  Starting Next.js frontend..." -ForegroundColor Yellow
Set-Location $rootDir
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000"

Write-Host ""
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  🎤 VoxBox running at:" -ForegroundColor White
Write-Host "     Frontend → http://localhost:3000" -ForegroundColor Cyan
Write-Host "     Backend  → http://localhost:8000" -ForegroundColor Magenta
Write-Host "     API Docs → http://localhost:8000/docs" -ForegroundColor DarkGray
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor DarkGray
Write-Host ""

npm run dev
