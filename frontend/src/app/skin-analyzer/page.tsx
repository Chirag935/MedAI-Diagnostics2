'use client'

import { useState, useRef } from 'react'
import { ArrowLeft, Camera, Upload, Activity, ShieldAlert, CheckCircle2, Eye, Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSession } from '@/context/SessionContext'
import { API } from '@/lib/api-config'
import Image from 'next/image'

const EnhancedPDFExport = dynamic(() => import('@/components/EnhancedPDFExport'), {
  ssr: false,
})

interface ResultData {
  prediction: string;
  confidence: number;
  severity: string;
  recommendation: string;
  heatmap?: string;
  features?: {
    edge_density: number;
    redness_index: number;
    dark_spot_ratio: number;
  };
}

export default function SkinAnalyzer() {
  const router = useRouter()
  const { addSessionPrediction } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = async () => {
    setIsCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      alert("Could not access camera. Please allow camera permissions or use the upload button.")
      setIsCameraOpen(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsCameraOpen(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg')
        setSelectedImage(dataUrl)
        setResult(null)
        
        // Convert base64 to File object
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const capturedFile = new File([blob], "captured_skin_photo.jpg", { type: "image/jpeg" })
            setFile(capturedFile)
          })
          
        stopCamera()
      }
    }
  }



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage(reader.result as string)
        setResult(null) // Reset previous results
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = async () => {
    if (!file || !selectedImage) return
    setIsAnalyzing(true)
    

    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API.skin}/predict`, {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      setResult(data)
      
      addSessionPrediction({
        disease: 'Skin Analysis',
        prediction: data.prediction,
        confidence: data.confidence,
        riskLevel: data.severity,
        timestamp: new Date().toISOString(),
        details: {
          Recommendation: data.recommendation || 'Consult a dermatologist.'
        }
      })
    } catch (error) {
      console.error(error)
      setResult({
        prediction: "Backend Server Error",
        confidence: 0.0,
        severity: "Data Error",
        recommendation: "Could not connect to the Python backend to analyze the image. Please ensure start.bat is running properly."
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
          className="flex items-center text-indigo-400 hover:text-indigo-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column: Input */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-4">Skin Infection Analyzer</h1>
              <p className="text-slate-400 text-lg">
                Snap a clear photo of the affected skin area. Our AI will analyze the image to identify common skin conditions like Acne, Melanoma, or Eczema.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8">
              {!selectedImage ? (
                <div className="flex flex-col gap-4">
                  <div 
                    onClick={startCamera}
                    className="border-2 border-indigo-500/30 bg-indigo-500/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all group shadow-lg"
                  >
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Camera className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Take a Photo</h3>
                    <p className="text-indigo-200 text-center text-sm">Use your camera directly</p>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="px-4 text-slate-500 text-sm font-semibold uppercase">Or</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-500/30 bg-slate-800/50 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 hover:border-slate-500/50 transition-all group"
                  >
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">Upload from Device</h3>
                    <p className="text-slate-400 text-center text-sm">Supports JPG, PNG formats</p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center group">
                  <Image 
                    src={selectedImage} 
                    alt="Skin lesion" 
                    fill
                    className="object-contain"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => {setSelectedImage(null); setFile(null); setResult(null);}}
                      className="bg-white/10 backdrop-blur-md text-white px-6 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all"
                    >
                      Choose Different Photo
                    </button>
                  </div>
                </div>
              )}

              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                capture="environment"
                className="hidden" 
              />

              {selectedImage && (
                <button
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  className={`w-full mt-8 py-4 rounded-xl font-bold flex items-center justify-center transition-all ${
                    isAnalyzing 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/25'
                  }`}
                >
                  {isAnalyzing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  ) : (
                    <Activity className="w-6 h-6 mr-3" />
                  )}
                  {isAnalyzing ? 'Analyzing Image...' : 'Analyze Skin Condition'}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Results */}
          <div>
            {result ? (
              <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-8 animate-fadeIn shadow-2xl shadow-indigo-500/10">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
                  {result.severity === "Data Error" ? (
                    <ShieldAlert className="w-8 h-8 text-yellow-500" />
                  ) : result.severity.includes("High") || result.severity.includes("Consult") ? (
                    <ShieldAlert className="w-8 h-8 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 text-indigo-400" />
                  )}
                </div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Analysis Result</h2>
                <h3 className="text-3xl font-bold text-white mb-6">{result.prediction}</h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <span className="text-slate-400">AI Confidence</span>
                    <span className="text-white font-bold text-lg">{(result.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <span className="text-slate-400">Severity Level</span>
                    <span className={`font-bold text-lg ${result.severity.includes("High") ? "text-red-400" : "text-white"}`}>
                      {result.severity}
                    </span>
                  </div>
                </div>

                {/* XAI Heatmap Viewer */}
                {result.heatmap && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-400" />
                        Explainable AI (XAI) Saliency Map
                      </h4>
                      <button
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-lg hover:bg-orange-500/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showHeatmap ? 'Hide Heatmap' : 'View Heatmap'}
                      </button>
                    </div>
                    {showHeatmap && (
                      <div className="relative rounded-xl overflow-hidden border border-orange-500/20 animate-fadeIn">
                        <img src={result.heatmap} alt="XAI Saliency Heatmap" className="w-full" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          <p className="text-xs text-orange-200">🔥 Warm regions = High attention areas influencing the AI prediction</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Feature Metrics */}
                {result.features && (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-lg font-bold text-white">{(result.features.edge_density * 100).toFixed(1)}%</div>
                      <div className="text-xs text-slate-400">Edge Density</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-lg font-bold text-red-400">{(result.features.redness_index * 100).toFixed(1)}%</div>
                      <div className="text-xs text-slate-400">Redness Index</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-lg font-bold text-purple-400">{(result.features.dark_spot_ratio * 100).toFixed(1)}%</div>
                      <div className="text-xs text-slate-400">Dark Spots</div>
                    </div>
                  </div>
                )}

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5 mb-8">
                  <h4 className="text-indigo-400 font-semibold mb-2">Recommendation</h4>
                  <p className="text-indigo-200 leading-relaxed">
                    {result.recommendation}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                  <button 
                    onClick={() => {setResult(null); setSelectedImage(null); setFile(null);}}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Analyze New Photo
                  </button>
                  <EnhancedPDFExport 
                    predictions={[{
                      disease: 'Skin Analysis',
                      prediction: result.prediction,
                      confidence: result.confidence,
                      riskLevel: result.severity,
                      timestamp: new Date().toLocaleTimeString(),
                      details: {}
                    }]} 
                    patientName="User" 
                    patientId="SKIN-CHECK"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full bg-slate-900/30 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center opacity-70">
                <div className="w-48 h-48 bg-slate-800 rounded-2xl mb-8 flex items-center justify-center border border-white/5">
                  <Upload className="w-16 h-16 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Awaiting Image</h3>
                <p className="text-slate-500 max-w-sm">
                  Upload an image on the left. Our CNN model will analyze the lesion&apos;s texture, borders, and coloration to provide a diagnosis.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Webcam Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl overflow-hidden shadow-2xl w-full max-w-2xl">
            <div className="p-4 bg-slate-800/50 flex justify-between items-center border-b border-white/5">
              <h3 className="text-white font-bold flex items-center"><Camera className="w-5 h-5 mr-2 text-indigo-400"/> Capture Skin Photo</h3>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white transition-colors">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="max-h-full max-w-full object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Overlay guides */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-indigo-500/50 rounded-full opacity-50"></div>
              </div>
            </div>
            <div className="p-6 bg-slate-900 flex justify-center">
              <button 
                onClick={capturePhoto}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full w-16 h-16 flex items-center justify-center border-4 border-slate-800 shadow-[0_0_0_4px_rgba(79,70,229,0.5)] transition-transform hover:scale-105"
              >
                <div className="w-6 h-6 bg-white rounded-full"></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
