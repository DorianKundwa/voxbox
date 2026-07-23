"""
VoxBox Backend — FastAPI
AI Vocal Chain Matching Engine
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import tempfile
import os
import time

from routers import analyze, recommend, health

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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
