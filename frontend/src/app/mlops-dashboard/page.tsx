'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Activity, BarChart3, RefreshCw, CheckCircle2, XCircle, Clock, TrendingUp, Database, Shield, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { API } from '@/lib/api-config'
import { useAuth } from '@/context/AuthContext'

interface ModuleStats {
  total_predictions: number
  total_feedback: number
  correct: number
  accuracy: number
  avg_confidence: number
}

interface DailyStat {
  date: string
  predictions: number
  correct: number
  reviewed: number
}

interface RecentPrediction {
  id: number
  module: string
  prediction: string
  confidence: number
  is_correct: number | null
  user_feedback: string | null
  timestamp: string
}

interface DashboardData {
  total_predictions: number
  total_feedback: number
  feedback_accuracy: number
  modules: Record<string, ModuleStats>
  daily_stats: DailyStat[]
  recent_predictions: RecentPrediction[]
  data_drift_status: string
}

export default function MLOpsDashboard() {
  const router = useRouter()
  const { isLoggedIn, role } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [submittingFeedback, setSubmittingFeedback] = useState<number | null>(null)

  useEffect(() => {
    if (!isLoggedIn) router.push('/login')
    else if (role !== 'doctor') router.push('/')
  }, [isLoggedIn, role])

  const submitFeedback = async (predictionId: number, isCorrect: boolean) => {
    setSubmittingFeedback(predictionId)
    try {
      await fetch(`${API.feedback}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prediction_id: predictionId,
          is_correct: isCorrect,
          user_feedback: isCorrect ? 'Verified correct by user' : 'Marked incorrect by user'
        })
      })
      await fetchDashboard(true) // Refresh data
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setSubmittingFeedback(null)
    }
  }

  const fetchDashboard = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const res = await fetch(`${API.feedback}/dashboard`)
      if (res.ok) {
        const data = await res.json()
        setDashboard(data)
      }
    } catch (error) {
      console.error('Failed to fetch MLOps dashboard:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  // Calculate bar chart max for scaling
  const maxPredictions = dashboard ? Math.max(...dashboard.daily_stats.map(d => d.predictions), 1) : 1

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="w-9 h-9 text-emerald-400" />
                MLOps Dashboard
              </h1>
              <p className="text-slate-400 mt-1">Real-time model performance monitoring & continuous learning pipeline</p>
            </div>
          </div>
          <button
            onClick={() => fetchDashboard(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
          </div>
        ) : dashboard ? (
          <div className="space-y-8">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-emerald-500/20 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Database className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-4xl font-extrabold text-white">{dashboard.total_predictions}</div>
                <div className="text-sm text-slate-400 mt-1">Predictions Logged</div>
              </div>
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-blue-500/20 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <CheckCircle2 className="w-6 h-6 text-blue-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Feedback</span>
                </div>
                <div className="text-4xl font-extrabold text-white">{dashboard.total_feedback}</div>
                <div className="text-sm text-slate-400 mt-1">User Verifications</div>
              </div>
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-purple-500/20 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Accuracy</span>
                </div>
                <div className="text-4xl font-extrabold text-white">{dashboard.feedback_accuracy}%</div>
                <div className="text-sm text-slate-400 mt-1">From User Feedback</div>
              </div>
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-yellow-500/20 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Shield className="w-6 h-6 text-yellow-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Drift</span>
                </div>
                <div className={`text-4xl font-extrabold ${dashboard.data_drift_status === 'stable' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {dashboard.data_drift_status === 'stable' ? 'Stable' : 'Warning'}
                </div>
                <div className="text-sm text-slate-400 mt-1">Data Drift Status</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Prediction Activity Chart */}
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  Prediction Activity (7 Days)
                </h3>
                <div className="flex items-end gap-2 h-48">
                  {dashboard.daily_stats.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center justify-end h-36">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500 min-h-[4px]"
                          style={{ height: `${(day.predictions / maxPredictions) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{day.date.slice(5)}</span>
                      <span className="text-xs text-emerald-400 font-bold">{day.predictions}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Module Performance */}
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Module Performance
                </h3>
                <div className="space-y-6">
                  {Object.entries(dashboard.modules).map(([key, mod]) => (
                    <div key={key} className="bg-slate-800/50 rounded-xl p-5 border border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-white capitalize">{key} Module</h4>
                        <span className={`text-sm font-bold ${mod.accuracy >= 80 ? 'text-emerald-400' : mod.accuracy >= 50 ? 'text-yellow-400' : 'text-slate-400'}`}>
                          {mod.accuracy}% Accuracy
                        </span>
                      </div>
                      {/* Accuracy bar */}
                      <div className="w-full bg-slate-700 rounded-full h-3 mb-4 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            mod.accuracy >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                            mod.accuracy >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                            'bg-gradient-to-r from-slate-500 to-slate-400'
                          }`}
                          style={{ width: `${Math.max(mod.accuracy, 2)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-white">{mod.total_predictions}</div>
                          <div className="text-xs text-slate-500">Predictions</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-white">{mod.total_feedback}</div>
                          <div className="text-xs text-slate-500">Reviewed</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-white">{mod.avg_confidence}%</div>
                          <div className="text-xs text-slate-500">Avg Confidence</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Predictions Table */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Recent Predictions & Feedback
              </h3>
              {dashboard.recent_predictions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No predictions logged yet. Use the Symptom Checker or Skin Analyzer to generate data.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">ID</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Module</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Prediction</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Confidence</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Verify</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recent_predictions.map((pred) => (
                        <tr key={pred.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono">#{pred.id}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              pred.module === 'skin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-teal-500/10 text-teal-400'
                            }`}>
                              {pred.module}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white font-medium">{pred.prediction}</td>
                          <td className="py-3 px-4 text-white">{(pred.confidence * 100).toFixed(1)}%</td>
                          <td className="py-3 px-4">
                            {pred.is_correct === null ? (
                              <span className="text-slate-500 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            ) : pred.is_correct === true || pred.is_correct === 1 ? (
                              <span className="text-emerald-400 text-xs flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Correct
                              </span>
                            ) : (
                              <span className="text-red-400 text-xs flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Incorrect
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {pred.is_correct === null ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => submitFeedback(pred.id, true)}
                                  disabled={submittingFeedback === pred.id}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-50"
                                  title="Mark as correct"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => submitFeedback(pred.id, false)}
                                  disabled={submittingFeedback === pred.id}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                                  title="Mark as incorrect"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">Reviewed</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-xs">{pred.timestamp.split('T')[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Architecture Info */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-emerald-300 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                MLOps Pipeline Architecture
              </h3>
              <p className="text-emerald-200/80 text-sm leading-relaxed mb-4">
                This dashboard tracks the full lifecycle of our AI models using a feedback-driven continuous learning architecture:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { step: '1', title: 'Predict', desc: 'AI generates prediction' },
                  { step: '2', title: 'Log', desc: 'Result stored in Supabase Cloud' },
                  { step: '3', title: 'Verify', desc: 'User confirms accuracy' },
                  { step: '4', title: 'Retrain', desc: 'Model improves over time' },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-4 text-center border border-emerald-500/10">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400 font-bold text-sm">
                      {s.step}
                    </div>
                    <div className="text-sm font-bold text-white">{s.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-32 text-red-400">
            <p className="text-lg font-semibold">Failed to load MLOps Dashboard</p>
            <p className="text-sm text-slate-500 mt-2">Could not reach the backend. Please check your connection.</p>
          </div>
        )}
      </div>
    </div>
  )
}
