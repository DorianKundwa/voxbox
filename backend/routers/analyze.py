"""
Feature extraction router.
POST /api/analyze  — accepts a WAV/MP3 file, returns full vocal feature set.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile, os, traceback

from services.extractor import extract_features

router = APIRouter()


@router.post("/analyze")
async def analyze_vocal(file: UploadFile = File(...)):
    """
    Upload a reference or dry vocal file.
    Returns extracted audio features used for chain matching.
    """
    allowed = {".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif"}
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        features = extract_features(tmp_path)
        return JSONResponse(content={"ok": True, "features": features})

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
