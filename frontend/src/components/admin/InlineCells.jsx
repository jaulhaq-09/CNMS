import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TRIGGER =
  'inline-flex items-center max-w-[180px] rounded-md px-1.5 py-0.5 -mx-1.5 cursor-pointer border border-transparent hover:border-[#C9962C]/50 hover:bg-[#C9962C]/5 transition-colors text-left'
const LOCKED = 'inline-flex items-center max-w-[180px] px-1.5 py-0.5 -mx-1.5 cursor-default'

/**
 * Click the cell, choose a value, then click away to save.
 * `onSave` should throw if saving failed (the page shows the error message).
 */
export function SelectCell({ value, options, onSave, disabled, title, children }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const selectRef = useRef(null)
  const draftRef = useRef(value)
  const cancelled = useRef(false)
  const committing = useRef(false)

  useEffect(() => {
    if (editing) selectRef.current?.focus()
  }, [editing])

  const commit = async () => {
    if (cancelled.current || committing.current) return
    const next = draftRef.current
    setEditing(false)
    if (next === value) return
    committing.current = true
    try {
      await onSave(next)
    } catch (err) {
      // The page already showed the error.
    } finally {
      committing.current = false
    }
  }

  if (disabled) {
    return (
      <span className={LOCKED} title={title}>
        {children}
      </span>
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false
          draftRef.current = value
          setDraft(value)
          setEditing(true)
        }}
        title="Click to edit"
        className={TRIGGER}
      >
        {children}
      </button>
    )
  }

  return (
    <select
      ref={selectRef}
      value={draft}
      onChange={(e) => {
        draftRef.current = e.target.value
        setDraft(e.target.value)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          cancelled.current = true
          setEditing(false)
        }
      }}
      className="border border-[#C9962C] rounded-md px-2 py-1 text-sm bg-white focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Click the cell, change the selected values, then click away to save.
 */
export function ChecklistCell({
  values,
  options,
  onSave,
  disabled,
  title,
  children,
  disabledValues = [],
  labelFor = (value) => value,
  includeNone = false,
  noneLabel = 'None',
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState([])
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const popupRef = useRef(null)
  const draftRef = useRef([])
  const committing = useRef(false)

  const commit = async () => {
    if (committing.current) return
    committing.current = true
    setBusy(true)
    try {
      await onSave(draftRef.current)
      setOpen(false)
    } catch (err) {
      // The page already showed the error.
    } finally {
      committing.current = false
      setBusy(false)
    }
  }

  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onOutsideClick = (e) => {
      if (
        e.target instanceof Node &&
        !buttonRef.current?.contains(e.target) &&
        !popupRef.current?.contains(e.target)
      ) {
        commitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutsideClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutsideClick)
    }
  }, [open])

  if (disabled) {
    return (
      <span className={LOCKED} title={title}>
        {children}
      </span>
    )
  }

  const openPopup = async () => {
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 270)) })
    const selected = values || []
    draftRef.current = selected
    setDraft(selected)
    setOpen(true)
  }

  const toggle = (name) => {
    const next = draftRef.current.includes(name)
      ? draftRef.current.filter((n) => n !== name)
      : [...draftRef.current, name]
    draftRef.current = next
    setDraft(next)
  }

  const clearSelection = () => {
    draftRef.current = []
    setDraft([])
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openPopup}
        title="Click to edit"
        className={TRIGGER}
      >
        {children}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div
              ref={popupRef}
              style={{ top: pos.top, left: pos.left }}
              className="absolute pointer-events-auto w-64 bg-white border border-[#E4E7EC] rounded-lg shadow-xl p-3"
            >
              <div className="max-h-52 overflow-y-auto space-y-1">
                {includeNone && (
                  <label className="flex items-center gap-2 text-sm text-[#1B2340] px-1.5 py-1 rounded hover:bg-[#F5F6F8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.length === 0}
                      disabled={busy}
                      onChange={clearSelection}
                    />
                    {noneLabel}
                  </label>
                )}
                {options.map((name) => (
                  <label
                    key={name}
                    className={`flex items-center gap-2 text-sm text-[#1B2340] px-1.5 py-1 rounded ${
                      disabledValues.includes(name) ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#F5F6F8] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.includes(name)}
                      disabled={disabledValues.includes(name) || busy}
                      onChange={() => toggle(name)}
                    />
                    {labelFor(name)}
                  </label>
                ))}
              </div>
              {busy && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

/**
 * Click the cell, type, press Enter (or click away) to save, Esc to cancel.
 * `confirmMessage(newValue)` may return a question to ask before saving.
 */
export function TextCell({
  value,
  onSave,
  type = 'text',
  placeholder,
  confirmMessage,
  disabled,
  title,
  children,
  allowEmpty = false,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const cancelled = useRef(false)
  const committing = useRef(false)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (disabled) {
    return (
      <span className={LOCKED} title={title}>
        {children}
      </span>
    )
  }

  const commit = async () => {
    if (cancelled.current || committing.current) return
    const next = draft.trim()
    setEditing(false)
    if ((!next && !allowEmpty) || next === value) return
    const question = confirmMessage?.(next)
    if (question && !window.confirm(question)) return
    committing.current = true
    setBusy(true)
    try {
      await onSave(next)
    } catch (err) {
      // the page already showed the error
    } finally {
      setBusy(false)
      committing.current = false
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false
          setDraft(value || '')
          setEditing(true)
        }}
        title="Click to edit"
        className={`${TRIGGER} ${busy ? 'opacity-50' : ''}`}
      >
        {children}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') {
          cancelled.current = true
          setEditing(false)
        }
      }}
      className="w-56 border border-[#C9962C] rounded-md px-2 py-1 text-sm bg-white focus:outline-none"
    />
  )
}