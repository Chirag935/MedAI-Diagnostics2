'use client'

import { useState } from 'react'
import { ArrowLeft, Search, X, Activity, FileText, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSession } from '@/context/SessionContext'
import { API } from '@/lib/api-config'

const EnhancedPDFExport = dynamic(() => import('@/components/EnhancedPDFExport'), {
  ssr: false,
})

const HumanBody3D = dynamic(() => import('@/components/HumanBody3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-slate-900/50 border border-white/5 rounded-2xl flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
    </div>
  ),
})

// Common symptoms list for search/autocomplete
const COMMON_SYMPTOMS = [
  "itching", "skin_rash", "nodal_skin_eruptions", "continuous_sneezing", "shivering", "chills", "joint_pain",
  "stomach_pain", "acidity", "ulcers_on_tongue", "muscle_wasting", "vomiting", "burning_micturition",
  "spotting_urination", "fatigue", "weight_gain", "anxiety", "cold_hands_and_feets", "mood_swings", "weight_loss",
  "restlessness", "lethargy", "patches_in_throat", "irregular_sugar_level", "cough", "high_fever", "sunken_eyes",
  "breathlessness", "sweating", "dehydration", "indigestion", "headache", "yellowish_skin", "dark_urine", "nausea",
  "loss_of_appetite", "pain_behind_the_eyes", "back_pain", "constipation", "abdominal_pain", "diarrhoea", "mild_fever",
  "yellow_urine", "yellowing_of_eyes", "acute_liver_failure", "fluid_overload", "swelling_of_stomach",
  "swelled_lymph_nodes", "malaise", "blurred_and_distorted_vision", "phlegm", "throat_irritation",
  "redness_of_eyes", "sinus_pressure", "runny_nose", "congestion", "chest_pain", "weakness_in_limbs",
  "fast_heart_rate", "pain_during_bowel_movements", "pain_in_anal_region", "bloody_stool",
  "irritation_in_anus", "neck_pain", "dizziness", "cramps", "bruising", "obesity", "swollen_legs",
  "swollen_blood_vessels", "puffy_face_and_eyes", "enlarged_thyroid", "brittle_nails",
  "swollen_extremeties", "excessive_hunger", "extra_marital_contacts", "drying_and_tingling_lips",
  "slurred_speech", "knee_pain", "hip_joint_pain", "muscle_weakness", "stiff_neck", "swelling_joints",
  "movement_stiffness", "spinning_movements", "loss_of_balance", "unsteadiness",
  "weakness_of_one_body_side", "loss_of_smell", "bladder_discomfort", "foul_smell_of_urine",
  "continuous_feel_of_urine", "passage_of_gases", "internal_itching", "toxic_look_(typhos)",
  "depression", "irritability", "muscle_pain", "altered_sensorium", "red_spots_over_body", "belly_pain",
  "abnormal_menstruation", "dischromic_patches", "watering_from_eyes", "increased_appetite", "polyuria",
  "family_history", "mucoid_sputum", "rusty_sputum", "lack_of_concentration", "visual_disturbances",
  "receiving_blood_transfusion", "receiving_unsterile_injections", "coma", "stomach_bleeding",
  "distention_of_abdomen", "history_of_alcohol_consumption", "blood_in_sputum",
  "prominent_veins_on_calf", "palpitations", "painful_walking", "pus_filled_pimples",
  "blackheads", "scurring", "skin_peeling", "silver_like_dusting", "small_dents_in_nails",
  "inflammatory_nails", "blister", "red_sore_around_nose", "yellow_crust_ooze"
]

interface ResultData {
  prediction: string;
  description?: string;
  confidence: number;
  severity: string;
  recommendation: string;
  confidence_warning?: string;
  disclaimer?: string;
  top_predictions?: { disease: string; probability: number; description: string }[];
}

