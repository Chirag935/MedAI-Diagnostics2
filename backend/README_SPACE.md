---
title: MedAI Diagnostics API
emoji: 🩺
colorFrom: teal
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# MedAI Diagnostics — Backend API

FastAPI backend for the MedAI Diagnostics multimodal AI clinical platform.

## Endpoints

- `/api/symptom-checker` — Random Forest symptom-to-disease prediction
- `/api/skin-analyzer` — CNN-based dermatology image classification with XAI heatmaps
- `/api/patients` — Patient records management
- `/api/prescriptions` — Prescription generation + email dispatch
- `/api/appointments` — Appointment scheduling
- `/api/reminders` — Medication reminder scheduling
- `/api/chat` — Llama-3 (Groq) clinical AI consultant
- `/api/feedback` — MLOps feedback collection
- `/api/metrics` — Live model performance metrics

Visit `/docs` for interactive Swagger UI.
