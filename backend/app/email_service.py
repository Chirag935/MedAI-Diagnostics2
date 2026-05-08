"""
Email service supporting Resend (preferred, simpler) or SendGrid.
Auto-detects which provider to use based on env vars.

If neither is configured, calls become no-ops that log only — app still works.

PREFERRED: Resend (https://resend.com — free 3000/mo, no domain verification needed for testing)
    RESEND_API_KEY      - your Resend API key (starts with re_)
    RESEND_FROM_EMAIL   - sender email (use 'onboarding@resend.dev' for instant testing)
    RESEND_FROM_NAME    - optional display name (default: "MedAI Clinic")

ALTERNATIVE: SendGrid
    SENDGRID_API_KEY
    SENDGRID_FROM_EMAIL
    SENDGRID_FROM_NAME
"""
from __future__ import annotations

import os
import logging
from typing import Optional, Tuple

import httpx

logger = logging.getLogger("medai.email")
logger.setLevel(logging.INFO)

RESEND_API_URL = "https://api.resend.com/emails"
SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


def _provider() -> str:
    """Return 'resend', 'sendgrid', or 'mock'."""
    if os.getenv("RESEND_API_KEY") and os.getenv("RESEND_FROM_EMAIL"):
        return "resend"
    if os.getenv("SENDGRID_API_KEY") and os.getenv("SENDGRID_FROM_EMAIL"):
        return "sendgrid"
    return "mock"


def is_configured() -> bool:
    return _provider() != "mock"


def send_email(to_email: str, subject: str, html: str, text: Optional[str] = None) -> dict:
    """
    Send an email via Resend or SendGrid. Returns dict with status:
      { "status": "sent" | "mock" | "no_email" | "failed", "detail": "..." }
    Never raises — failures are returned as status='failed'.
    """
    if not to_email or "@" not in to_email:
        logger.info(f"[EMAIL] skip — invalid recipient: {to_email!r}")
        return {"status": "no_email", "detail": "missing or invalid email"}

    provider = _provider()
    if provider == "mock":
        logger.info(f"[EMAIL MOCK] to={to_email} subject={subject!r} (no provider configured)")
        return {"status": "mock", "detail": "Email provider not configured; logged only"}

    if provider == "resend":
        return _send_via_resend(to_email, subject, html, text)
    return _send_via_sendgrid(to_email, subject, html, text)


