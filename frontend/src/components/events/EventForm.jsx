import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import usePermissions from '../../hooks/usePermissions'
import { PERMISSIONS } from '../../config/permissions'
import toast from 'react-hot-toast'
import eventService from '../../services/eventService'
import departmentService from '../../services/departmentService'
import { useSearchParams } from 'react-router-dom'
import { useFormDraft, DraftRestoredBanner } from '../../hooks/useFormDraft'

const EVENT_TYPES = ['Conference', 'Workshop', 'Seminar', 'Sports', 'Cultural', 'Academic', 'Social', 'Other']

const ACTIVITY_CATEGORIES = [
  { value: 'EVENTS_CONDUCTED', label: 'Event Conducted' },
  { value: 'RESOURCE_PERSON', label: 'Faculty as Resource Person' },
  { value: 'WORKSHOP_ORGANIZED', label: 'Student Workshop / Event Organized' },
  { value: 'ALUMNI_INTERACTION', label: 'Alumni Interaction' },
  { value: 'FDP_ORGANIZED', label: 'Faculty FDP Organized' },
  { value: 'MOU', label: 'Memorandum of Understanding' },
  { value: 'STUDENT_ACHIEVEMENT', label: 'Student Achievement' },
  { value: 'PROFESSIONAL_ACTIVITY', label: 'Professional Activity' },
  { value: 'INDUSTRIAL_VISIT', label: 'Industrial Visit' },
  { value: 'COLLABORATIVE_RESEARCH', label: 'Collaborative Research' },
  { value: 'BICEP_ACTIVITY', label: 'BICEP Activity' },
  { value: 'CLUB_ACTIVITY', label: 'Club Activity' },
  { value: 'PLACEMENT_ACTIVITY', label: 'Placement Activity' },
  { value: 'HEC_EVENT', label: 'HEC Event' },
  { value: 'SPORTS', label: 'Sports Event' },
  { value: 'NCC', label: 'NCC Activity' },
  { value: 'NSS', label: 'NSS Event' },
  { value: 'OTHER', label: 'Other' },
]

