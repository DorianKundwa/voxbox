# VoxBox Launcher — PowerShell
# Starts the FastAPI backend and Next.js frontend together.
# Usage: Right-click → "Run with PowerShell"  OR  .\start.ps1

$ErrorActionPreference = "Stop"

# ── Colours ───────────────────────────────────────────────────────────────────
function Write-Banner {
    $w = 50
    Write-Host ""
    Write-Host ("=" * $w) -ForegroundColor DarkMagenta
    Write-Host "  VoxBox — AI Vocal Chain Matching" -ForegroundColor Magenta
    Write-Host ("=" * $w) -ForegroundColor DarkMagenta
    Write-Host ""
}

function Write-Step($n, $msg) {
    Write-Host "  [$n] " -ForegroundColor Cyan -NoNewline
    Write-Host $msg -ForegroundColor White
}

function Write-Ok($msg)  { Write-Host "      OK  $msg" -ForegroundColor Green }
function Write-Warn($msg){ Write-Host "      !!  $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "      ER  $msg" -ForegroundColor Red }

# ── Paths ─────────────────────────────────────────────────────────────────────
$Root    = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Venv    = Join-Path $Backend "venv"
$Python  = Join-Path $Venv "Scripts\python.exe"
$Uvicorn = Join-Path $Venv "Scripts\uvicorn.exe"
$Setup   = Join-Path $Root "native\setup.py"

Write-Banner

# ── Pre-flight checks ─────────────────────────────────────────────────────────
Write-Step "1/4" "Pre-flight checks"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js not found — install from https://nodejs.org"
    exit 1
}
Write-Ok "Node $(node --version)"

if (-not (Test-Path $Python)) {
    Write-Err "Python venv not found at: $Venv"
    Write-Warn "Run once:  cd backend; python -m venv venv; venv\Scripts\pip install -r requirements.txt"
    exit 1
}
$pyVer = & $Python --version 2>&1
Write-Ok "Python $pyVer (venv)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "npm not found"
    exit 1
}
Write-Ok "npm $(npm --version)"

# ── Compile C extension ───────────────────────────────────────────────────────
Write-Step "2/4" "Compiling C extension (voxbox_features_c)"

$pydPattern = Join-Path $Backend "voxbox_features_c*.pyd"
try {
    $result = & $Python $Setup build_ext --inplace --build-lib $Backend 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "C extension compiled — native LUFS/RMS/peak enabled"
    } else {
        Write-Warn "C extension compile failed — Python fallback will be used"
        Write-Warn ($result | Select-String "error" | Select-Object -First 3)
    }
} catch {
    Write-Warn "C extension skipped: $_"
}

# ── Start backend ─────────────────────────────────────────────────────────────
Write-Step "3/4" "Starting FastAPI backend on http://localhost:8000"

$backendArgs = @(
    "-NoExit",
    "-Command",
    "Set-Location '$Backend'; & '$Venv\Scripts\Activate.ps1'; uvicorn main:app --reload --host 0.0.0.0 --port 8000"
)

$backendProc = Start-Process powershell `
    -ArgumentList $backendArgs `
    -PassThru `
    -WindowStyle Normal

Write-Ok "Backend PID $($backendProc.Id)"

# Give backend time to bind
Start-Sleep -Seconds 2

# Quick health check
try {
    $health = Invoke-RestMethod "http://localhost:8000/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Ok "Backend healthy: $($health | ConvertTo-Json -Compress)"
} catch {
    Write-Warn "Health check skipped (backend may still be starting)"
}

# ── Start frontend ────────────────────────────────────────────────────────────
Write-Step "4/4" "Starting Next.js frontend on http://localhost:3000"

$frontendArgs = @(
    "-NoExit",
    "-Command",
    "Set-Location '$Root'; npm run dev"
)

$frontendProc = Start-Process powershell `
    -ArgumentList $frontendArgs `
    -PassThru `
    -WindowStyle Normal

Write-Ok "Frontend PID $($frontendProc.Id)"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ("=" * 50) -ForegroundColor DarkMagenta
Write-Host "  VoxBox is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  →  " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend   →  " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs  →  " -NoNewline; Write-Host "http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Close the Backend / Frontend windows to stop." -ForegroundColor DarkGray
Write-Host ("=" * 50) -ForegroundColor DarkMagenta
Write-Host ""

# Keep this launcher window open
Write-Host "  Press any key to open http://localhost:3000 in your browser..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "http://localhost:3000"
