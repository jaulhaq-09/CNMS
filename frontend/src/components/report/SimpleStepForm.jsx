import React, { useEffect, useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Field, inputClass } from './formKit'

export const MAX_PHOTOS = 3
export const MAX_DESCRIPTION = 3000
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const todayISO = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const EMPTY_SIMPLE = { nil: false, date: '', description: '', files: [], lostPhotos: 0 }

export function simpleProblem(item) {
  if (!item) return 'Not filled in yet.'
  if (!item.date) return 'Select a date.'
  if (!item.description.trim()) return 'Add a description.'
  return null
}

/**
 * Fully controlled: every change goes straight to the wizard's state, so
 * jumping to another section never loses what was typed.
 */
export default function SimpleStepForm({ value, onChange, showErrors, hint, idPrefix = 'simple' }) {
  const item = { ...EMPTY_SIMPLE, ...(value || {}) }
  const [photoError, setPhotoError] = useState('')

  const previews = useMemo(() => item.files.map((f) => URL.createObjectURL(f)), [item.files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const dateError = showErrors && !item.date ? 'Select a date.' : ''
  const descError = showErrors && !item.description.trim() ? 'Add a description.' : ''

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    const ok = picked.filter((f) => PHOTO_TYPES.includes(f.type))
    let msg = ok.length < picked.length ? 'Only JPEG, PNG or WebP photos are allowed.' : ''
    const merged = [...item.files, ...ok]
    if (merged.length > MAX_PHOTOS) msg = `You can attach up to ${MAX_PHOTOS} photos per section.`
    setPhotoError(msg)
    onChange({ files: merged.slice(0, MAX_PHOTOS) })
  }

  const removeFile = (index) => {
    setPhotoError('')
    onChange({ files: item.files.filter((_, i) => i !== index) })
  }

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-5 animate-[fadeInUp_0.2s_ease-out]">
      <>
        <Field label="Date" htmlFor={`${idPrefix}-date`} error={dateError} className="max-w-xs">
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={item.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className={inputClass(dateError)}
          />
        </Field>

        <Field
          label="Description"
          htmlFor={`${idPrefix}-desc`}
          error={descError}
          hint={`${hint ? `Include: ${hint} ` : ''}(${item.description.length}/${MAX_DESCRIPTION})`}
        >
          <textarea
            id={`${idPrefix}-desc`}
            maxLength={MAX_DESCRIPTION}
            placeholder="Describe the activity in detail…"
            rows={10}
            value={item.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className={inputClass(descError)}
          />
        </Field>

        <div>
          <p className="block text-sm font-medium text-[#1B2340] mb-1">Photos (optional)</p>
          <p className="text-xs text-[#98A2B3] mb-2">
            Up to {MAX_PHOTOS}. Any photo from your phone, camera or drone works. Large photos are resized automatically.
          </p>

          {item.files.length === 0 && item.lostPhotos > 0 && (
            <p className="text-xs text-[#B07C1F] bg-[#FBF3E7] rounded-md px-3 py-2 mb-2">
              You had attached {item.lostPhotos} photo(s) before the page was refreshed. Photos
              aren&apos;t kept on refresh, so please attach them again.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {previews.map((src, index) => (
              <div key={src} className="relative w-24 h-24 rounded-lg overflow-hidden border border-[#E4E7EC]">
                <img src={src} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {item.files.length < MAX_PHOTOS && (
              <label className="w-24 h-24 rounded-lg border border-dashed border-[#D0D5DD] flex flex-col items-center justify-center gap-1 text-[#667085] text-xs cursor-pointer hover:bg-[#F5F6F8]">
                <ImagePlus size={18} />
                Add photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={addFiles}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {photoError && <p className="text-xs text-[#B42318] mt-2">{photoError}</p>}
        </div>
      </>
    </div>
  )
}