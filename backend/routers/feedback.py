"""
Feedback & Active Learning API Router.
POST /api/feedback — log user chain adjustments to teach the ML model.
GET  /api/learning_stats — retrieve active learning AI metrics.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from services.feedback_store import save_user_feedback, get_feedback_stats

router = APIRouter()


class FeedbackPayload(BaseModel):
    reference_features: Dict[str, Any]
    dry_features: Dict[str, Any]
    final_modules: Dict[str, Any]
    rating: Optional[float] = 5.0


@router.post("/feedback")
async def post_feedback(payload: FeedbackPayload):
    try:
        res = save_user_feedback(
            payload.reference_features,
            payload.dry_features,
            payload.final_modules,
            payload.rating or 5.0
        )
        return {"ok": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning_stats")
async def get_stats():
    try:
        return {"ok": True, "stats": get_feedback_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
