"""
Chain recommendation router.
POST /api/recommend  — accepts reference + dry features, returns chain parameters.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any

from services.recommender import recommend_chain

router = APIRouter()


class RecommendRequest(BaseModel):
    reference_features: Dict[str, Any]
    dry_features: Dict[str, Any]
    mode: str = "adapt"   # "exact" | "adapt"


@router.post("/recommend")
async def recommend(req: RecommendRequest):
    """
    Given reference and dry vocal feature sets, compute
    the recommended effect chain parameters.
    """
    try:
        chain = recommend_chain(
            ref=req.reference_features,
            dry=req.dry_features,
            mode=req.mode,
        )
        return JSONResponse(content={"ok": True, "chain": chain})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
