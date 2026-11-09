import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import settingsService from '../../services/settingsService'

const SECTIONS = [
  { key: 'institute', label: 'Institute' },
  { key: 'contact', label: 'Contact' },
  { key: 'newsletter', label: 'Newsletter' },
]

const EMPTY = {
  instituteName: '',
  vision: '',
  mission: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  principalName: '',
  principalTitle: 'Principal',
  currentVolume: 1,
  currentIssue: 1,
  editorialBoard: [{ name: '', role: '' }],
}

const INPUT_CLASS =
  'w-full border border-[#E4E7EC] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#C9962C] transition-colors'
const LABEL_CLASS = 'block text-xs font-medium text-[#667085] mb-1'

export default function InstituteSettingsPanel({ open, onClose }) {
  const [section, setSection] = useState('institute')
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError('')
        const response = await settingsService.get()
        const s = response.data || {}
        if (cancelled) return
        setForm({
          instituteName: s.instituteName || '',
          vision: s.vision || '',
          mission: s.mission || '',
          address: s.address || '',
          phone: s.phone || '',
          email: s.email || '',
          website: s.website || '',
          principalName: s.principalName || '',
          principalTitle: s.principalTitle || 'Principal',
          currentVolume: s.currentVolume || 1,
          currentIssue: s.currentIssue || 1,
          editorialBoard: s.editorialBoard?.length ? s.editorialBoard : [{ name: '', role: '' }],
        })
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const setField = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }))

  const updateMember = (index, field) => (e) =>
    setForm((prev) => ({
      ...prev,
      editorialBoard: prev.editorialBoard.map((m, i) =>
        i === index ? { ...m, [field]: e.target.value } : m
      ),
    }))
  const addMember = () =>
    setForm((prev) => ({ ...prev, editorialBoard: [...prev.editorialBoard, { name: '', role: '' }] }))
  const removeMember = (index) =>
    setForm((prev) => ({
      ...prev,
      editorialBoard: prev.editorialBoard.filter((_, i) => i !== index),
    }))

  // Each section saves only its own fields.
  const buildPayload = () => {
    if (section === 'institute') {
      if (!form.instituteName.trim()) throw new Error('Institute name is required.')
      return {
        instituteName: form.instituteName.trim(),
        vision: form.vision.trim(),
        mission: form.mission.trim(),
      }
    }
    if (section === 'contact') {
      const website = form.website.trim()
      if (website && !/^https?:\/\//i.test(website)) {
        throw new Error('Website should start with http:// or https://')
      }
      return {
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        website,
      }
    }
    const volume = Number(form.currentVolume)
    const issue = Number(form.currentIssue)
    if (!Number.isInteger(volume) || volume < 1 || !Number.isInteger(issue) || issue < 1) {
      throw new Error('Volume and issue must be whole numbers, 1 or higher.')
    }
    return {
      principalName: form.principalName.trim(),
      principalTitle: form.principalTitle.trim() || 'Principal',
      currentVolume: volume,
      currentIssue: issue,
      editorialBoard: form.editorialBoard.filter((m) => m.name.trim() && m.role.trim()),
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    let payload
    try {
      payload = buildPayload()
    } catch (validationError) {
      setError(validationError.message)
      return
    }
    try {
      setSaving(true)
      await settingsService.update(payload)
      toast.success('Settings saved')
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to save settings'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Institute settings">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      <div className="relative w-full max-w-[520px] h-full bg-white shadow-2xl flex flex-col animate-[fadeInUp_0.2s_ease-out]">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-[#E4E7EC]">
          <div>
            <h2 className="font-serif font-semibold text-xl text-[#1B2340]">Institute settings</h2>
            <p className="text-xs text-[#667085] mt-1">
              Used on every newsletter and report. Only Admin can change these.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#667085] hover:bg-[#F5F6F8]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b border-[#E4E7EC]">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSection(s.key)
                setError('')
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                section === s.key
                  ? 'bg-[#1B2340] text-white border-[#1B2340]'
                  : 'bg-white text-[#667085] border-[#E4E7EC] hover:bg-[#F5F6F8]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 px-6 py-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-1/4 bg-[#F2F4F7] rounded animate-pulse" />
                <div className="h-9 w-full bg-[#F2F4F7] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
                  {error}
                </div>
              )}

              {section === 'institute' && (
                <>
                  <div>
                    <label htmlFor="is-name" className={LABEL_CLASS}>Institute name</label>
                    <input
                      id="is-name"
                      value={form.instituteName}
                      onChange={setField('instituteName')}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="is-vision" className={LABEL_CLASS}>Vision</label>
                    <textarea
                      id="is-vision"
                      rows={4}
                      value={form.vision}
                      onChange={setField('vision')}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="is-mission" className={LABEL_CLASS}>Mission</label>
                    <textarea
                      id="is-mission"
                      rows={4}
                      value={form.mission}
                      onChange={setField('mission')}
                      className={INPUT_CLASS}
                    />
                    <p className="text-[11px] text-[#98A2B3] mt-1">
                      Vision and Mission appear on the newsletter cover. Leave both empty to skip that block.
                    </p>
                  </div>
                </>
              )}

              {section === 'contact' && (
                <>
                  <div>
                    <label htmlFor="is-address" className={LABEL_CLASS}>Address</label>
                    <input
                      id="is-address"
                      value={form.address}
                      onChange={setField('address')}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="is-phone" className={LABEL_CLASS}>Phone</label>
                      <input
                        id="is-phone"
                        value={form.phone}
                        onChange={setField('phone')}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="is-email" className={LABEL_CLASS}>Email</label>
                      <input
                        id="is-email"
                        type="email"
                        value={form.email}
                        onChange={setField('email')}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="is-website" className={LABEL_CLASS}>Website</label>
                    <input
                      id="is-website"
                      value={form.website}
                      onChange={setField('website')}
                      placeholder="https://"
                      className={INPUT_CLASS}
                    />
                  </div>
                </>
              )}

              {section === 'newsletter' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="is-principal" className={LABEL_CLASS}>Principal name</label>
                      <input
                        id="is-principal"
                        value={form.principalName}
                        onChange={setField('principalName')}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="is-title" className={LABEL_CLASS}>Title</label>
                      <input
                        id="is-title"
                        value={form.principalTitle}
                        onChange={setField('principalTitle')}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="is-volume" className={LABEL_CLASS}>Current volume</label>
                      <input
                        id="is-volume"
                        type="number"
                        min="1"
                        value={form.currentVolume}
                        onChange={setField('currentVolume')}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="is-issue" className={LABEL_CLASS}>Current issue</label>
                      <input
                        id="is-issue"
                        type="number"
                        min="1"
                        value={form.currentIssue}
                        onChange={setField('currentIssue')}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#98A2B3] -mt-2">
                    The issue number goes up by one each time a newsletter is generated. Fix it here if you
                    delete a draft.
                  </p>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`${LABEL_CLASS} mb-0`}>Editorial board</p>
                      <button
                        type="button"
                        onClick={addMember}
                        className="text-xs text-[#C9962C] font-medium hover:underline"
                      >
                        + Add member
                      </button>
                    </div>
                    <div className="space-y-2">
                      {form.editorialBoard.map((member, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            placeholder="Name"
                            value={member.name}
                            onChange={updateMember(index, 'name')}
                            className={`flex-1 ${INPUT_CLASS}`}
                          />
                          <input
                            placeholder="Role (e.g. Editor)"
                            value={member.role}
                            onChange={updateMember(index, 'role')}
                            className={`flex-1 ${INPUT_CLASS}`}
                          />
                          {form.editorialBoard.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMember(index)}
                              aria-label="Remove member"
                              className="text-red-500 text-sm px-2 hover:text-red-700"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E4E7EC] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold px-5 py-2 rounded-md hover:brightness-105 transition-all disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save this section'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}