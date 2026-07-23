#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build VoxBox native C/C++ extensions

.DESCRIPTION
    1. Compiles the C++ DSP engine to WebAssembly (requires Emscripten)
    2. Compiles the Python C feature extraction extension

.USAGE
    .\native\build.ps1
#>

$Root    = Split-Path -Parent $PSScriptRoot
$Native  = Join-Path $Root "native"
$Public  = Join-Path $Root "public\dsp"
$Backend = Join-Path $Root "backend"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  VoxBox Native Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Compile C++ → WASM ────────────────────────────────────────────────────
Write-Host "[1/2] Building C++ DSP Engine → WebAssembly" -ForegroundColor Yellow

$emcc = Get-Command emcc -ErrorAction SilentlyContinue
if ($emcc) {
    $src  = Join-Path $Native "dsp_engine.cpp"
    $out  = Join-Path $Public "voxbox_dsp.js"

    New-Item -ItemType Directory -Force -Path $Public | Out-Null

    $args = @(
        $src,
        "-O3",
        "-msimd128",
        "-s", "WASM=1",
        "-s", "MODULARIZE=0",
        "-s", "EXPORTED_FUNCTIONS=[`"_gate_alloc`",`"_gate_free`",`"_gate_set`",`"_gate_process`",`"_deesser_alloc`",`"_deesser_free`",`"_deesser_set`",`"_deesser_process`",`"_comp_alloc`",`"_comp_free`",`"_comp_set`",`"_comp_process`",`"_biquad_alloc`",`"_biquad_free`",`"_biquad_set_highpass`",`"_biquad_set_lowshelf`",`"_biquad_set_highshelf`",`"_biquad_set_peaking`",`"_biquad_set_bandpass`",`"_biquad_process`",`"_biquad_tick`",`"_sat_process`",`"_width_process`",`"_limiter_alloc`",`"_limiter_free`",`"_limiter_set`",`"_limiter_process`",`"_malloc`",`"_free`"]",
        "-s", "EXPORTED_RUNTIME_METHODS=[`"ccall`",`"cwrap`"]",
        "-s", "ALLOW_MEMORY_GROWTH=1",
        "-s", "INITIAL_MEMORY=16MB",
        "-o", $out
    )

    & emcc @args

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ WASM built: public\dsp\voxbox_dsp.js + .wasm" -ForegroundColor Green
    } else {
        Write-Host "  ❌ WASM build failed (exit $LASTEXITCODE)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⚠️  Emscripten not found — skipping WASM build" -ForegroundColor DarkYellow
    Write-Host "     Install: https://emscripten.org/docs/getting_started/downloads.html" -ForegroundColor DarkYellow
    Write-Host "     The app works without WASM (falls back to Web Audio API)" -ForegroundColor DarkYellow
}

Write-Host ""

# ── 2. Compile Python C extension ────────────────────────────────────────────
Write-Host "[2/2] Building Python C Extension (feature extraction)" -ForegroundColor Yellow

$pip  = Join-Path $Backend "venv\Scripts\python.exe"
$setup = Join-Path $Native "setup.py"

if (Test-Path $pip) {
    Push-Location $Backend
    & $pip $setup build_ext --inplace --build-lib .
    Pop-Location

    $built = Get-ChildItem $Backend -Filter "voxbox_features_c*.pyd" -ErrorAction SilentlyContinue
    if ($built) {
        Write-Host "  ✅ C extension built: $($built.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ C extension build failed" -ForegroundColor Red
        Write-Host "     Make sure Visual C++ Build Tools are installed:" -ForegroundColor DarkYellow
        Write-Host "     https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  ⚠️  Backend venv not found — run setup first" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
