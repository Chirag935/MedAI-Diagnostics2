"""
MLOps Feedback & Continuous Learning Router
Uses Supabase for cloud-based prediction tracking and feedback.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

# --- Supabase Client ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in backend/.env")
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client


class PredictionLog(BaseModel):
    module: str  # "symptoms" or "skin"
    prediction: str
    confidence: float
    features: Optional[str] = None


class FeedbackSubmission(BaseModel):
    prediction_id: int
    is_correct: bool
    user_feedback: str = ""


@router.post("/log")
async def log_prediction(log: PredictionLog):
    """Log a prediction for future feedback collection."""
    try:
        sb = get_supabase()
        result = sb.table("predictions").insert({
            "module": log.module,
            "prediction": log.prediction,
            "confidence": log.confidence,
            "timestamp": datetime.now().isoformat(),
            "features": log.features
        }).execute()
        
        prediction_id = result.data[0]["id"] if result.data else 0
        return {"prediction_id": prediction_id, "status": "logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit")
async def submit_feedback(feedback: FeedbackSubmission):
    """Submit user feedback on a prediction's accuracy."""
    try:
        sb = get_supabase()
        result = sb.table("predictions").update({
            "is_correct": feedback.is_correct,
            "user_feedback": feedback.user_feedback
        }).eq("id", feedback.prediction_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Prediction ID not found")
        return {"status": "feedback_recorded", "prediction_id": feedback.prediction_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard")
async def get_mlops_dashboard():
    """Get comprehensive MLOps metrics for the dashboard."""
    try:
        sb = get_supabase()
        
        # Fetch all predictions
        all_preds = sb.table("predictions").select("*").order("id", desc=True).execute()
        predictions = all_preds.data or []
        
        total_predictions = len(predictions)
        
        # Count feedback
        with_feedback = [p for p in predictions if p.get("is_correct") is not None]
        total_feedback = len(with_feedback)
        correct_count = len([p for p in with_feedback if p.get("is_correct") is True])
        feedback_accuracy = (correct_count / total_feedback * 100) if total_feedback > 0 else 0

        # Per-module stats
        modules = {}
        for module in ["symptoms", "skin"]:
            mod_preds = [p for p in predictions if p.get("module") == module]
            mod_feedback = [p for p in mod_preds if p.get("is_correct") is not None]
            mod_correct = len([p for p in mod_feedback if p.get("is_correct") is True])
            avg_conf = sum(p.get("confidence", 0) for p in mod_preds) / len(mod_preds) if mod_preds else 0

            modules[module] = {
                "total_predictions": len(mod_preds),
                "total_feedback": len(mod_feedback),
                "correct": mod_correct,
                "accuracy": round((mod_correct / len(mod_feedback) * 100) if mod_feedback else 0, 1),
                "avg_confidence": round(avg_conf * 100, 1),
            }

        # Time-series data (predictions per day, last 7 days)
        daily_stats = []
        for i in range(6, -1, -1):
            day = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            day_preds = [p for p in predictions if p.get("timestamp", "").startswith(day)]
            day_correct = len([p for p in day_preds if p.get("is_correct") is True])
            day_reviewed = len([p for p in day_preds if p.get("is_correct") is not None])
            daily_stats.append({
                "date": day,
                "predictions": len(day_preds),
                "correct": day_correct,
                "reviewed": day_reviewed,
            })

        # Recent predictions (top 10)
        recent = []
        for row in predictions[:10]:
            recent.append({
                "id": row.get("id"),
                "module": row.get("module"),
                "prediction": row.get("prediction"),
                "confidence": row.get("confidence"),
                "is_correct": row.get("is_correct"),
                "user_feedback": row.get("user_feedback"),
                "timestamp": row.get("timestamp"),
            })

        # Model version history
        versions_result = sb.table("model_versions").select("*").order("id", desc=True).limit(5).execute()
        versions = []
        for row in (versions_result.data or []):
            versions.append({
                "id": row.get("id"),
                "module": row.get("module"),
                "version": row.get("version"),
                "accuracy": row.get("accuracy"),
                "samples_trained": row.get("samples_trained"),
                "timestamp": row.get("timestamp"),
            })

        return {
            "total_predictions": total_predictions,
            "total_feedback": total_feedback,
            "feedback_accuracy": round(feedback_accuracy, 1),
            "modules": modules,
            "daily_stats": daily_stats,
            "recent_predictions": recent,
            "model_versions": versions,
            "data_drift_status": "stable" if feedback_accuracy > 70 or total_feedback == 0 else "warning",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
