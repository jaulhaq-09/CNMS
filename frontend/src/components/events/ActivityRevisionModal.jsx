import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Calendar, FileText, Image as ImageIcon, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import eventService from '../../services/eventService'
import publicationService from '../../services/publicationService'
import patentService from '../../services/patentService'
import facultyAchievementService from '../../services/facultyAchievementService'
import { formatDate } from '../../utils/date'

const serviceFor = (itemType) => {
  switch (itemType) {
    case 'publication':
      return publicationService
    case 'patent':
      return patentService
    case 'achievement':
      return facultyAchievementService
    default:
      return eventService
  }
}

export default function ActivityRevisionModal({ item, onClose, onResubmitted }) {
  const itemType = item.itemType || 'event'
  const service = serviceFor(itemType)

  // Find latest rejection comment
  const latestFeedback = useMemo(() => {
    if (!Array.isArray(item.approvalHistory)) return item.feedback || ''
    const rejections = item.approvalHistory.filter(
      (h) => h.action === 'REJECTED' || h.feedback
    )
    if (rejections.length > 0) {
      return rejections[rejections.length - 1].feedback || ''
    }
    return item.feedback || ''
  }, [item])

  const [form, setForm] = useState(() => {
    if (itemType === 'event') {
      return {
        eventName: item.eventName || '',
        description: item.description || '',
        eventDate: item.eventDate ? String(item.eventDate).slice(0, 10) : '',
        location: item.location || '',
      }
    }
    if (itemType === 'publication') {
      return {
        title: item.title || '',
        venueName: item.venueName || '',
        publicationType: item.publicationType || 'JOURNAL',
        authors: Array.isArray(item.authors) ? item.authors.join(', ') : item.authors || '',
        publicationYear: item.publicationYear || '',
      }
    }
    if (itemType === 'patent') {
      return {
        title: item.title || '',
        grantingAuthority: item.grantingAuthority || '',
        grantStatus: item.grantStatus || 'APPLIED',
        inventors: Array.isArray(item.inventors) ? item.inventors.join(', ') : item.inventors || '',
      }
    }
    // achievement
    return {
      title: item.title || '',
      category: item.category || 'AWARD',
      description: item.description || '',
      achievementDate: item.achievementDate ? String(item.achievementDate).slice(0, 10) : '',
    }
  })

  const [newPhotos, setNewPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || [])
    setNewPhotos(files)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const id = item._id || item.id

      // Prepare payload
      let payload = { ...form }
      if (itemType === 'publication' && typeof payload.authors === 'string') {
        payload.authors = payload.authors
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      }
      if (itemType === 'patent' && typeof payload.inventors === 'string') {
        payload.inventors = payload.inventors
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      }

      // 1. Update activity
      await service.update(id, payload)

      // 2. Upload new photos if event
      if (itemType === 'event' && newPhotos.length > 0) {
        await eventService.uploadPhotos(id, newPhotos)
      }

      // 3. Submit for approval
      await service.submit(id)

      toast.success('Revised activity resubmitted to coordinator for review!')
      onResubmitted()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not resubmit this activity.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#101828]/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-[fadeInUp_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7EC] bg-white">
          <div>
            <h3 className="font-serif font-semibold text-xl text-[#1B2340]">
              Revise & Resubmit Activity
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Make requested corrections and send back to your coordinator.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Coordinator feedback comment banner */}
          {latestFeedback && (
            <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#B42318]">
                <AlertCircle size={15} />
                <span>Coordinator's Correction Note:</span>
              </div>
              <p className="text-sm text-[#912018] bg-white/60 p-2.5 rounded-lg border border-[#FECDCA]/60 whitespace-pre-wrap">
                {latestFeedback}
              </p>
            </div>
          )}

          {/* Form fields based on item type */}
          {itemType === 'event' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Event / Activity Name *
                </label>
                <input
                  name="eventName"
                  required
                  value={form.eventName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Date of Event *
                </label>
                <input
                  type="date"
                  name="eventDate"
                  required
                  value={form.eventDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Description / Details *
                </label>
                <textarea
                  rows={4}
                  name="description"
                  required
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Detail the event objectives, outcomes, or corrections requested..."
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Attach Updated Photos (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotosChange}
                  className="block w-full text-xs text-[#667085] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#1B2340] file:text-white hover:file:bg-[#2C3860]"
                />
                {newPhotos.length > 0 && (
                  <p className="text-xs text-[#067647] mt-1">
                    {newPhotos.length} new photo(s) selected
                  </p>
                )}
              </div>
            </>
          )}

          {itemType === 'publication' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Paper / Book Title *
                </label>
                <input
                  name="title"
                  required
                  value={form.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                    Type
                  </label>
                  <select
                    name="publicationType"
                    value={form.publicationType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
                  >
                    <option value="JOURNAL">Journal</option>
                    <option value="CONFERENCE">Conference</option>
                    <option value="BOOK">Book</option>
                    <option value="BOOK_CHAPTER">Book Chapter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    name="publicationYear"
                    value={form.publicationYear}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Venue / Journal / Publisher *
                </label>
                <input
                  name="venueName"
                  required
                  value={form.venueName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Authors (comma-separated) *
                </label>
                <input
                  name="authors"
                  required
                  value={form.authors}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>
            </>
          )}

          {itemType === 'patent' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Patent Title *
                </label>
                <input
                  name="title"
                  required
                  value={form.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                    Status
                  </label>
                  <select
                    name="grantStatus"
                    value={form.grantStatus}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
                  >
                    <option value="APPLIED">Applied</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="GRANTED">Granted</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                    Granting Authority
                  </label>
                  <input
                    name="grantingAuthority"
                    required
                    value={form.grantingAuthority}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Inventors (comma-separated) *
                </label>
                <input
                  name="inventors"
                  required
                  value={form.inventors}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>
            </>
          )}

          {itemType === 'achievement' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Achievement Title *
                </label>
                <input
                  name="title"
                  required
                  value={form.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
                  >
                    <option value="AWARD">Award</option>
                    <option value="GRANT">Grant</option>
                    <option value="CERTIFICATION">Certification</option>
                    <option value="COMMITTEE_ROLE">Committee Role</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="achievementDate"
                    required
                    value={form.achievementDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2340] mb-1">
                  Description *
                </label>
                <textarea
                  rows={4}
                  name="description"
                  required
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>
            </>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E4E7EC]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F2F4F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#1B2340] text-white text-sm font-semibold hover:bg-[#252f52] transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <Send size={15} />
              {submitting ? 'Resubmitting…' : 'Resubmit to Coordinator'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

