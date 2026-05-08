'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, Send, CheckCircle2, AlertTriangle, Mail, MailX, Beaker,
  Clock, Pill, User, RefreshCw, Download,
} from 'lucide-react'
import jsPDF from 'jspdf'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_URL } from '@/lib/api-config'

interface Medicine {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

interface Prescription {
  id: number
  doctor_id: number
  patient_id: number
  patient_name: string
  patient_email: string
  diagnosis: string
  medicines: Medicine[]
  notes: string
  status: 'pending_dispatch' | 'sent'
  email_status: 'sent' | 'mock' | 'failed' | 'no_email' | 'not_attempted'
  email_detail?: string
  sent_at?: string | null
  created_at: string
}

const STATUS_TABS: { key: 'pending_dispatch' | 'sent'; label: string }[] = [
  { key: 'pending_dispatch', label: 'Pending Dispatch' },
  { key: 'sent', label: 'Sent' },
]

export default function PrescriptionsQueuePage() {
  const router = useRouter()
  const { token, isLoaded, isLoggedIn, hasAccess, role } = useAuth()
  const [tab, setTab] = useState<'pending_dispatch' | 'sent'>(
    typeof window !== 'undefined' && localStorage.getItem('medai_user') &&
    JSON.parse(localStorage.getItem('medai_user') || '{}').role === 'patient'
      ? 'sent' : 'pending_dispatch'
  )
  const [items, setItems] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isLoggedIn) { router.push('/login'); return }
    if (!hasAccess('prescriptions')) { router.push('/'); return }
  }, [isLoaded, isLoggedIn, hasAccess, router])

  const fetchList = async (s: 'pending_dispatch' | 'sent' = tab) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/prescriptions?token=${token}&status=${s}`)
      if (res.ok) {
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      } else {
        setItems([])
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(tab) }, [tab, token])

  const dispatchOne = async (id: number) => {
    setSendingId(id)
    setFlash(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/prescriptions/${id}/send?token=${token}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Send failed')
      const er = data?.email_result?.status
      const msg = er === 'sent' ? 'Email delivered to patient.'
        : er === 'mock' ? 'Saved as sent (email mocked — SendGrid not configured).'
        : er === 'no_email' ? 'Saved as sent. Patient has no email on file.'
        : er === 'failed' ? 'Saved as sent, but email delivery failed.'
        : 'Dispatched.'
      setFlash({ type: er === 'failed' ? 'err' : 'ok', msg })
      await fetchList(tab)
    } catch (e: any) {
      setFlash({ type: 'err', msg: e.message || 'Failed to dispatch' })
    } finally {
      setSendingId(null)
    }
  }

  const downloadPDF = (rx: Prescription) => {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 18
    let y = margin

    const date = new Date(rx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    const meds = rx.medicines || []

    // Header — clinic name + Rx symbol
    doc.setFillColor(13, 148, 136)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('MedAI Clinic', margin, 13)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Prescription #${rx.id}`, margin, 20)
    doc.setFontSize(28); doc.setFont('times', 'bold')
    doc.text('Rx', pageW - margin - 10, 18)
    y = 38

    // Patient info row
    doc.setTextColor(100, 116, 139); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('PATIENT', margin, y)
    doc.text('DATE', pageW / 2, y)
    y += 5
    doc.setTextColor(15, 23, 42); doc.setFontSize(12); doc.setFont('helvetica', 'normal')
    doc.text(rx.patient_name || '—', margin, y)
    doc.text(date, pageW / 2, y)
    y += 10

    // Diagnosis
    if (rx.diagnosis) {
      doc.setFillColor(254, 243, 199)
      doc.rect(margin, y, pageW - 2 * margin, 14, 'F')
      doc.setTextColor(146, 64, 14); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
      doc.text('DIAGNOSIS', margin + 3, y + 5)
      doc.setTextColor(120, 53, 15); doc.setFontSize(11); doc.setFont('helvetica', 'normal')
      doc.text(rx.diagnosis, margin + 3, y + 11)
      y += 20
    }

    // Medicines table
    if (meds.length) {
      doc.setFillColor(13, 148, 136)
      doc.rect(margin, y, pageW - 2 * margin, 8, 'F')
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      doc.text('#',           margin + 2,  y + 5.5)
      doc.text('MEDICINE',    margin + 10, y + 5.5)
      doc.text('DOSAGE',      margin + 70, y + 5.5)
      doc.text('FREQUENCY',   margin + 95, y + 5.5)
      doc.text('DURATION',    margin + 130, y + 5.5)
      doc.text('INSTRUCTIONS', margin + 155, y + 5.5)
      y += 8
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      meds.forEach((m, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252)
          doc.rect(margin, y, pageW - 2 * margin, 8, 'F')
        }
        doc.text(String(i + 1),         margin + 2,   y + 5.5)
        doc.text(m.name || '—',         margin + 10,  y + 5.5)
        doc.text(m.dosage || '—',       margin + 70,  y + 5.5)
        doc.text(m.frequency || '—',    margin + 95,  y + 5.5)
        doc.text(m.duration || '—',     margin + 130, y + 5.5)
        doc.text(m.instructions || '—', margin + 155, y + 5.5)
        y += 8
      })
      y += 5
    }

    // Notes
    if (rx.notes) {
      doc.setDrawColor(203, 213, 225); doc.setLineDashPattern([2, 2], 0)
      doc.line(margin, y, pageW - margin, y); doc.setLineDashPattern([], 0)
      y += 6
      doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
      doc.text('NOTES', margin, y)
      y += 5
      doc.setTextColor(51, 65, 85); doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      const wrapped = doc.splitTextToSize(rx.notes, pageW - 2 * margin)
      doc.text(wrapped, margin, y)
    }

    // Footer
    doc.setTextColor(148, 163, 184); doc.setFontSize(8)
    doc.text('Generated by MedAI Diagnostics Platform', pageW / 2, 285, { align: 'center' })

    doc.save(`prescription-${rx.id}-${(rx.patient_name || 'patient').replace(/\s+/g, '-')}.pdf`)
  }

  // Old print-based fallback (unused, kept for reference)
  const _legacyPrintPDF = (rx: Prescription) => {
    const w = window.open('', '_blank'); if (!w) return
    const date = new Date(rx.created_at).toLocaleDateString('en-IN')
    const meds = rx.medicines || []
    w.document.write(`
      <!DOCTYPE html><html><head><title>Prescription - ${rx.patient_name}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',sans-serif;padding:40px;color:#1a1a2e;max-width:800px;margin:0 auto}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d9488;padding-bottom:20px;margin-bottom:25px}
        .clinic{font-size:24px;font-weight:700;color:#0d9488}
        .rx{font-size:36px;color:#0d9488;font-weight:700;font-family:serif}
        .date{font-size:13px;color:#64748b;text-align:right}
        .pinfo{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;margin-bottom:25px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pinfo label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
        .pinfo span{font-size:15px;font-weight:600;color:#1a1a2e;display:block;margin-top:2px}
        .dx{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:25px}
        .dx label{font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase}
        .dx span{font-size:16px;font-weight:600;color:#78350f;display:block;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:25px}
        th{background:#0d9488;color:#fff;padding:10px 14px;text-align:left;font-size:13px;font-weight:600}
        td{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px}
        tr:nth-child(even){background:#f8fafc}
        .med{font-weight:600;color:#0d9488}
        .notes{border-top:2px dashed #cbd5e1;padding-top:16px;margin-top:20px}
        .notes label{font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase}
        .notes p{font-size:14px;color:#334155;margin-top:6px;line-height:1.6}
        .footer{margin-top:50px;font-size:11px;color:#94a3b8;text-align:center}
        @media print{body{padding:20px}}
      </style></head><body>
      <div class="header">
        <div><div class="clinic">MedAI Clinic</div><div style="font-size:13px;color:#64748b;margin-top:4px">Prescription #${rx.id}</div></div>
        <div><div class="rx">℞</div><div class="date">${date}</div></div>
      </div>
      <div class="pinfo">
        <div><label>Patient</label><span>${rx.patient_name || '—'}</span></div>
        <div><label>Date</label><span>${date}</span></div>
      </div>
      ${rx.diagnosis ? `<div class="dx"><label>Diagnosis</label><span>${rx.diagnosis}</span></div>` : ''}
      ${meds.length ? `<table><thead><tr>
        <th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th>
      </tr></thead><tbody>
      ${meds.map((m, i) => `<tr><td>${i + 1}</td><td class="med">${m.name}</td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td><td>${m.instructions}</td></tr>`).join('')}
      </tbody></table>` : ''}
      ${rx.notes ? `<div class="notes"><label>Notes</label><p>${rx.notes}</p></div>` : ''}
      <div class="footer">Generated by MedAI Diagnostics Platform</div>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  const emailBadge = (s: Prescription['email_status']) => {
    const map: Record<string, { icon: any; cls: string; label: string }> = {
      sent:           { icon: Mail,     cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', label: 'Delivered' },
      mock:           { icon: Beaker,   cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30',             label: 'Mock mode' },
      failed:         { icon: AlertTriangle, cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30',     label: 'Bounced' },
      no_email:       { icon: MailX,    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',       label: 'No email' },
      not_attempted:  { icon: Clock,    cls: 'bg-slate-500/10 text-slate-300 border-slate-500/30',       label: 'Not yet sent' },
    }
    const m = map[s] || map.not_attempted
    const Icon = m.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${m.cls}`}>
        <Icon className="w-3 h-3" />
        {m.label}
      </span>
    )
  }

  if (!isLoaded || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050a18] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="flex items-center text-teal-400 hover:text-teal-300 transition-colors">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Prescription Dispatch</h1>
                <p className="text-xs text-slate-400">
                  {role === 'receptionist' ? 'Send doctor-issued prescriptions to patients' :
                   role === 'patient' ? 'Your received prescriptions' : 'Prescription queue'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchList(tab)}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs (hidden for patients) */}
        <div className={`flex gap-2 mb-6 ${role === 'patient' ? 'hidden' : ''}`}>
          {STATUS_TABS.map(s => (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                tab === s.key
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {flash && (
          <div className={`mb-4 px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
            flash.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {flash.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {flash.msg}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.08]">
            <FileText className="w-12 h-12 mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 font-semibold">
              {tab === 'pending_dispatch' ? 'No prescriptions pending dispatch' : 'No sent prescriptions yet'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {tab === 'pending_dispatch' && 'When a doctor saves a prescription, it appears here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(rx => (
              <div key={rx.id} className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{rx.patient_name || 'Unnamed patient'}</div>
                      <div className="text-xs text-slate-500">
                        {rx.patient_email || <span className="text-amber-400">no email on file</span>}
                        <span className="text-slate-700 mx-2">•</span>
                        <span>RX #{rx.id}</span>
                        <span className="text-slate-700 mx-2">•</span>
                        <span>{new Date(rx.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emailBadge(rx.email_status)}
                    {rx.status === 'pending_dispatch' && (role === 'receptionist' || role === 'doctor') && (
                      <button
                        onClick={() => dispatchOne(rx.id)}
                        disabled={sendingId === rx.id}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition disabled:opacity-60"
                      >
                        <Send className="w-4 h-4" />
                        {sendingId === rx.id ? 'Sending...' : 'Send to Patient'}
                      </button>
                    )}
                    {role === 'patient' && (
                      <button
                        onClick={() => downloadPDF(rx)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-teal-500/20 transition"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                  </div>
                </div>

                {rx.diagnosis && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs">
                    <span className="text-amber-400 font-semibold uppercase tracking-wider">Diagnosis: </span>
                    <span className="text-amber-100">{rx.diagnosis}</span>
                  </div>
                )}

                {rx.medicines?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 uppercase">
                          <th className="py-2 pr-3 font-medium">Medicine</th>
                          <th className="py-2 pr-3 font-medium">Dosage</th>
                          <th className="py-2 pr-3 font-medium">Frequency</th>
                          <th className="py-2 pr-3 font-medium">Duration</th>
                          <th className="py-2 pr-3 font-medium">Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rx.medicines.map((m, i) => (
                          <tr key={i} className="border-t border-white/[0.04]">
                            <td className="py-2 pr-3 text-purple-300 font-medium flex items-center gap-1.5">
                              <Pill className="w-3.5 h-3.5" />
                              {m.name}
                            </td>
                            <td className="py-2 pr-3 text-slate-300">{m.dosage}</td>
                            <td className="py-2 pr-3 text-slate-300">{m.frequency}</td>
                            <td className="py-2 pr-3 text-slate-300">{m.duration}</td>
                            <td className="py-2 pr-3 text-slate-400">{m.instructions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rx.notes && (
                  <div className="mt-3 pt-3 border-t border-white/[0.04] text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Notes: </span>{rx.notes}
                  </div>
                )}

                {rx.status === 'sent' && rx.sent_at && (
                  <div className="mt-3 text-xs text-slate-500">
                    Sent {new Date(rx.sent_at).toLocaleString()}
                    {rx.email_status === 'failed' && rx.email_detail && (
                      <span className="text-rose-400 ml-2">· {rx.email_detail}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
