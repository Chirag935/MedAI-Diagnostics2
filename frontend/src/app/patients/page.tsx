'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Search, Users, Calendar, Activity, Phone, Droplets, User, X, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { API_BASE_URL } from '@/lib/api-config'

interface Patient {
  id: number
  name: string
  age: number | null
  gender: string | null
  phone: string | null
  blood_group: string | null
  allergies: string
  created_at: string
}

export default function PatientsPage() {
  const router = useRouter()
  const { token, isLoggedIn, doctor, logout, role } = useAuth()
  const { t } = useLanguage()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total_patients: 0, new_today: 0, active_appointments: 0 })
  const [form, setForm] = useState({ name: '', age: '', gender: 'Male', phone: '', blood_group: 'O+', allergies: '' })

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return }
    fetchPatients()
  }, [isLoggedIn])

  const computeStats = (list: Patient[], appointmentsActive: number) => {
    const today = new Date().toISOString().slice(0, 10)
    const todayCount = list.filter(p => (p.created_at || '').slice(0, 10) === today).length
    setStats({
      total_patients: list.length,
      new_today: todayCount,
      active_appointments: appointmentsActive,
    })
  }

  const fetchActiveAppointments = async (): Promise<number> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments?token=${token}`)
      if (!res.ok) return 0
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data?.appointments || [])
      return list.filter((a: any) => {
        const s = (a.status || '').toLowerCase()
        return s === 'approved' || s === 'pending' || s === 'scheduled' || s === 'confirmed'
      }).length
    } catch { return 0 }
  }

  const fetchPatients = async () => {
    try {
      const [res, apptCount] = await Promise.all([
        fetch(`${API_BASE_URL}/api/patients/list?token=${token}`),
        fetchActiveAppointments(),
      ])
      if (res.ok) {
        const data: Patient[] = await res.json()
        setPatients(data)
        computeStats(data, apptCount)
      }
    } catch (e) {} finally { setIsLoading(false) }
  }

  const addPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/api/patients/add?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: form.age ? parseInt(form.age) : null }),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ name: '', age: '', gender: 'Male', phone: '', blood_group: 'O+', allergies: '' })
        fetchPatients()
      }
    } catch (e) {}
  }

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.blood_group?.toLowerCase().includes(search.toLowerCase())
  )

  if (!isLoggedIn) return null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="flex items-center text-teal-400 hover:text-teal-300 transition-colors">
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t('common.back')}
            </button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                {t('nav.patients')}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: t('stats.totalPatients'), value: stats.total_patients, icon: Users, color: 'teal' },
            { label: 'New Patients Today', value: stats.new_today, icon: Calendar, color: 'purple' },
            { label: 'Active Appointments', value: stats.active_appointments, icon: Activity, color: 'cyan' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 bg-${s.color}-500/10 rounded-xl flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 text-${s.color}-400`} />
                </div>
                <span className="text-sm text-slate-400">{s.label}</span>
              </div>
              <div className="text-3xl font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search & Add */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`${t('common.search')} ${t('nav.patients').toLowerCase()}...`}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 text-sm transition-colors"
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-semibold text-sm hover:shadow-xl hover:shadow-teal-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('patient.addNew')}
          </button>
        </div>

        {/* Add Patient Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a1225] border border-white/10 rounded-2xl p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">{t('patient.addNew')}</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={addPatient} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t('patient.name')} *</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t('patient.age')}</label>
                    <input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t('patient.gender')}</label>
                    <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500">
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t('patient.phone')}</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t('patient.bloodGroup')}</label>
                    <select value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500">
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:shadow-xl hover:shadow-teal-500/20 transition-all">
                  {t('common.save')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Patient List */}
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(patient => (
              <div
                key={patient.id}
                className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-5 hover:border-teal-500/20 hover:bg-[#0c1530] transition-all cursor-pointer group"
                onClick={() => router.push(`/patients/${patient.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-teal-500/10 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-teal-300 transition-colors">{patient.name}</h3>
                      <p className="text-xs text-slate-500">
                        {patient.age ? `${patient.age} yrs` : ''} {patient.gender ? `• ${patient.gender}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 font-mono">#{patient.id}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {patient.phone && (
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{patient.phone}</span>
                  )}
                  {patient.blood_group && (
                    <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-red-400" />{patient.blood_group}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
