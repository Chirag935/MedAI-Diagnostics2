"""
Prescription workflow:
  Doctor creates  -> status='pending_dispatch'
  Receptionist sends -> status='sent', email triggered
  Patient sees their own sent prescriptions.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from app.routers.patients import get_supabase, _get_user
from app.email_service import send_email, render_prescription_email

router = APIRouter()


class Medicine(BaseModel):
    name: str
    dosage: str = ""
    frequency: str = ""
    duration: str = ""
    instructions: str = ""


class PrescriptionCreate(BaseModel):
    patient_id: int
    diagnosis: str = ""
    medicines: List[Medicine] = []
    notes: str = ""


def _patient_email(sb, patient_id: int) -> tuple[str, str]:
    """Best-effort lookup of patient's email + name. Email may be empty."""
    p = sb.table("patients").select("*").eq("id", patient_id).execute()
    if not p.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    row = p.data[0]
    name = row.get("name", "")
    email = row.get("email", "") or ""
    # Patients table may not have email; try linked user via phone or name
    if not email and row.get("phone"):
        u = sb.table("users").select("email,name").eq("phone", row["phone"]).eq("role", "patient").execute()
        if u.data:
            email = u.data[0].get("email", "") or ""
    return name, email


@router.post("")
@router.post("/")
async def create_prescription(req: PrescriptionCreate, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can create prescriptions")

    patient_name, patient_email = _patient_email(sb, req.patient_id)

    # Render & send email immediately (doctor → patient direct flow)
    subject, html = render_prescription_email(
        patient_name=patient_name,
        doctor_name=user.get("name", "Doctor"),
        clinic_name=user.get("clinic_name", "MedAI Clinic"),
        diagnosis=req.diagnosis,
        medicines=[m.model_dump() for m in req.medicines],
        notes=req.notes,
    )
    email_result = send_email(patient_email, subject, html)

    record = {
        "doctor_id": user["id"],
        "patient_id": req.patient_id,
        "patient_name": patient_name,
        "patient_email": patient_email,
        "diagnosis": req.diagnosis,
        "medicines": [m.model_dump() for m in req.medicines],
        "notes": req.notes,
        "status": "sent",
        "email_status": email_result["status"],
        "email_detail": email_result.get("detail", "")[:300],
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "sent_by": user["id"],
    }
    res = sb.table("prescriptions").insert(record).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create prescription")
    return {"prescription": res.data[0], "email_result": email_result}


@router.get("")
@router.get("/")
async def list_prescriptions(token: str, status: Optional[str] = Query(None)):
    sb = get_supabase()
    user = _get_user(sb, token)

    q = sb.table("prescriptions").select("*").order("created_at", desc=True)

    if user["role"] == "doctor":
        q = q.eq("doctor_id", user["id"])
    elif user["role"] == "receptionist":
        # default to pending queue unless explicit status
        if not status:
            status = "pending_dispatch"
    elif user["role"] == "patient":
        # patients see only their own SENT prescriptions
        # match by email since patients table is separate from users
        q = q.eq("patient_email", user.get("email", "")).eq("status", "sent")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if status:
        q = q.eq("status", status)

    res = q.execute()
    return res.data or []


@router.get("/{rx_id}")
async def get_prescription(rx_id: int, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    res = sb.table("prescriptions").select("*").eq("id", rx_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Prescription not found")
    rx = res.data[0]
    # access guard
    if user["role"] == "doctor" and rx.get("doctor_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your prescription")
    if user["role"] == "patient" and rx.get("patient_email") != user.get("email"):
        raise HTTPException(status_code=403, detail="Not your prescription")
    return rx


@router.post("/{rx_id}/send")
async def send_prescription(rx_id: int, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    if user["role"] not in ("receptionist", "doctor"):
        raise HTTPException(status_code=403, detail="Only receptionists/doctors can dispatch")

    res = sb.table("prescriptions").select("*").eq("id", rx_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Prescription not found")
    rx = res.data[0]

    if rx.get("status") == "sent":
        return {"ok": True, "already_sent": True, "prescription": rx}

    # Doctor lookup for the email body
    doc = sb.table("users").select("name,clinic_name,specialization").eq("id", rx.get("doctor_id")).execute()
    doc_row = (doc.data or [{}])[0]

    subject, html = render_prescription_email(
        patient_name=rx.get("patient_name", ""),
        doctor_name=doc_row.get("name", "Doctor"),
        clinic_name=doc_row.get("clinic_name", "MedAI Clinic"),
        diagnosis=rx.get("diagnosis", ""),
        medicines=rx.get("medicines", []) or [],
        notes=rx.get("notes", "") or "",
    )

    email_result = send_email(rx.get("patient_email", ""), subject, html)

    update = {
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "sent_by": user["id"],
        "email_status": email_result["status"],
        "email_detail": email_result.get("detail", "")[:300],
    }
    upd = sb.table("prescriptions").update(update).eq("id", rx_id).execute()
    return {"ok": True, "email_result": email_result, "prescription": (upd.data or [rx])[0]}
