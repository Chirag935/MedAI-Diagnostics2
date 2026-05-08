'use client'

/**
 * TP = "Translate Phrase" — a wrapper that recursively walks its children
 * and replaces every English string node with its Hindi translation
 * (when language is Hindi). Strings not in the phrase dictionary pass
 * through unchanged. This avoids having to wrap every visible string
 * with t() on every page.
 *
 * Usage: wrap a page section with <TP>...</TP>.
 *
 * Caveats:
 *   - Does NOT translate string values passed via props like `placeholder`,
 *     `title`, or `aria-label`. Those still need explicit tp() calls.
 *   - Does NOT translate dynamic data from APIs (medicine names, patient
 *     names, etc.) — only literal strings present in the JSX source.
 */

import { Children, cloneElement, isValidElement, ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'

function walk(node: ReactNode, tp: (s: string) => string): ReactNode {
  if (node == null || typeof node === 'boolean') return node
  if (typeof node === 'string') return tp(node)
  if (typeof node === 'number') return node
  if (Array.isArray(node)) return node.map((c, i) => {
    const w = walk(c, tp)
    return isValidElement(w) && w.key == null ? cloneElement(w, { key: i }) : w
  })
  if (isValidElement(node)) {
    const props: any = node.props || {}
    const newProps: any = {}
    // Translate select string props that are commonly user-visible
    if (typeof props.placeholder === 'string') newProps.placeholder = tp(props.placeholder)
    if (typeof props.title === 'string') newProps.title = tp(props.title)
    if (typeof props['aria-label'] === 'string') newProps['aria-label'] = tp(props['aria-label'])
    if (props.children !== undefined) {
      newProps.children = walk(props.children, tp)
    }
    return Object.keys(newProps).length ? cloneElement(node, newProps) : node
  }
  return node
}

export function TP({ children }: { children: ReactNode }) {
  const { tp } = useLanguage()
  return <>{walk(children, tp)}</>
}

export default TP