export default function EventForm({ onPosted }) {
  const { can, scope } = usePermissions()
  const user = useSelector((state) => state.auth?.user)

  const [form, setForm] = useState({
    eventName: '',
    description: '',
    eventType: '',
    eventDate: '',
    eventTime: '',
    location: '',
    expectedAttendance: '',
    cluster: '',
    section: '',
  })
  const [participants, setParticipants] = useState([{ usn: '', name: '', department: '' }])
  const [allDepartments, setAllDepartments] = useState([])
  const [coDepartments, setCoDepartments] = useState([])
  const [searchParams] = useSearchParams()
  const [activityCategory, setActivityCategory] = useState(searchParams.get('category') || 'EVENTS_CONDUCTED')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [verified, setVerified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const draftKey = `cnms_draft_event_${user?._id || 'anon'}`
  const { draftRestored, clearDraft } = useFormDraft(draftKey, form, setForm)

  useEffect(() => {
    departmentService.getAll().then((res) => setAllDepartments(res.data)).catch(() => {})
  }, [])

  if (!can(PERMISSIONS.EVENTS_CREATE)) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        You don&apos;t have permission to post events.
      </div>
    )
  }

  // No assigned clusters/sections means there's nothing valid to post
  // under yet — an admin needs to assign this account before they can
  // post, rather than silently letting them post into nothing.
  if (scope.clusters.length === 0 || scope.sections.length === 0) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        Your account isn&apos;t assigned to any cluster/section yet. Ask your department admin
        to add these to your profile before you can post an event.
      </div>
    )
  }

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const updateParticipant = (index, field) => (e) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: e.target.value } : p))
    )
  }

  const addParticipantRow = () => {
    setParticipants((prev) => [...prev, { usn: '', name: '', department: '' }])
  }

  const removeParticipantRow = (index) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleCoDepartment = (deptId) => {
    setCoDepartments((prev) =>
      prev.includes(deptId) ? prev.filter((d) => d !== deptId) : [...prev, deptId]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.cluster || !form.section) {
      setError('Please select which cluster and section this event is for.')
      return
    }

    if (!verified) {
      setError('Please confirm you have verified all details before submitting.')
      return
    }

    const validParticipants = participants.filter((p) => p.usn.trim() && p.name.trim() && p.department.trim())

    setSubmitting(true)
    try {
      const response = await eventService.create({
        eventName: form.eventName,
        description: form.description,
        eventType: form.eventType,
        eventDate: form.eventDate,
        eventTime: form.eventTime || undefined,
        location: form.location || undefined,
        expectedAttendance: form.expectedAttendance ? Number(form.expectedAttendance) : undefined,
        organizer: user?._id,
        organizerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        department: scope.departmentId,
        cluster: form.cluster,
        section: form.section,
        participants: validParticipants,
        coDepartments,
        activityCategory,
      })

      const event = response.data
      const eventId = event.id || event._id

      if (selectedFiles.length > 0) {
        try {
          await eventService.uploadPhotos(eventId, selectedFiles)
        } catch (photoErr) {
          // Don't fail the whole submission over a photo upload issue —
          // the event itself was created successfully, just flag it.
          toast.error(
            photoErr.response?.data?.message || 'Event posted, but photo upload failed.'
          )
        }
      }

      await eventService.submit(eventId)

      setForm({
        eventName: '',
        description: '',
        eventType: '',
        eventDate: '',
        eventTime: '',
        location: '',
        expectedAttendance: '',
        cluster: '',
        section: '',
      })
      setParticipants([{ usn: '', name: '', department: '' }])
      setCoDepartments([])
      setActivityCategory('EVENTS_CONDUCTED')
      setSelectedFiles([])
      setVerified(false)
      clearDraft()
      onPosted?.(event)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not post the event. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-4 animate-[fadeInUp_0.2s_ease-out]">
      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearDraft}
          message="Your in-progress event details were restored from your previous session."
        />
      )}
      <div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold mb-2">
          Department
        </p>
        <span className="inline-block px-2.5 py-1 rounded-full bg-[#F5F6F8] text-[#1B2340] font-medium text-xs">
          {typeof user?.department === 'object' ? user.department?.name : 'Department on file'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Cluster</label>
          <select
            required
            value={form.cluster}
            onChange={update('cluster')}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
          >
            <option value="" disabled>Select a cluster</option>
            {scope.clusters.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Section</label>
          <select
            required
            value={form.section}
            onChange={update('section')}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
          >
            <option value="" disabled>Select a section</option>
            {scope.sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Event name</label>
        <input
          type="text"
          required
          value={form.eventName}
          onChange={update('eventName')}
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Event type</label>
        <select
          required
          value={form.eventType}
          onChange={update('eventType')}
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
        >
          <option value="" disabled>Select a type</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Date</label>
          <input
            type="date"
            required
            value={form.eventDate}
            onChange={update('eventDate')}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Time (optional)</label>
          <input
            type="time"
            value={form.eventTime}
            onChange={update('eventTime')}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Location (optional)</label>
        <input
          type="text"
          value={form.location}
          onChange={update('location')}
          placeholder="e.g. Seminar Hall B"
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Expected attendance (optional)</label>
        <input
          type="number"
          min="0"
          value={form.expectedAttendance}
          onChange={update('expectedAttendance')}
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Description</label>
        <textarea
          rows={4}
          required
          value={form.description}
          onChange={update('description')}
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-[#1B2340]">
            Participating students (optional)
          </label>
          <button
            type="button"
            onClick={addParticipantRow}
            className="text-xs text-[#C9962C] font-medium hover:underline"
          >
            + Add student
          </button>
        </div>
        <div className="space-y-2">
          {participants.map((p, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-1.5 rounded-md hover:bg-[#F5F6F8] transition-colors">
              <input
                type="text"
                placeholder="USN"
                value={p.usn}
                onChange={updateParticipant(index, 'usn')}
                className="px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
              <input
                type="text"
                placeholder="Student name"
                value={p.name}
                onChange={updateParticipant(index, 'name')}
                className="px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
              <input
                type="text"
                placeholder="Department"
                value={p.department}
                onChange={updateParticipant(index, 'department')}
                className="px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParticipantRow(index)}
                  className="text-red-500 text-sm px-2 hover:text-red-700"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {allDepartments.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Jointly organized with other departments? (optional)
          </label>
          <p className="text-xs text-[#98A2B3] mb-2">
            If this activity was co-organized, select the other departments here instead of
            having them submit a separate report.
          </p>
          <div className="flex flex-wrap gap-3">
            {allDepartments
              .filter((d) => d._id !== scope.departmentId)
              .map((d) => (
                <label
                  key={d._id}
                  className="flex items-center gap-1.5 text-sm text-[#334155] px-2 py-1 rounded-md hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={coDepartments.includes(d._id)}
                    onChange={() => toggleCoDepartment(d._id)}
                  />
                  {d.name}
                </label>
              ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">
          Which newsletter section does this belong to?
        </label>
        <select
          value={activityCategory}
          onChange={(e) => setActivityCategory(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
        >
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1B2340] mb-1.5">
          Photos (optional)
        </label>
        <p className="text-xs text-[#98A2B3] mb-2">
          Original, high-resolution photos only — no collages or merged images. Minimum 800×600.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="text-sm"
        />
        {selectedFiles.length > 0 && (
          <p className="text-xs text-[#667085] mt-1">{selectedFiles.length} photo(s) selected</p>
        )}
      </div>

      <div className="bg-[#F5F6F8] rounded-md p-3">
        <label className="flex items-start gap-2 text-xs text-[#334155]">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            className="mt-0.5"
          />
          I confirm I have verified all names, dates, photographs, and formatting in this
          report before submitting.
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !verified}
        className="px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {submitting ? 'Posting...' : 'Post event'}
      </button>
    </form>
  )
}