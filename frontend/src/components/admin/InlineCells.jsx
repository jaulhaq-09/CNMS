import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TRIGGER =
  'inline-flex items-center max-w-[180px] rounded-md px-1.5 py-0.5 -mx-1.5 cursor-pointer border border-transparent hover:border-[#C9962C]/50 hover:bg-[#C9962C]/5 transition-colors text-left'
const LOCKED = 'inline-flex items-center max-w-[180px] px-1.5 py-0.5 -mx-1.5 cursor-default'

/**
 * Click the cell, pick a value from a dropdown, and it saves straight away.
 * `onSave` should throw if saving failed (the page shows the error message).
 */
export function SelectCell({ value, options, onSave, disabled, title, children }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => {
    if (editing) selectRef.current?.focus()
  }, [editing])

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
        onClick={() => setEditing(true)}
        title="Click to edit"
        className={`${TRIGGER} ${busy ? 'opacity-50' : ''}`}
      >
        {children}
      </button>
    )
  }

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={async (e) => {
        const next = e.target.value
        setEditing(false)
        if (next === value) return
        setBusy(true)
        try {
          await onSave(next)
        } catch (err) {
          // the page already showed the error
        } finally {
          setBusy(false)
        }
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
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
 * Click the cell, tick the values you want in a small popup, press Save.
 * `loadOptions` returns a list of names (strings).
 */
export function ChecklistCell({ values, loadOptions, onSave, disabled, title, children }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState(null)
  const [draft, setDraft] = useState([])
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
    setDraft(values || [])
    setOptions(null)
    setOpen(true)
    try {
      setOptions(await loadOptions())
    } catch (err) {
      setOptions([])
    }
  }

  const toggle = (name) =>
    setDraft((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))

  const save = async () => {
    setBusy(true)
    try {
      await onSave(draft)
      setOpen(false)
    } catch (err) {
      // the page already showed the error
    } finally {
      setBusy(false)
    }
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
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0" onClick={() => !busy && setOpen(false)} />
            <div
              style={{ top: pos.top, left: pos.left }}
              className="absolute w-64 bg-white border border-[#E4E7EC] rounded-lg shadow-xl p-3 space-y-3"
            >
              {options === null ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : options.length === 0 ? (
                <p className="text-xs text-gray-400">Nothing to choose from yet.</p>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {options.map((name) => (
                    <label
                      key={name}
                      className="flex items-center gap-2 text-sm text-[#1B2340] px-1.5 py-1 rounded hover:bg-[#F5F6F8] cursor-pointer"
                    >
                      <input type="checkbox" checked={draft.includes(name)} onChange={() => toggle(name)} />
                      {name}
                    </label>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || options === null}
                  className="px-3 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-medium disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
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
export function TextCell({ value, onSave, type = 'text', placeholder, confirmMessage, disabled, title, children }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const cancelled = useRef(false)

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
    if (cancelled.current) return
    const next = draft.trim()
    setEditing(false)
    if (!next || next === value) return
    const question = confirmMessage?.(next)
    if (question && !window.confirm(question)) return
    setBusy(true)
    try {
      await onSave(next)
    } catch (err) {
      // the page already showed the error
    } finally {
      setBusy(false)
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