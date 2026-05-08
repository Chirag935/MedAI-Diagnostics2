'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, CalendarClock, Plus, Search, User, Stethoscope, Clock, CheckCircle2, XCircle, RefreshCw, Calendar, ListTodo } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { API } from '@/lib/api-config'

interface Appointment {
  id: number
  patient_id: number
  doctor_id: number
  patient_name: string
  doctor_name: string
  doctor_specialization: string
  symptoms: string
  diagnosis_from_checker: string
  status: string
  appointment_date: string
  appointment_time: string
  notes: string
  created_at: string
}

interface AppointmentRequest {
  id: number
  patient_id: number
  patient_name: string
  requested_date: string
  requested_time_frame: string
  symptoms: string
  status: string
  created_at: string
}

interface DoctorAvailability {
  id: number
  name: string
  specialization: string
  booked_times: string[]
}

export default function AppointmentsPage() {
  const router = useRouter()
  const { token, role, isLoggedIn, isLoaded } = useAuth()
  
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'appointments' | 'requests'>('appointments')
  
  // Forms
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [requestForm, setRequestForm] = useState({
    requested_date: '',
    requested_time_frame: 'Morning (09:00 - 12:00)',
    symptoms: ''
  })

  // Receptionist Approval State
  const [approvalModal, setApprovalModal] = useState<AppointmentRequest | null>(null)
  const [availability, setAvailability] = useState<DoctorAvailability[]>([])
  const [approvalForm, setApprovalForm] = useState({
    doctor_id: 0,
    appointment_time: '',
    notes: ''
  })

  useEffect(() => {
    // Wait for AuthContext to finish hydrating from localStorage before redirecting
    if (!isLoaded) return
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    fetchData()
  }, [isLoaded, isLoggedIn, role])

  const fetchData = async () => {
    setIsLoading(true)
    await Promise.all([fetchAppointments(), fetchRequests()])
    setIsLoading(false)
  }

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${API.appointments}/list?token=${token}`)
      if (res.ok) setAppointments(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchRequests = async () => {
    if (role === 'doctor') return // Doctors don't see raw requests
    try {
      const res = await fetch(`${API.appointments}/requests?token=${token}`)
      if (res.ok) setRequests(await res.json())
    } catch (e) { console.error(e) }
  }

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestForm.requested_date) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API.appointments}/request?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      })
      if (res.ok) {
        setShowForm(false)
        setRequestForm({ requested_date: '', requested_time_frame: 'Morning (09:00 - 12:00)', symptoms: '' })
        await fetchRequests()
        setActiveTab('requests')
      }
    } catch (e) { console.error(e) }
    finally { setIsSubmitting(false) }
  }

  const openApprovalModal = async (req: AppointmentRequest) => {
    setApprovalModal(req)
    setApprovalForm({ doctor_id: 0, appointment_time: '', notes: '' })
    try {
      const res = await fetch(`${API.appointments}/doctors-availability?date=${req.requested_date}&token=${token}`)
      if (res.ok) setAvailability(await res.json())
    } catch (e) { console.error(e) }
  }

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!approvalModal || !approvalForm.doctor_id || !approvalForm.appointment_time) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API.appointments}/approve-request/${approvalModal.id}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvalForm),
      })
      if (res.ok) {
        setApprovalModal(null)
        await fetchData()
        setActiveTab('appointments')
      }
    } catch (e) { console.error(e) }
    finally { setIsSubmitting(false) }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch(`${API.appointments}/update/${id}?token=${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await fetchAppointments()
    } catch (e) { console.error(e) }
  }

  const generateGoogleCalendarLink = (appt: Appointment) => {
    const title = encodeURIComponent(`Medical Appointment with Dr. ${appt.doctor_name}`)
    const startStr = `${appt.appointment_date}T${appt.appointment_time}:00`
    const startDate = new Date(startStr)
    const endDate = new Date(startDate.getTime() + 30 * 60000) // 30 min duration
    const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "")
    const dates = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`
    const details = encodeURIComponent(`Patient: ${appt.patient_name}\nSymptoms: ${appt.symptoms}\nNotes: ${appt.notes}`)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`
  }

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch = a.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.symptoms?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="flex items-center text-teal-400 hover:text-teal-300 transition-colors">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </button>
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <CalendarClock className="w-9 h-9 text-sky-400" />
                Appointments
              </h1>
              <p className="text-slate-400 mt-1">
                {role === 'receptionist' ? 'Manage requests and schedule appointments' :
                 role === 'doctor' ? 'View your scheduled appointments' :
                 'Request and track your appointments'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm border border-slate-700 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {role === 'patient' && (
              <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold transition-colors">
                <Plus className="w-4 h-4" /> Request Appointment
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        {role !== 'doctor' && (
          <div className="flex gap-4 border-b border-slate-800 mb-8">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'appointments' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <CalendarClock className="w-4 h-4" /> Official Appointments
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'requests' ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <ListTodo className="w-4 h-4" /> Pending Requests
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-yellow-500 text-yellow-950 px-2 py-0.5 rounded-full text-xs ml-1">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Patient Request Form */}
        {showForm && role === 'patient' && (
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4">Request New Appointment</h3>
            <form onSubmit={handleRequestSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Preferred Date *</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={requestForm.requested_date}
                  onChange={e => setRequestForm({...requestForm, requested_date: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Preferred Timeframe *</label>
                <select
                  required
                  value={requestForm.requested_time_frame}
                  onChange={e => setRequestForm({...requestForm, requested_time_frame: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-sky-500 focus:outline-none"
                >
                  <option>Morning (09:00 - 12:00)</option>
                  <option>Afternoon (12:00 - 16:00)</option>
                  <option>Evening (16:00 - 20:00)</option>
                  <option>Anytime</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Symptoms / Reason</label>
                <input
                  type="text"
                  required
                  value={requestForm.symptoms}
                  onChange={e => setRequestForm({...requestForm, symptoms: e.target.value})}
                  placeholder="e.g. Fever, headache"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-3 flex gap-3 justify-end mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Requests Tab View */}
        {activeTab === 'requests' && role !== 'doctor' && (
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="text-left py-4 px-5 text-slate-400 font-semibold">Date Requested</th>
                  {role === 'receptionist' && <th className="text-left py-4 px-5 text-slate-400 font-semibold">Patient</th>}
                  <th className="text-left py-4 px-5 text-slate-400 font-semibold">Timeframe</th>
                  <th className="text-left py-4 px-5 text-slate-400 font-semibold">Symptoms</th>
                  <th className="text-left py-4 px-5 text-slate-400 font-semibold">Status</th>
                  {role === 'receptionist' && <th className="text-left py-4 px-5 text-slate-400 font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">No requests found.</td></tr>
                ) : requests.map(req => (
                  <tr key={req.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-5 font-medium text-white">{req.requested_date}</td>
                    {role === 'receptionist' && <td className="py-4 px-5 text-blue-400">{req.patient_name}</td>}
                    <td className="py-4 px-5 text-slate-300">{req.requested_time_frame}</td>
                    <td className="py-4 px-5 text-slate-400">{req.symptoms}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[req.status] || 'bg-slate-800 text-slate-400'}`}>
                        {req.status}
                      </span>
                    </td>
                    {role === 'receptionist' && (
                      <td className="py-4 px-5">
                        {req.status === 'pending' && (
                          <button 
                            onClick={() => openApprovalModal(req)}
                            className="text-xs bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Approve / Assign
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Appointments Tab View */}
        {activeTab === 'appointments' && (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search patients, doctors..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'scheduled', 'completed', 'cancelled'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      statusFilter === s ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-32"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" /></div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <CalendarClock className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-semibold">No appointments found</p>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Patient</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Doctor</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Date & Time</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Symptoms</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Status</th>
                        {(role === 'receptionist' || role === 'doctor') && (
                          <th className="text-left py-3 px-4 text-slate-400 font-semibold">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map(appt => (
                        <tr key={appt.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-400" />
                              <span className="text-white font-medium">{appt.patient_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="w-4 h-4 text-teal-400" />
                              <div>
                                <div className="text-white font-medium">Dr. {appt.doctor_name}</div>
                                <div className="text-xs text-slate-500">{appt.doctor_specialization}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-500" />
                              <div>
                                <div className="text-white">{appt.appointment_date}</div>
                                <div className="text-xs text-slate-500">{appt.appointment_time}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{appt.symptoms || '—'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[appt.status] || 'bg-slate-800 text-slate-400'}`}>
                              {appt.status}
                            </span>
                          </td>
                          {(role === 'receptionist' || role === 'doctor') && (
                            <td className="py-3 px-4 flex items-center gap-2">
                              {appt.status === 'scheduled' && (
                                <a 
                                  href={generateGoogleCalendarLink(appt)} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors"
                                  title="Add to Google Calendar"
                                >
                                  <Calendar className="w-3 h-3 text-blue-400" /> GCal
                                </a>
                              )}
                              
                              {appt.status === 'scheduled' && (
                                <>
                                  <button
                                    onClick={() => updateStatus(appt.id, 'completed')}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                    title="Mark completed"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => updateStatus(appt.id, 'cancelled')}
                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                    title="Cancel"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Receptionist Approval Modal */}
        {approvalModal && role === 'receptionist' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Approve Appointment</h2>
                  <p className="text-sm text-slate-400">Assign a doctor and exact time for {approvalModal.patient_name}</p>
                </div>
                <button onClick={() => setApprovalModal(null)} className="text-slate-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 bg-slate-800/30">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Requested Date</div>
                    <div className="font-bold text-white">{approvalModal.requested_date}</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Preferred Timeframe</div>
                    <div className="font-bold text-yellow-400">{approvalModal.requested_time_frame}</div>
                  </div>
                  <div className="col-span-2 bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Symptoms reported</div>
                    <div className="text-slate-300">{approvalModal.symptoms || 'None reported'}</div>
                  </div>
                </div>

                <form onSubmit={handleApprove} className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">1. Select Available Doctor</label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                      {availability.map(doc => (
                        <div 
                          key={doc.id}
                          onClick={() => setApprovalForm({...approvalForm, doctor_id: doc.id})}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            approvalForm.doctor_id === doc.id ? 'bg-sky-500/20 border-sky-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-bold text-white">Dr. {doc.name}</div>
                              <div className="text-xs text-slate-400">{doc.specialization}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500 mb-1">Booked times today</div>
                              <div className="flex gap-1">
                                {doc.booked_times.length > 0 ? doc.booked_times.map((t, i) => (
                                  <span key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300">{t}</span>
                                )) : <span className="text-xs text-emerald-400 font-medium">Fully Open</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Exact Time *</label>
                      <input
                        type="time"
                        required
                        value={approvalForm.appointment_time}
                        onChange={e => setApprovalForm({...approvalForm, appointment_time: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Notes for Doctor</label>
                      <input
                        type="text"
                        value={approvalForm.notes}
                        onChange={e => setApprovalForm({...approvalForm, notes: e.target.value})}
                        placeholder="Optional instructions..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setApprovalModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting || !approvalForm.doctor_id || !approvalForm.appointment_time} className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                      {isSubmitting ? 'Approving...' : 'Confirm Appointment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
