from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn
import os
import time
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Rate Limiting (slowapi) ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

from app.routers import symptom_checker, skin_analyzer, metrics, chat, feedback, patients, appointments, prescriptions, reminders

# Track service start time for /health
_START_TIME = time.time()

app = FastAPI(
    title="MedAI Diagnostics API",
    description="Advanced AI-powered medical diagnostics platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Wire rate limiter into app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Required to be False for wildcard
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Mount static files for model uploads
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(symptom_checker.router, prefix="/api/symptoms", tags=["Symptom Checker"])
app.include_router(skin_analyzer.router, prefix="/api/skin", tags=["Skin Analyzer"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Assistant"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["MLOps Feedback"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patient Management"])
app.include_router(appointments.router, prefix="/api/appointments", tags=["Appointments"])
app.include_router(prescriptions.router, prefix="/api/prescriptions", tags=["Prescriptions"])
app.include_router(reminders.router, prefix="/api/reminders", tags=["Medication Reminders"])

@app.get("/")
async def root():
    return {
        "message": "MedAI Diagnostics API",
        "version": "1.0.0",
        "status": "active",
        "endpoints": {
            "symptom_checker": "/api/symptoms",
            "skin_analyzer": "/api/skin",
            "metrics": "/api/metrics",
            "ai_assistant": "/api/chat",
            "mlops_feedback": "/api/feedback"
        }
    }

@app.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Lightweight health probe for Render / uptime monitors."""
    skin_meta = os.path.exists(os.path.join("models", "skin_disease_metadata.json"))
    symptom_pkl = os.path.exists(os.path.join("models", "symptom_disease_model.pkl"))
    skin_h5 = os.path.join("models", "skin_disease_model.h5")
    skin_model_real = os.path.exists(skin_h5) and os.path.getsize(skin_h5) > 1024  # >1KB = real, not placeholder

    return {
        "status": "healthy",
        "service": "MedAI Diagnostics API",
        "version": "1.0.0",
        "uptime_seconds": int(time.time() - _START_TIME),
        "models": {
            "symptom_rf": "loaded" if symptom_pkl else "missing",
            "skin_cnn": "loaded" if skin_model_real else "fallback_opencv",
            "skin_metadata": "loaded" if skin_meta else "missing",
        },
        "supabase": "configured" if os.getenv("SUPABASE_URL") else "not_configured",
        "groq_llm": "configured" if os.getenv("GROQ_API_KEY") else "not_configured",
    }

@app.options("/{path:path}")
async def handle_options(path: str):
    """Handle CORS preflight requests"""
    return {"message": "OK"}

@app.get("/cors-test")
async def cors_test():
    """Test CORS is working"""
    return {"cors": "working", "timestamp": "2024"}



if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=1)
