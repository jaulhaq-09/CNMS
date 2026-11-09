import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Trash2, CheckCircle2 } from 'lucide-react'

/**
 * Hook to auto-save in-progress work to localStorage and restore it
 * across logins, page reloads, and tab navigation.
 */
export function useFormDraft(draftKey, formState, setFormState, isReady = true) {
  const [draftRestored, setDraftRestored] = useState(false)
  const isInitialMount = useRef(true)

  // Restore draft on mount
  useEffect(() => {
    if (!draftKey) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          // If it's an object with keys, only restore if it has non-empty values
          const hasContent = Array.isArray(parsed)
            ? parsed.length > 0
            : Object.values(parsed).some((v) => v !== '' && v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0))

          if (hasContent) {
            setFormState((prev) => (Array.isArray(parsed) ? parsed : { ...prev, ...parsed }))
            setDraftRestored(true)
          }
        }
      }
    } catch (err) {
      console.warn('Draft restore error:', err)
    }
  }, [draftKey])

  // Auto-save changes (debounced by 400ms)
  useEffect(() => {
    if (!draftKey || !isReady) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(formState))
      } catch (err) {
        console.warn('Draft save error:', err)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [draftKey, formState, isReady])

  const clearDraft = () => {
    if (draftKey) {
      localStorage.removeItem(draftKey)
      setDraftRestored(false)
    }
  }

  return { draftRestored, setDraftRestored, clearDraft }
}

/**
 * Notice banner displayed at the top of forms when an in-progress draft is restored
 */
export function DraftRestoredBanner({ onClear, message }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg text-xs text-amber-900 shadow-sm mb-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <span className="font-medium">
          {message || 'Unsaved work from your previous session was automatically restored so you can continue where you left off.'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-800 hover:text-amber-950 font-medium"
        >
          Dismiss
        </button>
        {onClear && (
          <button
            type="button"
            onClick={() => {
              onClear()
              setDismissed(true)
            }}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold underline"
          >
            <Trash2 size={12} /> Clear Draft
          </button>
        )}
      </div>
    </div>
  )
}

