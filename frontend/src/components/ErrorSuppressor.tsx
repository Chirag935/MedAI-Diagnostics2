'use client'

import { useEffect } from 'react'

export default function ErrorSuppressor() {
  useEffect(() => {
    // Suppress Chrome extension errors
    const originalError = console.error
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || ''
      // Filter out Chrome extension message channel errors
      if (
        message.includes('message channel closed') ||
        message.includes('Extension context invalidated') ||
        message.includes('forward-logs')
      ) {
        return
      }
      originalError.apply(console, args)
    }

    // Cleanup: restore original console.error on unmount
    return () => {
      console.error = originalError
    }
  }, [])

  return null
}
