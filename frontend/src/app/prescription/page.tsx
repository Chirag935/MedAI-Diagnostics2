"use client";

import { useState, useEffect, Suspense } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  FileText,
  Pill,
  Clock,
  Calendar,
  User,
  Stethoscope,
  Send,
  CheckCircle2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE_URL } from "@/lib/api-config";

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

function PrescriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { doctor, isLoggedIn, role, token } = useAuth();
  const { t } = useLanguage();

  const patientIdParam = searchParams.get("patient_id");
  const [patientId, setPatientId] = useState<number | null>(
    patientIdParam ? parseInt(patientIdParam) : null,
  );
  const [patientName, setPatientName] = useState(
    searchParams.get("name") || "",
  );
  const [patientAge, setPatientAge] = useState(searchParams.get("age") || "");
  const [patientGender, setPatientGender] = useState(
    searchParams.get("gender") || "",
  );
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([
    {
      name: "",
      dosage: "",
      frequency: "Twice a day",
      duration: "5 days",
      instructions: "After food",
    },
  ]);
  const [patients, setPatients] = useState<
    { id: number; name: string; age: number | null; gender: string | null }[]
  >([]);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const [sendMsg, setSendMsg] = useState("");

  // Load patient list so doctor can pick whom this prescription is for
  useEffect(() => {
    if (!token || role !== "doctor") return;
    fetch(`${API_BASE_URL}/api/patients/list?token=${token}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPatients(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [token, role]);

  const saveAndSend = async () => {
    if (!patientId) {
      setSendStatus("error");
      setSendMsg("Select a patient first");
      return;
    }
    const validMeds = medicines.filter((m) => m.name.trim());
    if (!validMeds.length) {
      setSendStatus("error");
      setSendMsg("Add at least one medicine");
      return;
    }
    setSending(true);
    setSendStatus("idle");
    setSendMsg("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/prescriptions?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientId,
            diagnosis,
            medicines: validMeds,
            notes,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save");
      }
      setSendStatus("saved");
      setSendMsg(
        "Saved. Receptionist queue will dispatch this to the patient.",
      );
    } catch (e: any) {
      setSendStatus("error");
      setSendMsg(e.message || "Failed to save");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) router.push("/login");
    else if (role !== "doctor") router.push("/");
  }, [isLoggedIn, role]);

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      {
        name: "",
        dosage: "",
        frequency: "Twice a day",
        duration: "5 days",
        instructions: "After food",
      },
    ]);
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (
    index: number,
    field: keyof Medicine,
    value: string,
  ) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const generatePDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const date = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const validMeds = medicines.filter((m) => m.name.trim());

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${patientName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 25px; }
          .clinic-name { font-size: 24px; font-weight: 700; color: #0d9488; }
          .doctor-name { font-size: 16px; color: #334155; margin-top: 4px; }
          .doctor-spec { font-size: 13px; color: #64748b; }
          .rx-symbol { font-size: 36px; color: #0d9488; font-weight: 700; font-family: serif; }
          .date { font-size: 13px; color: #64748b; text-align: right; }
          .patient-info { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin-bottom: 25px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .patient-info label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .patient-info span { font-size: 15px; font-weight: 600; color: #1a1a2e; display: block; margin-top: 2px; }
          .diagnosis { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 18px; margin-bottom: 25px; }
          .diagnosis label { font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase; }
          .diagnosis span { font-size: 16px; font-weight: 600; color: #78350f; display: block; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #0d9488; color: white; padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 600; }
          td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          tr:nth-child(even) { background: #f8fafc; }
          .med-name { font-weight: 600; color: #0d9488; }
          .notes { border-top: 2px dashed #cbd5e1; padding-top: 16px; margin-top: 20px; }
          .notes label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          .notes p { font-size: 14px; color: #334155; margin-top: 6px; line-height: 1.6; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature { text-align: right; }
          .signature-line { width: 200px; border-top: 2px solid #1a1a2e; margin-left: auto; padding-top: 8px; }
          .powered-by { font-size: 11px; color: #94a3b8; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="clinic-name">${doctor?.clinic_name || "MedAI Clinic"}</div>
            <div class="doctor-name">${doctor?.name || "Doctor"}</div>
            <div class="doctor-spec">${doctor?.specialization || "General Medicine"}</div>
          </div>
          <div>
            <div class="rx-symbol">℞</div>
            <div class="date">${date}</div>
          </div>
        </div>

        <div class="patient-info">
          <div><label>Patient Name</label><span>${patientName || "—"}</span></div>
          <div><label>Age / Gender</label><span>${patientAge ? patientAge + " yrs" : "—"} / ${patientGender || "—"}</span></div>
          <div><label>Date</label><span>${date}</span></div>
        </div>

        ${diagnosis ? `<div class="diagnosis"><label>Diagnosis</label><span>${diagnosis}</span></div>` : ""}

        ${
          validMeds.length > 0
            ? `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${validMeds
              .map(
                (m, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="med-name">${m.name}</td>
                <td>${m.dosage}</td>
                <td>${m.frequency}</td>
                <td>${m.duration}</td>
                <td>${m.instructions}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>`
            : ""
        }

        ${notes ? `<div class="notes"><label>Notes</label><p>${notes}</p></div>` : ""}

        <div class="footer">
          <div class="powered-by">Generated by MedAI Diagnostics Platform</div>
          <div class="signature">
            <div class="signature-line">
              <div style="font-weight: 600">${doctor?.name || "Doctor"}</div>
              <div style="font-size: 12px; color: #64748b">${doctor?.specialization || ""}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/patients")}
              className="flex items-center text-teal-400 hover:text-teal-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t("common.back")}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {t("rx.title")}
                </h1>
                <p className="text-xs text-slate-400">
                  {doctor?.name} —{" "}
                  {doctor?.clinic_name || doctor?.specialization}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={saveAndSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:shadow-xl hover:shadow-purple-500/20 transition-all disabled:opacity-60"
          >
            {sendStatus === "saved" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending
              ? "Saving..."
              : sendStatus === "saved"
                ? "Sent to Patient"
                : "Save & Send to Patient"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {sendStatus !== "idle" && sendMsg && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
              sendStatus === "saved"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {sendStatus === "saved" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {sendMsg}
          </div>
        )}
        {/* Patient & Diagnosis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-5">
            <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1">
              <User className="w-3 h-3" /> {t("patient.name")}
            </label>
            {patients.length > 0 ? (
              <select
                value={patientId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? parseInt(e.target.value) : null;
                  setPatientId(id);
                  const p = patients.find((x) => x.id === id);
                  if (p) {
                    setPatientName(p.name);
                    setPatientAge(p.age ? String(p.age) : "");
                    setPatientGender(p.gender || "");
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="">— Select patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            )}
          </div>
          <div className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-5">
            <label className="text-xs text-slate-400 mb-2 block">
              {t("patient.age")} / {t("patient.gender")}
            </label>
            <div className="flex gap-2">
              <input
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="Age"
                className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500"
              />
              <select
                value={patientGender}
                onChange={(e) => setPatientGender(e.target.value)}
                className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-5">
            <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1">
              <Stethoscope className="w-3 h-3" /> Diagnosis
            </label>
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g., Viral Fever, Eczema"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Medicines */}
        <div className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-400" />
              Medicines
            </h2>
            <button
              onClick={addMedicine}
              className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t("rx.add")}
            </button>
          </div>

          <div className="space-y-4">
            {medicines.map((med, i) => (
              <div
                key={i}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-teal-400 font-semibold">
                    Medicine #{i + 1}
                  </span>
                  {medicines.length > 1 && (
                    <button
                      onClick={() => removeMedicine(i)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 mb-1 block">
                      {t("rx.medicine")}
                    </label>
                    <input
                      value={med.name}
                      onChange={(e) =>
                        updateMedicine(i, "name", e.target.value)
                      }
                      placeholder="Paracetamol 500mg"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {t("rx.dosage")}
                    </label>
                    <input
                      value={med.dosage}
                      onChange={(e) =>
                        updateMedicine(i, "dosage", e.target.value)
                      }
                      placeholder="500mg"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {t("rx.frequency")}
                    </label>
                    <select
                      value={med.frequency}
                      onChange={(e) =>
                        updateMedicine(i, "frequency", e.target.value)
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option>Once a day</option>
                      <option>Twice a day</option>
                      <option>Three times a day</option>
                      <option>As needed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {t("rx.duration")}
                    </label>
                    <select
                      value={med.duration}
                      onChange={(e) =>
                        updateMedicine(i, "duration", e.target.value)
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option>3 days</option>
                      <option>5 days</option>
                      <option>7 days</option>
                      <option>10 days</option>
                      <option>14 days</option>
                      <option>30 days</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-slate-500 mb-1 block">
                    Instructions
                  </label>
                  <select
                    value={med.instructions}
                    onChange={(e) =>
                      updateMedicine(i, "instructions", e.target.value)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    <option>Before food</option>
                    <option>After food</option>
                    <option>With food</option>
                    <option>Empty stomach</option>
                    <option>At bedtime</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-6">
          <label className="text-sm text-slate-400 mb-2 block font-medium">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Follow-up after 5 days. Avoid cold drinks and oily food."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

export default function PrescriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading...
        </div>
      }
    >
      <PrescriptionContent />
    </Suspense>
  );
}
