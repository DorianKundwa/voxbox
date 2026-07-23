# VoxBox Stop Script
# Kills all running VoxBox backend and frontend processes.
# Usage: .\stop.ps1

Write-Host ""
Write-Host "  Stopping VoxBox..." -ForegroundColor Yellow
Write-Host ""

# Kill uvicorn (backend)
$uvicorn = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*VoxBox Backend*" -or
    ($_.CommandLine -like "*uvicorn*" -and $_.CommandLine -like "*voxbox*")
}
if ($uvicorn) {
    $uvicorn | Stop-Process -Force
    Write-Host "  Stopped backend (uvicorn)" -ForegroundColor Green
} else {
    Write-Host "  Backend not running" -ForegroundColor DarkGray
}

# Kill Next.js dev server (node)
$nextjs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*VoxBox Frontend*"
}
if ($nextjs) {
    $nextjs | Stop-Process -Force
    Write-Host "  Stopped frontend (Next.js)" -ForegroundColor Green
} else {
    Write-Host "  Frontend not running" -ForegroundColor DarkGray
}

# Find and close the launcher windows by title
Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "VoxBox*"
} | Stop-Process -Force

Write-Host ""
Write-Host "  All VoxBox processes stopped." -ForegroundColor Cyan
Write-Host ""
