import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatConfidence(confidence: number): string {
  return `${confidence.toFixed(1)}%`
}

export function getRiskColor(riskLevel: string): string {
  switch (riskLevel.toLowerCase()) {
    case 'low':
      return 'text-green-success'
    case 'moderate':
      return 'text-yellow-warning'
    case 'high':
      return 'text-orange-500'
    case 'critical':
      return 'text-red-alert'
    default:
      return 'text-gray-400'
  }
}

export function getRiskBadgeClass(riskLevel: string): string {
  switch (riskLevel.toLowerCase()) {
    case 'low':
      return 'risk-badge-low'
    case 'moderate':
      return 'risk-badge-moderate'
    case 'high':
      return 'risk-badge-high'
    case 'critical':
      return 'risk-badge-critical'
    default:
      return 'bg-gray-500/20 text-gray-500 border border-gray-500/30'
  }
}
