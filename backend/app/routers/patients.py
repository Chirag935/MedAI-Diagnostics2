from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import hashlib
import secrets
from datetime import datetime

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

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# --- Models ---
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "patient"  # patient, doctor, receptionist
    specialization: str = "General Medicine"
    clinic_name: str = ""
    phone: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str = ""  # Selected role tab - used for cross-role validation

class PatientCreate(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = ""

class ConsultationCreate(BaseModel):
    patient_id: int
    diagnosis: str
    symptoms: List[str] = []
    confidence: float = 0
    prescription: List[dict] = []
    notes: str = ""

# --- Auth Endpoints ---
@router.post("/register")
async def register(req: RegisterRequest):
    sb = get_supabase()
    
    # Validate role
    if req.role not in ("patient", "doctor", "receptionist"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be patient, doctor, or receptionist.")
    
    # Check if email already exists
    existing = sb.table("users").select("id").eq("email", req.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    token = secrets.token_hex(32)
    user_data = {
        "name": req.name,
        "email": req.email,
        "password_hash": hash_password(req.password),
        "role": req.role,
        "specialization": req.specialization if req.role == "doctor" else "",
        "clinic_name": req.clinic_name,
        "phone": req.phone,
        "token": token,
    }
    
    result = sb.table("users").insert(user_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Registration failed")
    
    return {
        "token": token,
        "user": {
            "id": result.data[0]["id"],
            "name": req.name,
            "email": req.email,
            "role": req.role,
            "specialization": req.specialization if req.role == "doctor" else "",
            "clinic_name": req.clinic_name,
        }
    }

@router.post("/login")
async def login(req: LoginRequest):
    sb = get_supabase()
    
    result = sb.table("users").select("*").eq("email", req.email).eq("password_hash", hash_password(req.password)).execute()
    
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = result.data[0]
    
    # STRICT ROLE CHECK: prevent cross-role login
    if req.role and user.get("role") and user["role"] != req.role:
        raise HTTPException(
            status_code=403,
            detail=f"This account is registered as a {user['role']}, not a {req.role}. Please select the correct role tab."
        )
    
    token = secrets.token_hex(32)
    
    # Update token
    sb.table("users").update({"token": token}).eq("id", user["id"]).execute()
    
    return {
        "token": token,
        "doctor": {  # Keep backward compatibility
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "specialization": user.get("specialization", ""),
            "clinic_name": user.get("clinic_name", ""),
        },
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "specialization": user.get("specialization", ""),
            "clinic_name": user.get("clinic_name", ""),
        }
    }

@router.get("/me")
async def get_profile(token: str):
    sb = get_supabase()
    result = sb.table("users").select("*").eq("token", token).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = result.data[0]
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "specialization": user.get("specialization", ""),
        "clinic_name": user.get("clinic_name", ""),
    }

# --- Helper: get user from token ---
def _get_user_id(sb, token: str) -> int:
    result = sb.table("users").select("id").eq("token", token).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid token")
    return result.data[0]["id"]

def _get_user(sb, token: str) -> dict:
    result = sb.table("users").select("*").eq("token", token).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid token")
    return result.data[0]

# --- Get all doctors (for receptionist) ---
@router.get("/doctors")
async def list_doctors():
    sb = get_supabase()
    result = sb.table("users").select("id, name, specialization, clinic_name").eq("role", "doctor").execute()
    return result.data or []

# --- Patient CRUD (for doctors and receptionists) ---
@router.get("/list")
async def list_patients(token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    
    # Doctors and receptionists can see patients
    if user["role"] not in ("doctor", "receptionist"):
        raise HTTPException(status_code=403, detail="Access denied. Only doctors and receptionists can manage patients.")
    
    result = sb.table("patients").select("*").execute()
    return result.data or []

@router.post("/add")
async def add_patient(patient: PatientCreate, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    
    if user["role"] not in ("doctor", "receptionist"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = sb.table("patients").insert({
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "phone": patient.phone,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
        "doctor_id": user["id"],
    }).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add patient")
    return result.data[0]

@router.get("/{patient_id}")
async def get_patient(patient_id: int, token: str):
    sb = get_supabase()
    _get_user_id(sb, token)
    
    result = sb.table("patients").select("*").eq("id", patient_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    return result.data[0]

@router.get("/{patient_id}/consultations")
async def get_consultations(patient_id: int, token: str):
    sb = get_supabase()
    _get_user_id(sb, token)
    
    result = sb.table("consultations").select("*").eq("patient_id", patient_id).order("created_at", desc=True).execute()
    return result.data or []

@router.post("/{patient_id}/consultations")
async def add_consultation(patient_id: int, consultation: ConsultationCreate, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can add consultations")
    
    import json
    result = sb.table("consultations").insert({
        "patient_id": patient_id,
        "doctor_id": user["id"],
        "diagnosis": consultation.diagnosis,
        "symptoms": json.dumps(consultation.symptoms),
        "confidence": consultation.confidence,
        "prescription": json.dumps(consultation.prescription),
        "notes": consultation.notes,
    }).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save consultation")
    return result.data[0]
