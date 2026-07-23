"""
VoxBox Backend — FastAPI
AI Vocal Chain Matching Engine
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import sys
import time

from routers import analyze, recommend, health

_start_time = time.time()

app = FastAPI(
    title="VoxBox API",
    description="AI Vocal Chain Matching — Feature Extraction & Parameter Recommendation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(recommend.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "VoxBox API running", "version": "1.0.0"}


@app.get("/health")
async def health_root():
    """Root health check — used by the launcher and monitoring."""
    # Detect if native C extension is loaded
    try:
        import voxbox_features_c
        c_ext = True
    except ImportError:
        c_ext = False

    import librosa, numpy, scipy, pyloudnorm
    return {
        "status": "ok",
        "service": "voxbox-api",
        "version": "1.0.0",
        "python": sys.version.split()[0],
        "native_c_extension": c_ext,
        "libs": {
            "librosa":   librosa.__version__,
            "numpy":     numpy.__version__,
            "scipy":     scipy.__version__,
            "pyloudnorm": pyloudnorm.__version__,
        },
        "uptime_s": round(time.time() - _start_time, 1),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
