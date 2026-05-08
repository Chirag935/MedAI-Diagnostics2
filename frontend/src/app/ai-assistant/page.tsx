'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, Bot, User, Sparkles, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { API } from '@/lib/api-config'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  mode?: string
}

export default function AIAssistant() {
  const router = useRouter()
  const { sessionPredictions } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Build RAG context from session predictions — only when user asks about it
  const buildDiagnosticContext = (userMessage: string) => {
    if (sessionPredictions.length === 0) return ''
    // Only inject context if user explicitly asks about their diagnosis
    const triggerWords = ['my diagnosis', 'my results', 'my test', 'my report', 'what did', 'checker said', 'analyzer said', 'predicted', 'my condition']
    const lower = userMessage.toLowerCase()
    const shouldInject = triggerWords.some(t => lower.includes(t))
    if (!shouldInject) return ''
    return sessionPredictions.map(p => 
      `Module: ${p.disease} | Prediction: ${p.prediction} | Confidence: ${(p.confidence * 100).toFixed(1)}% | Severity: ${p.riskLevel}`
    ).join('\n')
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API.chat}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          diagnostic_context: buildDiagnosticContext(userMessage.content),
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString(),
        mode: data.mode,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not reach the AI backend. Please check your connection or contact support if the issue persists.',
        timestamp: new Date().toLocaleTimeString(),
        mode: 'error',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickPrompts = [
    "What are the symptoms of diabetes?",
    "How can I prevent skin cancer?",
    "Explain my diagnosis in simple terms",
    "What foods should I avoid for eczema?",
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">MedAI Assistant</h1>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Powered by Llama 3 (RAG)
                </p>
              </div>
            </div>
          </div>
          {sessionPredictions.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-purple-300 font-medium">
                {sessionPredictions.length} diagnosis context loaded
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {messages.length === 0 ? (
            <div className="text-center py-16 animate-fadeIn">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center mb-8 border border-purple-500/20">
                <Bot className="w-12 h-12 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Hi! I&apos;m your AI Health Assistant
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto mb-10 text-lg">
                Ask me anything about your health, symptoms, or diagnostic results. I use your session data to provide personalized, context-aware guidance.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(prompt); }}
                    className="text-left p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:border-purple-500/30 hover:bg-slate-800/50 transition-all text-sm text-slate-300 group"
                  >
                    <span className="text-purple-400 mr-2 group-hover:text-purple-300">→</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-4 animate-fadeIn ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mt-1">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                      msg.role === 'user'
                        ? 'bg-purple-500/20 border border-purple-500/30 text-purple-100'
                        : 'bg-slate-800/80 border border-white/5 text-slate-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                          .replace(/\n/g, '<br/>')
                          .replace(/- /g, '• ')
                      }}
                    />
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                      <span className="text-xs text-slate-500">{msg.timestamp}</span>
                      {msg.mode && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          msg.mode === 'online' 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : msg.mode === 'error'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {msg.mode === 'online' ? '● LLM' : msg.mode === 'error' ? '● Error' : '● Offline'}
                        </span>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center mt-1">
                      <User className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 animate-fadeIn">
                  <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mt-1">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-slate-800/80 border border-white/5 rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 bg-slate-900/80 backdrop-blur-md sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about your symptoms, diagnosis, or any health question..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-3 px-5 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2 text-center">
            MedAI Clinical AI Consultant — Powered by Retrieval-Augmented Generation (RAG)
          </p>
        </div>
      </div>
    </div>
  )
}
