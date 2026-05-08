'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, User, Phone, Droplets, Calendar, AlertTriangle, FileText } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
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

export default function PatientProfilePage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params?.id as string
  const { token, isLoggedIn, role } = useAuth()
  const { t } = useLanguage()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return }
    if (!patientId) return
    fetchData()
  }, [isLoggedIn, patientId])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const pRes = await fetch(`${API_BASE_URL}/api/patients/${patientId}?token=${token}`)
      if (!pRes.ok) {
        const err = await pRes.json().catch(() => ({}))
        throw new Error(err.detail || 'Patient not found')
      }
      setPatient(await pRes.json())
    } catch (e: any) {
      setError(e.message || 'Failed to load patient')
    } finally {
      setIsLoading(false)
    }
  }

  const parseJSON = (s: string) => {
    try { return JSON.parse(s) } catch { return null }
  }

  if (!isLoggedIn) return null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/patients')} className="flex items-center text-teal-400 hover:text-teal-300 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('common.back')}
          </button>
          {role === 'doctor' && patient && (
            <button
              onClick={() => router.push(`/prescription?patient=${patient.id}&name=${encodeURIComponent(patient.name)}&age=${patient.age || ''}&gender=${patient.gender || ''}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:shadow-xl hover:shadow-purple-500/20 transition-all"
            >
              <FileText className="w-4 h-4" />
              New Prescription
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">{t('common.loading') || 'Loading...'}</div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 font-semibold">{error}</p>
          </div>
        ) : patient ? (
          <>
            {/* Patient Info Card */}
            <div className="bg-[#0a1225] border border-white/[0.06] rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <User className="w-10 h-10 text-teal-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{patient.name}</h1>
                    <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded-md">#{patient.id}</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    {patient.age ? `${patient.age} years` : 'Age N/A'} {patient.gender ? `• ${patient.gender}` : ''}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <InfoTile icon={Phone} label="Phone" value={patient.phone || 'N/A'} color="text-cyan-400" />
                    <InfoTile icon={Droplets} label="Blood Group" value={patient.blood_group || 'N/A'} color="text-red-400" />
                    <InfoTile icon={Calendar} label="Registered" value={(patient.created_at || '').slice(0, 10) || 'N/A'} color="text-purple-400" />
                  </div>
                  {patient.allergies && patient.allergies !== 'Not specified' && (
                    <div className="mt-4 flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-amber-300 font-semibold">Allergies</p>
                        <p className="text-sm text-slate-300">{patient.allergies}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </>
        ) : null}
      </div>
    </div>
  )
}

function InfoTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white truncate">{value}</p>
    </div>
  )
}
