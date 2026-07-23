@echo off
title VoxBox Launcher
color 0A
cls

echo.
echo  ============================================
echo    VoxBox -- AI Vocal Chain Matching
echo    Starting frontend + backend...
echo  ============================================
echo.

:: ── Check Node ──────────────────────────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

:: ── Check Python venv ────────────────────────────────────────────────────────
if not exist "backend\venv\Scripts\python.exe" (
    echo  [ERROR] Backend venv not found.
    echo  Run:  cd backend ^&^& python -m venv venv
    echo        venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo  [1/3] Compiling C extension (if needed)...
cd backend
venv\Scripts\python.exe ..\native\setup.py build_ext --inplace --build-lib . >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo        C extension compiled OK
) else (
    echo        C extension skipped (will use Python fallback)
)
cd ..

echo  [2/3] Starting backend (FastAPI on :8000)...
start "VoxBox Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && python -m uvicorn main:app --reload --port 8000"

:: Give backend 2 seconds to boot
timeout /t 2 /nobreak >nul

echo  [3/3] Starting frontend (Next.js on :3000)...
start "VoxBox Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo  ============================================
echo    Both services are starting...
echo.
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo  ============================================
echo.
echo  Close the Backend / Frontend windows to stop.
echo.
pause
