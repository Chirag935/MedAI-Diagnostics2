"""
Medication reminders, backend-backed.

Roles:
  - patient: GET/POST/PATCH/DELETE on own reminders only.
  - receptionist: full CRUD on any patient's reminders.
  - doctor: read access (informational).
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from app.routers.patients import get_supabase, _get_user
from app.email_service import send_email, render_reminder_email

router = APIRouter()


class ReminderCreate(BaseModel):
    patient_id: Optional[int] = None      # links to patients table (receptionist flow)
    medication: str
    dose: str
    frequency: str = "daily"              # daily | twice | thrice | custom | once
    times: List[str] = []                 # ["09:00", "21:00"]
    start_date: str                       # ISO yyyy-mm-dd
    end_date: Optional[str] = None
    notes: Optional[str] = ""
    email_alerts: bool = False
    email: Optional[str] = ""             # override email (else looked up)


class ReminderUpdate(BaseModel):
    active: Optional[bool] = None
    email_alerts: Optional[bool] = None
    times: Optional[List[str]] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None


def _resolve_email(sb, user: dict, patient_id: Optional[int], explicit: str = "") -> str:
    if explicit and "@" in explicit:
        return explicit
    if user["role"] == "patient":
        return user.get("email", "") or ""
    if patient_id:
        p = sb.table("patients").select("*").eq("id", patient_id).execute()
        if p.data:
            row = p.data[0]
            email = row.get("email") or ""
            if not email and row.get("phone"):
                u = sb.table("users").select("email").eq("phone", row["phone"]).eq("role", "patient").execute()
                if u.data:
                    email = u.data[0].get("email", "") or ""
            return email
    return ""


@router.post("")
@router.post("/")
async def create_reminder(req: ReminderCreate, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)
    if user["role"] not in ("patient", "receptionist"):
        raise HTTPException(status_code=403, detail="Only patients or receptionists can create reminders")

    patient_id = req.patient_id
    if user["role"] == "patient":
        patient_id = None  # patients own their reminders via owner_user_id, no patients-table link required

    email = _resolve_email(sb, user, patient_id, req.email or "")

    record = {
        "patient_id": patient_id,
        "owner_user_id": user["id"] if user["role"] == "patient" else None,
        "created_by": user["id"],
        "medication": req.medication,
        "dose": req.dose,
        "frequency": req.frequency,
        "times": req.times,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "notes": req.notes or "",
        "active": True,
        "email_alerts": bool(req.email_alerts),
        "email": email,
    }
    res = sb.table("medication_reminders").insert(record).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create reminder")
    return res.data[0]


@router.get("")
@router.get("/")
async def list_reminders(token: str, patient_id: Optional[int] = Query(None)):
    sb = get_supabase()
    user = _get_user(sb, token)

    q = sb.table("medication_reminders").select("*").order("created_at", desc=True)

    if user["role"] == "patient":
        q = q.eq("owner_user_id", user["id"])
    elif user["role"] == "receptionist":
        if patient_id:
            q = q.eq("patient_id", patient_id)
    elif user["role"] == "doctor":
        if patient_id:
            q = q.eq("patient_id", patient_id)
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    res = q.execute()
    return res.data or []


@router.patch("/{rem_id}")
async def update_reminder(rem_id: int, req: ReminderUpdate, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)

    existing = sb.table("medication_reminders").select("*").eq("id", rem_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    rem = existing.data[0]

    if user["role"] == "patient" and rem.get("owner_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your reminder")
    if user["role"] not in ("patient", "receptionist"):
        raise HTTPException(status_code=403, detail="Access denied")

    update = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        return rem
    res = sb.table("medication_reminders").update(update).eq("id", rem_id).execute()
    return (res.data or [rem])[0]


@router.delete("/{rem_id}")
async def delete_reminder(rem_id: int, token: str):
    sb = get_supabase()
    user = _get_user(sb, token)

    existing = sb.table("medication_reminders").select("*").eq("id", rem_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    rem = existing.data[0]

    if user["role"] == "patient" and rem.get("owner_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your reminder")
    if user["role"] not in ("patient", "receptionist"):
        raise HTTPException(status_code=403, detail="Access denied")

    sb.table("medication_reminders").delete().eq("id", rem_id).execute()
    return {"ok": True, "deleted": rem_id}


@router.post("/{rem_id}/send-test-email")
async def send_test_reminder_email(rem_id: int, token: str):
    """Manual trigger: send a reminder email right now (for demo/testing)."""
    sb = get_supabase()
    user = _get_user(sb, token)

    existing = sb.table("medication_reminders").select("*").eq("id", rem_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    rem = existing.data[0]

    if user["role"] == "patient" and rem.get("owner_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your reminder")

    times = rem.get("times") or []
    time_str = times[0] if times else "now"
    patient_name = ""
    if rem.get("patient_id"):
        p = sb.table("patients").select("name").eq("id", rem["patient_id"]).execute()
        if p.data:
            patient_name = p.data[0].get("name", "")
    elif rem.get("owner_user_id"):
        u = sb.table("users").select("name").eq("id", rem["owner_user_id"]).execute()
        if u.data:
            patient_name = u.data[0].get("name", "")

    subject, html = render_reminder_email(
        patient_name=patient_name,
        medication=rem.get("medication", ""),
        dose=rem.get("dose", ""),
        time_str=time_str,
        notes=rem.get("notes", "") or "",
    )
    result = send_email(rem.get("email", "") or "", subject, html)
    return {"ok": True, "email_result": result}