def _send_via_resend(to_email: str, subject: str, html: str, text: Optional[str]) -> dict:
    api_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("RESEND_FROM_EMAIL", "")
    from_name = os.getenv("RESEND_FROM_NAME", "MedAI Clinic")
    sender = f"{from_name} <{from_email}>" if from_name else from_email

    payload = {
        "from": sender,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(RESEND_API_URL, json=payload, headers=headers)
        if 200 <= resp.status_code < 300:
            logger.info(f"[EMAIL] (resend) sent to {to_email}")
            return {"status": "sent", "detail": f"resend {resp.status_code}"}
        logger.warning(f"[EMAIL] (resend) failed to {to_email}: {resp.status_code} {resp.text[:200]}")
        return {"status": "failed", "detail": f"resend {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        logger.exception(f"[EMAIL] (resend) exception sending to {to_email}")
        return {"status": "failed", "detail": str(e)}


def _send_via_sendgrid(to_email: str, subject: str, html: str, text: Optional[str]) -> dict:
    api_key = os.getenv("SENDGRID_API_KEY", "")
    from_email = os.getenv("SENDGRID_FROM_EMAIL", "")
    from_name = os.getenv("SENDGRID_FROM_NAME", "MedAI Clinic")

    payload = {
        "personalizations": [{"to": [{"email": to_email}], "subject": subject}],
        "from": {"email": from_email, "name": from_name},
        "content": [
            {"type": "text/plain", "value": text or _strip_html(html)},
            {"type": "text/html", "value": html},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(SENDGRID_API_URL, json=payload, headers=headers)
        if 200 <= resp.status_code < 300:
            logger.info(f"[EMAIL] (sendgrid) sent to {to_email}")
            return {"status": "sent", "detail": f"sendgrid {resp.status_code}"}
        logger.warning(f"[EMAIL] (sendgrid) failed to {to_email}: {resp.status_code} {resp.text[:200]}")
        return {"status": "failed", "detail": f"sendgrid {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        logger.exception(f"[EMAIL] (sendgrid) exception sending to {to_email}")
        return {"status": "failed", "detail": str(e)}


def _strip_html(html: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", html)


# ---------- Templates ----------

def render_prescription_email(*, patient_name: str, doctor_name: str, clinic_name: str,
                              diagnosis: str, medicines: list, notes: str) -> Tuple[str, str]:
    """Returns (subject, html_body)."""
    subject = f"Your prescription from {clinic_name or 'MedAI Clinic'}"
    rows = ""
    for i, m in enumerate(medicines or [], 1):
        rows += (
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{i}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;font-weight:600;color:#0d9488'>{_e(m.get('name',''))}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{_e(m.get('dosage',''))}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{_e(m.get('frequency',''))}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{_e(m.get('duration',''))}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{_e(m.get('instructions',''))}</td>"
            f"</tr>"
        )
    table = (
        "<table style='width:100%;border-collapse:collapse;margin-top:12px;font-size:14px'>"
        "<thead><tr style='background:#0d9488;color:#fff;text-align:left'>"
        "<th style='padding:10px'>#</th>"
        "<th style='padding:10px'>Medicine</th>"
        "<th style='padding:10px'>Dosage</th>"
        "<th style='padding:10px'>Frequency</th>"
        "<th style='padding:10px'>Duration</th>"
        "<th style='padding:10px'>Instructions</th>"
        "</tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    ) if medicines else ""

    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a1a2e;max-width:680px;margin:auto;padding:24px">
      <div style="border-bottom:3px solid #0d9488;padding-bottom:14px;margin-bottom:18px">
        <div style="font-size:22px;font-weight:700;color:#0d9488">{_e(clinic_name) or 'MedAI Clinic'}</div>
        <div style="font-size:14px;color:#475569">Prescribed by {_e(doctor_name) or 'your doctor'}</div>
      </div>
      <p>Dear {_e(patient_name) or 'patient'},</p>
      <p>Please find your prescription below.</p>
      {f'<div style="background:#fef3c7;padding:10px 14px;border-radius:8px;margin:14px 0"><b>Diagnosis:</b> {_e(diagnosis)}</div>' if diagnosis else ''}
      {table}
      {f'<div style="margin-top:16px;padding:12px;border-top:2px dashed #cbd5e1"><b>Notes:</b><br>{_e(notes)}</div>' if notes else ''}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">
        This email was sent automatically by MedAI Diagnostics on behalf of your clinic.
        Please consult your doctor for any clarifications. Do not reply to this email.
      </p>
    </div>
    """
    return subject, html


def render_reminder_email(*, patient_name: str, medication: str, dose: str,
                          time_str: str, notes: str) -> Tuple[str, str]:
    subject = f"Medication reminder: {medication} at {time_str}"
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a1a2e;max-width:520px;margin:auto;padding:24px">
      <div style="background:linear-gradient(135deg,#ec4899,#f43f5e);color:#fff;padding:18px 20px;border-radius:14px;margin-bottom:16px">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:.85">Medication Reminder</div>
        <div style="font-size:24px;font-weight:700;margin-top:6px">{_e(medication)}</div>
        <div style="font-size:14px;opacity:.9">{_e(dose)} • Scheduled for {_e(time_str)}</div>
      </div>
      <p>Hi {_e(patient_name) or 'there'},</p>
      <p>This is a friendly reminder to take your <b>{_e(medication)}</b> ({_e(dose)}) now.</p>
      {f'<div style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px"><b>Note:</b> {_e(notes)}</div>' if notes else ''}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">Sent by MedAI Diagnostics. Do not reply.</p>
    </div>
    """
    return subject, html


def _e(s: object) -> str:
    """HTML-escape user content."""
    import html as _h
    return _h.escape(str(s or ""))
