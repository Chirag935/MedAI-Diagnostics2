'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pill, Plus, Trash2, Bell, BellOff, Clock, Calendar,
  CheckCircle2, AlertCircle, ArrowLeft, Sparkles, X, Mail, Send, RefreshCw, User,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_URL } from '@/lib/api-config'

// ---------- Types ----------
type Frequency = 'once' | 'daily' | 'twice' | 'thrice' | 'custom'

interface Reminder {
  id: number
  patient_id: number | null
  owner_user_id: number | null
  medication: string
  dose: string
  frequency: Frequency | string
  times: string[]
  start_date: string
  end_date: string | null
  notes: string
  active: boolean
  email_alerts: boolean
  email: string
  created_at: string
}

interface PatientLite { id: number; name: string }

const FREQ_LABELS: Record<string, string> = {
  once: 'Once a day',
  daily: 'Once a day',
  twice: 'Twice a day',
  thrice: 'Three times a day',
  custom: 'Custom times',
}

const FREQ_DEFAULT_TIMES: Record<Frequency, string[]> = {
  once: ['09:00'],
  daily: ['09:00'],
  twice: ['09:00', '21:00'],
  thrice: ['08:00', '14:00', '20:00'],
  custom: ['09:00'],
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nextDoseLabel(rem: Reminder): string {
  if (!rem.active) return 'Paused'
  if (!rem.times?.length) return '—'
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const upcoming = [...rem.times]
    .map(t => {
      const [h, m] = t.split(':').map(Number)
      return { t, mins: h * 60 + m }
    })
    .sort((a, b) => a.mins - b.mins)
  const next = upcoming.find(u => u.mins > nowMins)
  if (next) return `Today at ${next.t}`
  return `Tomorrow at ${upcoming[0].t}`
}

// ---------- Page ----------
export default function MedicationRemindersPage() {
  const router = useRouter()
  const { isLoaded, isLoggedIn, hasAccess, role, token } = useAuth()

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showForm, setShowForm] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<PatientLite[]>([])
  const [selectedPatient, setSelectedPatient] = useState<number | ''>('')
  const [flash, setFlash] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Auth gate
  useEffect(() => {
    if (!isLoaded) return
    if (!isLoggedIn) { router.push('/login'); return }
    if (!hasAccess('medication-reminders')) router.push('/')
  }, [isLoaded, isLoggedIn, hasAccess, router])

  // Notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Load patients (receptionist/doctor)
  useEffect(() => {
    if (!token) return
    if (role !== 'receptionist' && role !== 'doctor') return
    fetch(`${API_BASE_URL}/api/patients/list?token=${token}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPatients(Array.isArray(d) ? d.map((p: any) => ({ id: p.id, name: p.name })) : []))
      .catch(() => {})
  }, [token, role])

  const fetchReminders = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      let url = `${API_BASE_URL}/api/reminders?token=${token}`
      if ((role === 'receptionist' || role === 'doctor') && selectedPatient) {
        url += `&patient_id=${selectedPatient}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setReminders(Array.isArray(data) ? data : [])
    } catch {
      setReminders([])
    } finally {
      setLoading(false)
    }
  }, [token, role, selectedPatient])

  useEffect(() => { fetchReminders() }, [fetchReminders])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const p = await Notification.requestPermission()
    setPermission(p)
  }

  const addReminder = async (data: any) => {
    try {
      const body: any = { ...data }
      if ((role === 'receptionist' || role === 'doctor') && selectedPatient) {
        body.patient_id = selectedPatient
      }
      const res = await fetch(`${API_BASE_URL}/api/reminders?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to create')
      }
      setShowForm(false)
      setFlash({ type: 'ok', msg: 'Reminder created.' })
      fetchReminders()
    } catch (e: any) {
      setFlash({ type: 'err', msg: e.message })
    }
  }

  const deleteReminder = async (id: number) => {
    if (!confirm('Delete this reminder?')) return
    await fetch(`${API_BASE_URL}/api/reminders/${id}?token=${token}`, { method: 'DELETE' })
    fetchReminders()
  }

  const toggleActive = async (rem: Reminder) => {
    await fetch(`${API_BASE_URL}/api/reminders/${rem.id}?token=${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rem.active }),
    })
    fetchReminders()
  }

  const toggleEmailAlerts = async (rem: Reminder) => {
    await fetch(`${API_BASE_URL}/api/reminders/${rem.id}?token=${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_alerts: !rem.email_alerts }),
    })
    fetchReminders()
  }

  const sendTestEmail = async (id: number) => {
    setFlash(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/reminders/${id}/send-test-email?token=${token}`, { method: 'POST' })
      const data = await res.json()
      const er = data?.email_result?.status
      const msg = er === 'sent' ? 'Email delivered.'
        : er === 'mock' ? 'Mock send (SendGrid not configured) — check server logs.'
        : er === 'no_email' ? 'No email on file for this reminder.'
        : er === 'failed' ? `Email failed: ${data?.email_result?.detail || ''}`
        : 'Done.'
      setFlash({ type: er === 'failed' ? 'err' : 'ok', msg })
    } catch (e: any) {
      setFlash({ type: 'err', msg: e.message })
    }
  }

  if (!isLoaded || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050a18] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050a18] text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px]" />
      </div>

      <header className="relative border-b border-white/[0.06] bg-[#050a18]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/25">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold">Medication Reminders</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">
                {role === 'receptionist' ? 'Manage on patient\'s behalf' :
                 role === 'patient' ? 'Stay on schedule' : 'Patient reminders'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Receptionist patient picker */}
        {(role === 'receptionist' || role === 'doctor') && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <User className="w-4 h-4 text-pink-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Patient:</span>
            <select
              value={selectedPatient}
              onChange={e => setSelectedPatient(e.target.value ? parseInt(e.target.value) : '')}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
            >
              <option value="">— Select patient to view their reminders —</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={fetchReminders}
              className="p-2 rounded-lg hover:bg-white/[0.06] transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {flash && (
          <div className={`mb-4 px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
            flash.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {flash.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {flash.msg}
          </div>
        )}

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Active Reminders</div>
            <div className="text-3xl font-bold">{reminders.filter(r => r.active).length}</div>
            <div className="text-xs text-slate-500 mt-1">{reminders.length} total</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Email Alerts On</div>
            <div className="text-3xl font-bold text-pink-400">
              {reminders.filter(r => r.email_alerts).length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Will receive Gmail reminders</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Browser Notifications</div>
            <div className="flex items-center gap-2 mt-1">
              {permission === 'granted' ? (
                <><Bell className="w-5 h-5 text-emerald-400" /><span className="text-emerald-400 font-semibold">Enabled</span></>
              ) : permission === 'denied' ? (
                <><BellOff className="w-5 h-5 text-rose-400" /><span className="text-rose-400 font-semibold">Blocked</span></>
              ) : (
                <button onClick={requestPermission} className="text-xs px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 transition font-semibold">
                  Enable browser alerts
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {(role === 'receptionist' || role === 'doctor') && !selectedPatient
              ? 'Select a patient above'
              : 'Reminders'}
          </h2>
          {(role === 'patient' || ((role === 'receptionist' || role === 'doctor') && selectedPatient)) && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition font-semibold text-sm shadow-lg shadow-pink-500/25"
            >
              <Plus className="w-4 h-4" />
              Add Reminder
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading...</div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/[0.08]">
            <Pill className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1 font-semibold">No reminders yet</div>
            <div className="text-sm text-slate-500">
              {(role === 'receptionist' || role === 'doctor') && !selectedPatient
                ? 'Pick a patient to view or create reminders.'
                : 'Add a medication to start getting alerts.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reminders.map(r => (
              <ReminderCard
                key={r.id}
                rem={r}
                canManage={role === 'patient' || role === 'receptionist'}
                onDelete={() => deleteReminder(r.id)}
                onToggle={() => toggleActive(r)}
                onToggleEmail={() => toggleEmailAlerts(r)}
                onTestEmail={() => sendTestEmail(r.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-pink-500/5 border border-pink-500/20">
          <Sparkles className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <span className="font-semibold text-pink-400">Tip:</span> Toggle <b>Email alerts</b> on a reminder
            to receive Gmail notifications. Use <b>Send test email</b> to verify delivery to the patient
            address. Browser pop-ups still work locally for the logged-in user.
          </div>
        </div>
      </main>

      {showForm && (
        <ReminderForm
          showEmailField={role === 'receptionist'}
          onClose={() => setShowForm(false)}
          onSubmit={addReminder}
        />
      )}
    </div>
  )
}

// ---------- Subcomponents ----------
function ReminderCard({
  rem, canManage, onDelete, onToggle, onToggleEmail, onTestEmail,
}: {
  rem: Reminder
  canManage: boolean
  onDelete: () => void
  onToggle: () => void
  onToggleEmail: () => void
  onTestEmail: () => void
}) {
  return (
    <div className={`rounded-2xl border p-5 transition ${
      rem.active
        ? 'border-white/[0.08] bg-white/[0.02] hover:border-pink-500/30'
        : 'border-white/[0.04] bg-white/[0.01] opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 rounded-xl flex items-center justify-center">
            <Pill className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <div className="font-bold text-white">{rem.medication}</div>
            <div className="text-xs text-slate-400">{rem.dose}</div>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <button onClick={onToggle} title={rem.active ? 'Pause' : 'Resume'} className="p-2 rounded-lg hover:bg-white/[0.04] transition">
              {rem.active ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-slate-500" />}
            </button>
            <button onClick={onDelete} title="Delete" className="p-2 rounded-lg hover:bg-rose-500/10 transition">
              <Trash2 className="w-4 h-4 text-slate-500 hover:text-rose-400" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{FREQ_LABELS[rem.frequency] || rem.frequency}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">{(rem.times || []).join(', ')}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>From {rem.start_date}</span>
          {rem.end_date && <><span className="text-slate-600">→</span><span>{rem.end_date}</span></>}
        </div>
        {rem.notes && (
          <div className="text-xs text-slate-500 italic pt-1 border-t border-white/[0.04]">
            {rem.notes}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs">
          <span className="text-slate-500">Next: </span>
          <span className="text-pink-400 font-semibold">{nextDoseLabel(rem)}</span>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleEmail}
              title="Toggle Gmail alerts"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition ${
                rem.email_alerts
                  ? 'bg-pink-500/10 border-pink-500/40 text-pink-300'
                  : 'bg-white/[0.02] border-white/[0.08] text-slate-500 hover:text-slate-300'
              }`}
            >
              <Mail className="w-3 h-3" />
              {rem.email_alerts ? 'Email on' : 'Email off'}
            </button>
            {rem.email_alerts && rem.email && (
              <button
                onClick={onTestEmail}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium hover:bg-emerald-500/20 transition"
                title={`Send test email to ${rem.email}`}
              >
                <Send className="w-3 h-3" />
                Test
              </button>
            )}
          </div>
        )}
      </div>
      {rem.email_alerts && (
        <div className="mt-2 text-[11px] text-slate-500 truncate">
          → {rem.email || <span className="text-amber-400">no email on file</span>}
        </div>
      )}
    </div>
  )
}

function ReminderForm({
  showEmailField, onClose, onSubmit,
}: {
  showEmailField: boolean
  onClose: () => void
  onSubmit: (r: any) => void
}) {
  const [medication, setMedication] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [times, setTimes] = useState<string[]>(['09:00'])
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const updateFrequency = (f: Frequency) => {
    setFrequency(f)
    setTimes(FREQ_DEFAULT_TIMES[f])
  }

  const handleSubmit = () => {
    if (!medication.trim()) return setError('Medication name is required')
    if (!dose.trim()) return setError('Dose is required')
    if (!times.length) return setError('Add at least one reminder time')
    onSubmit({
      medication: medication.trim(),
      dose: dose.trim(),
      frequency,
      times: [...times].sort(),
      start_date: startDate,
      end_date: endDate || null,
      notes: notes.trim(),
      email_alerts: emailAlerts,
      email: email.trim(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0a1124] border border-white/[0.08] rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div className="font-bold">New Reminder</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Field label="Medication name">
            <input value={medication} onChange={e => setMedication(e.target.value)} placeholder="e.g. Metformin"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50" />
          </Field>

          <Field label="Dose">
            <input value={dose} onChange={e => setDose(e.target.value)} placeholder="e.g. 500mg or 1 tablet"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50" />
          </Field>

          <Field label="Frequency">
            <select value={frequency} onChange={e => updateFrequency(e.target.value as Frequency)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50">
              <option value="daily">Once a day</option>
              <option value="twice">Twice a day</option>
              <option value="thrice">Three times a day</option>
              <option value="custom">Custom times</option>
            </select>
          </Field>

          <Field label="Reminder times">
            <div className="space-y-2">
              {times.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="time" value={t}
                    onChange={e => setTimes(prev => prev.map((tt, i) => i === idx ? e.target.value : tt))}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50" />
                  {frequency === 'custom' && times.length > 1 && (
                    <button onClick={() => setTimes(prev => prev.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {frequency === 'custom' && (
                <button onClick={() => setTimes(prev => [...prev, '12:00'])}
                  className="w-full px-3 py-2 rounded-lg border border-dashed border-white/[0.1] text-xs text-slate-400 hover:text-white hover:border-pink-500/30 transition">
                  + Add another time
                </button>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50" />
            </Field>
            <Field label="End date (optional)">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50" />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Take with food, etc." rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50 resize-none" />
          </Field>

          <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={emailAlerts} onChange={e => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-pink-500" />
              <Mail className="w-4 h-4 text-pink-400" />
              <span className="text-sm font-semibold">Send Gmail reminder when due</span>
            </label>
            {emailAlerts && showEmailField && (
              <input value={email} onChange={e => setEmail(e.target.value)}
                placeholder="patient@gmail.com (leave blank to use email on file)"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50" />
            )}
            {emailAlerts && !showEmailField && (
              <p className="text-xs text-slate-400">Will be sent to the email on your account.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition">
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-sm font-semibold shadow-lg shadow-pink-500/25 transition">
            Save Reminder
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">
        {label}
      </span>
      {children}
    </label>
  )
}
