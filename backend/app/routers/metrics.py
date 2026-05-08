import os
import json
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter()

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")

DISEASE_CONFIG = {
    "symptoms": {
        "name": "General Symptom Predictor (Random Forest)",
        "meta": os.path.join(MODELS_DIR, "symptom_disease_metadata.json"),
    },
    "skin": {
        "name": "Skin Lesion Classifier",
        "meta": os.path.join(MODELS_DIR, "skin_disease_metadata.json"),
    }
}


def _skin_engine_name(meta: dict) -> str:
    engine = (meta or {}).get("engine", "")
    backbone = (meta or {}).get("backbone", "")
    if engine.endswith("_transfer_learning") and backbone:
        return f"Skin Lesion Classifier ({backbone} / HAM10000)"
    if engine == "mobilenetv2_transfer_learning":
        return "Skin Lesion Classifier (MobileNetV2 / HAM10000)"
    return "Skin Lesion Classifier (OpenCV CV Engine)"

def _load_metadata(model_key: str) -> dict:
    cfg = DISEASE_CONFIG.get(model_key)
    if not cfg:
        return {}
    path = cfg.get("meta")
    if path and os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

@router.get("/{model_key}")
async def get_metrics(model_key: str):
    if model_key not in DISEASE_CONFIG:
        raise HTTPException(status_code=404, detail="Model not found")
        
    meta = _load_metadata(model_key)
    name = _skin_engine_name(meta) if model_key == "skin" else DISEASE_CONFIG[model_key]["name"]
    return {
        "model_name": name,
        "accuracy": meta.get("accuracy", 0.0),
        "classes": len(meta.get("diseases", meta.get("classes", []))),
        "status": "active" if meta else "not_trained"
    }

@router.get("/")
async def get_all_metrics():
    res = {}
    for key in DISEASE_CONFIG:
        meta = _load_metadata(key)
        name = _skin_engine_name(meta) if key == "skin" else DISEASE_CONFIG[key]["name"]
        res[key] = {
            "model_name": name,
            "accuracy": meta.get("accuracy", 0.0),
            "status": "active" if meta else "not_trained"
        }
    return res