export default function SymptomChecker() {
  const router = useRouter()
  const { addSessionPrediction } = useSession()
  
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [inputMode, setInputMode] = useState<'dropdown' | '3d'>('dropdown')
  const [ageGroup, setAgeGroup] = useState<'child' | 'teen' | 'adult' | 'senior'>('adult')
  const [duration, setDuration] = useState<'hours' | 'days' | 'weeks' | 'chronic'>('days')
  const [freeText, setFreeText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseInfo, setParseInfo] = useState<string | null>(null)

  const parseFreeText = async () => {
    if (!freeText.trim()) return
    setIsParsing(true)
    setParseInfo(null)
    try {
      const response = await fetch(`${API.symptoms}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeText }),
      })
      const data = await response.json()
      const newSymptoms: string[] = data.symptoms || []
      // Merge with existing (avoid duplicates)
      const merged = Array.from(new Set([...selectedSymptoms, ...newSymptoms]))
      setSelectedSymptoms(merged)
      if (data.age_group) setAgeGroup(data.age_group)
      if (data.duration) setDuration(data.duration)
      const modeLabel = data.mode === 'llm' ? 'AI parser' : 'keyword extractor'
      if (newSymptoms.length === 0) {
        setParseInfo(`No matching symptoms found. Try rephrasing or use the dropdown.`)
      } else {
        setParseInfo(`✓ ${modeLabel} extracted ${newSymptoms.length} symptom${newSymptoms.length > 1 ? 's' : ''} • age: ${data.age_group} • duration: ${data.duration}`)
      }
      setResult(null)
    } catch (e) {
      console.error(e)
      setParseInfo('Failed to parse — please ensure the backend is running.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleAddSymptom = (symptom: string) => {
    if (!selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms([...selectedSymptoms, symptom])
      setResult(null)
    }
  }

  const handleRemoveSymptom = (symptom: string) => {
    setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom))
    setResult(null)
  }

  const analyzeSymptoms = async () => {
    if (selectedSymptoms.length === 0) return
    setIsAnalyzing(true)
    
    try {
      const response = await fetch(`${API.symptoms}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: selectedSymptoms, age_group: ageGroup, duration }),
      })
      
      const data = await response.json()
      setResult(data)
      
      addSessionPrediction({
        disease: 'Symptom Triage',
        prediction: data.prediction,
        confidence: data.confidence,
        riskLevel: data.severity,
        timestamp: new Date().toISOString(),
        details: {
          Symptoms: selectedSymptoms.join(', '),
          Recommendation: data.recommendation || 'Consult physician.'
        }
      })
    } catch (error) {
      console.error('Symptom analysis error:', error)
      setResult({
        prediction: 'Connection Error',
        confidence: 0,
        severity: 'Unable to reach AI backend',
        recommendation: 'Please ensure the backend server is running on port 8000 and try again.'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center text-teal-400 hover:text-teal-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </button>

        <div className="mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Smart Symptom Checker</h1>
            <p className="text-slate-400 text-lg mb-6">
              Select symptoms using the interactive 3D body map or the dropdown menu.
            </p>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setInputMode('3d')}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                inputMode === '3d'
                  ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                  : 'bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}
            >
              <span className="text-lg">🧬</span> 3D Body Map
            </button>
            <button
              onClick={() => setInputMode('dropdown')}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                inputMode === 'dropdown'
                  ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                  : 'bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}
            >
              <Search className="w-4 h-4" /> Dropdown List
            </button>
          </div>

          {/* 3D Body Map */}
          {inputMode === '3d' && (
            <div className="mb-8 animate-fadeIn">
              <HumanBody3D
                onSymptomsSelected={setSelectedSymptoms}
                selectedSymptoms={selectedSymptoms}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column: Input */}
          <div className="space-y-8">

            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
              {/* AI free-text intake */}
              <div className="mb-6 bg-gradient-to-br from-indigo-500/10 to-teal-500/10 border border-indigo-500/20 rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-indigo-300 mb-2 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  Describe in plain English (AI Intake)
                </label>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="e.g. I'm 35 and have had a sore throat, fever, and runny nose for the last 3 days"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
                <button
                  onClick={parseFreeText}
                  disabled={!freeText.trim() || isParsing}
                  className={`mt-2 w-full py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    !freeText.trim() || isParsing
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-500 to-teal-500 text-white hover:shadow-lg hover:shadow-indigo-500/25'
                  }`}
                >
                  {isParsing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isParsing ? 'Parsing...' : 'Auto-Extract Symptoms'}
                </button>
                {parseInfo && (
                  <div className="mt-2 text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                    {parseInfo}
                  </div>
                )}
              </div>

              {inputMode === 'dropdown' && (
              <div className="relative mb-6">
                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Select a Symptom</label>
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddSymptom(e.target.value)
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" disabled>-- Choose from the list --</option>
                    {COMMON_SYMPTOMS.filter(s => !selectedSymptoms.includes(s)).sort().map(symp => (
                      <option key={symp} value={symp}>
                        {symp.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 top-8 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              </div>
              )}

              <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Your Symptoms</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedSymptoms.length === 0 && (
                    <span className="text-slate-600 italic">No symptoms selected yet.</span>
                  )}
                  {selectedSymptoms.map(symp => (
                    <span 
                      key={symp} 
                      className="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-full flex items-center text-sm capitalize"
                    >
                      {symp.replace(/_/g, ' ')}
                      <X 
                        className="w-4 h-4 ml-2 cursor-pointer hover:text-white transition-colors" 
                        onClick={() => handleRemoveSymptom(symp)}
                      />
                    </span>
                  ))}
                </div>
              </div>

              {/* Patient context: age + duration */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Age Group</label>
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    <option value="child">Child (under 12)</option>
                    <option value="teen">Teen (13-19)</option>
                    <option value="adult">Adult (20-59)</option>
                    <option value="senior">Senior (60+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    <option value="hours">Few hours</option>
                    <option value="days">A few days</option>
                    <option value="weeks">1+ weeks</option>
                    <option value="chronic">Chronic (months+)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={analyzeSymptoms}
                disabled={selectedSymptoms.length === 0 || isAnalyzing}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all ${
                  selectedSymptoms.length === 0 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-teal-500/25'
                }`}
              >
                {isAnalyzing ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                ) : (
                  <Activity className="w-6 h-6 mr-3" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Analyze Symptoms'}
              </button>
            </div>
          </div>

          {/* Right Column: Results */}
          <div>
            {result ? (
              <div className="bg-slate-900/80 border border-teal-500/30 rounded-3xl p-8 animate-fadeIn shadow-2xl shadow-teal-500/10">
                <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Activity className="w-8 h-8 text-teal-400" />
                </div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">AI Triage Result</h2>
                <h3 className="text-3xl font-bold text-white mb-2">{result.prediction}</h3>
                
                {/* Disease Description */}
                {result.description && (
                  <p className="text-slate-300 text-sm leading-relaxed mb-6 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                    📋 {result.description}
                  </p>
                )}

                {/* Confidence Warning */}
                {result.confidence_warning && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm px-4 py-3 rounded-xl mb-4">
                    {result.confidence_warning}
                  </div>
                )}
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <span className="text-slate-400">AI Confidence</span>
                    <span className="text-white font-bold text-lg">{(result.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <span className="text-slate-400">Severity Level</span>
                    <span className="text-white font-bold text-lg">{result.severity}</span>
                  </div>
                </div>

                {/* Top 3 Predictions */}
                {result.top_predictions && result.top_predictions.length > 1 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Other Possible Conditions</h4>
                    <div className="space-y-2">
                      {result.top_predictions.slice(1).map((pred, i) => (
                        <div key={i} className="bg-slate-800/30 border border-white/5 rounded-xl p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-white font-semibold text-sm">{pred.disease}</span>
                            <span className="text-slate-400 text-xs">{pred.probability}%</span>
                          </div>
                          <p className="text-slate-500 text-xs">{pred.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5 mb-4">
                  <h4 className="text-indigo-400 font-semibold mb-2 flex items-center">
                    <FileText className="w-5 h-5 mr-2" /> Recommendation
                  </h4>
                  <p className="text-indigo-200 leading-relaxed">
                    {result.recommendation || "Based on your symptoms, we strongly recommend consulting a healthcare professional for a formal diagnosis."}
                  </p>
                </div>

                {/* Medical Disclaimer */}
                {result.disclaimer && (
                  <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 mb-6 text-xs text-slate-500 leading-relaxed">
                    {result.disclaimer}
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                  <button 
                    onClick={() => {setResult(null); setSelectedSymptoms([])}}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Start Over
                  </button>
                  <EnhancedPDFExport 
                    predictions={[{
                      disease: 'Symptom Triage',
                      prediction: result.prediction,
                      confidence: result.confidence,
                      riskLevel: result.severity,
                      timestamp: new Date().toLocaleTimeString(),
                      details: {
                        Symptoms: selectedSymptoms.join(', ')
                      }
                    }]} 
                    patientName="User" 
                    patientId="SELF-CHECK"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full bg-slate-900/30 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center opacity-70">
                <div className="w-48 h-48 bg-slate-800 rounded-full mb-8 relative flex items-center justify-center">
                  <Activity className="w-20 h-20 text-slate-600" />
                  {/* Pseudo interactive body map visual */}
                  <div className="absolute inset-0 border-4 border-dashed border-slate-600 rounded-full animate-[spin_20s_linear_infinite]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Awaiting Symptoms</h3>
                <p className="text-slate-500 max-w-sm">
                  Add your symptoms on the left. The AI engine will analyze them against thousands of clinical profiles to provide an instant assessment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
