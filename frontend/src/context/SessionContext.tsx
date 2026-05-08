'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'

// STORAGE KEY for session persistence
const STORAGE_KEY = 'medai_session_predictions'

interface PredictionRecord {
  disease: string
  prediction: string
  confidence: number
  riskLevel: string
  timestamp: string
  explanation?: string
  details?: Record<string, any>
  inputs?: Record<string, any>
}

interface SessionContextType {
  sessionPredictions: PredictionRecord[]
  addSessionPrediction: (prediction: PredictionRecord) => void
  clearSessionPredictions: () => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

// Helper to safely access localStorage
const getStoredPredictions = (): PredictionRecord[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('Loaded predictions from localStorage:', parsed)
      return parsed
    }
  } catch (e) {
    console.error('Error reading from localStorage:', e)
  }
  return []
}

const setStoredPredictions = (predictions: PredictionRecord[]) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions))
    console.log('Saved predictions to localStorage:', predictions)
  } catch (e) {
    console.error('Error writing to localStorage:', e)
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionPredictions, setSessionPredictions] = useState<PredictionRecord[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = getStoredPredictions()
    console.log('SessionProvider initializing with stored predictions:', stored)
    setSessionPredictions(stored)
    setIsInitialized(true)
  }, [])

  const addSessionPrediction = useCallback((prediction: PredictionRecord) => {
    console.log('Adding prediction:', prediction)
    setSessionPredictions(prev => {
      const newPredictions = [...prev, prediction]
      setStoredPredictions(newPredictions)
      console.log('New predictions array:', newPredictions)
      return newPredictions
    })
  }, [])

  const clearSessionPredictions = useCallback(() => {
    console.log('Clearing all predictions')
    setSessionPredictions([])
    setStoredPredictions([])
  }, [])

  return (
    <SessionContext.Provider value={{ sessionPredictions, addSessionPrediction, clearSessionPredictions }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
