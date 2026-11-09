import toast from 'react-hot-toast'
import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import eventService from '../services/eventService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import { formatDate, formatDateTime } from '../utils/date'

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  SUBMITTED: 'bg-[#FBF3E7] text-[#B07C1F]',
  UNDER_REVIEW: 'bg-[#FBF3E7] text-[#B07C1F]',
  APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  PUBLISHED: 'bg-[#EFF4FF] text-[#1B2340]',
}

const ACTIVITY_CATEGORY_LABELS = {
  EVENTS_CONDUCTED: 'Event Conducted',
  RESOURCE_PERSON: 'Faculty as Resource Person',
  WORKSHOP_ORGANIZED: 'Student Workshop / Event Organized',
  ALUMNI_INTERACTION: 'Alumni Interaction',
  FDP_ORGANIZED: 'Faculty FDP Organized',
  SPORTS_NCC: 'Sports / NCC Event',
  OTHER: 'Other',
}

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth?.user)
  const { can, canAccessScope } = usePermissions()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [confirmOriginal, setConfirmOriginal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await eventService.getById(id)
      setEvent(response.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this event.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isOwner = event && user && (event.createdBy?._id || event.createdBy) === user._id
  const canApprove =
    event &&
    event.status === 'SUBMITTED' &&
    can(PERMISSIONS.EVENTS_APPROVE) &&
    canAccessScope({
      departmentId: event.department?._id || event.department,
      clusterId: event.cluster,
      sectionId: event.section,
    })

  const handleApprove = async () => {
    setActioning(true)
    try {
      await eventService.approve(id)
      toast.success('Event approved')
      await load()
    } catch (err) {
      const message = err.response?.data?.message || 'Could not approve this event.'
      setError(message)
      toast.error(message)
    } finally {
      setActioning(false)
    }
  }

  const handleReject = async () => {
    if (!feedback.trim()) {
      setError('Feedback is required to reject an event.')
      return
    }
    setActioning(true)
    try {
      await eventService.reject(id, feedback)
      toast.success('Event rejected')
      setRejecting(false)
      setFeedback('')
      await load()
    } catch (err) {
      const message = err.response?.data?.message || 'Could not reject this event.'
      setError(message)
      toast.error(message)
    } finally {
      setActioning(false)
    }
  }

  const handleDelete = async () => {
    try {
      await eventService.delete(id)
      toast.success('Event deleted')
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete this event.'
      setError(message)
      toast.error(message)
    }
  }

  const handlePhotoUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Choose at least one photo first.')
      return
    }
    if (!confirmOriginal) {
      toast.error('Please confirm these are original, unedited photographs.')
      return
    }
    setUploading(true)
    try {
      await eventService.uploadPhotos(id, selectedFiles)
      toast.success('Photos uploaded')
      setSelectedFiles([])
      setConfirmOriginal(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload photos.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 bg-[#F2F4F7] rounded animate-pulse" />
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-3">
          <div className="h-6 w-1/2 bg-[#F2F4F7] rounded animate-pulse" />
          <div className="h-3 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
          <div className="h-24 w-full bg-[#F2F4F7] rounded animate-pulse mt-4" />
        </div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#B42318]">
        {error}
      </div>
    )
  }

  if (!event) return null

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="text-sm text-[#667085] hover:text-[#1B2340]">
        &larr; Back to dashboard
      </Link>

      {error && <p className="text-sm text-[#B42318]">{error}</p>}

      <div className="bg-white border border-[#E4E7EC] rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif font-semibold text-2xl text-[#1B2340]">
              {event.eventName}
            </h1>
            <p className="text-sm text-[#667085] mt-1">
              {event.eventType} &middot; {event.department?.name}
              {event.cluster && <> &middot; {event.cluster}</>}
              {event.section && <> &middot; {event.section}</>}
            </p>
            {event.coDepartments?.length > 0 && (
              <p className="text-xs text-[#98A2B3] mt-1">
                Jointly organized with: {event.coDepartments.map((d) => d.name || d).join(', ')}
              </p>
            )}
            {event.activityCategory && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-[#EFF4FF] text-[#1B2340] text-[10px] font-semibold uppercase tracking-wide">
                {ACTIVITY_CATEGORY_LABELS[event.activityCategory] || event.activityCategory}
              </span>
            )}
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
              STATUS_STYLES[event.status] || 'bg-[#F2F4F7] text-[#667085]'
            }`}
          >
            {event.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <p className="text-[#667085]">Date</p>
            <p className="text-[#1B2340] font-medium">
              {event.eventDate ? formatDate(event.eventDate) : '—'}
              {event.eventTime && ` at ${event.eventTime}`}
            </p>
          </div>
          <div>
            <p className="text-[#667085]">Location</p>
            <p className="text-[#1B2340] font-medium">{event.location || 'TBD'}</p>
          </div>
          <div>
            <p className="text-[#667085]">Organizer</p>
            <p className="text-[#1B2340] font-medium">
              {event.organizerName ||
                (event.createdBy && `${event.createdBy.firstName} ${event.createdBy.lastName}`) ||
                '—'}
            </p>
          </div>
          <div>
            <p className="text-[#667085]">Expected Attendance</p>
            <p className="text-[#1B2340] font-medium">{event.expectedAttendance || '—'}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[#667085] text-sm mb-1">Description</p>
          <p className="text-[#334155] text-sm whitespace-pre-wrap">{event.description}</p>
        </div>

        {event.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-[#F2F4F7] text-[#667085] text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {event.participants?.length > 0 && (
          <div className="mt-6">
            <p className="text-[#667085] text-sm mb-2">
              Participating Students ({event.participants.length})
            </p>
            <div className="border border-[#E4E7EC] rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F6F8] text-left text-xs uppercase text-[#667085]">
                  <tr>
                    <th className="px-3 py-2">USN</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {event.participants.map((p, idx) => (
                    <tr key={idx} className="border-t border-[#E4E7EC]">
                      <td className="px-3 py-2 text-[#1B2340]">{p.usn}</td>
                      <td className="px-3 py-2 text-[#1B2340]">{p.name}</td>
                      <td className="px-3 py-2 text-[#667085]">{p.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[#E4E7EC]">
          <p className="text-[#667085] text-sm mb-2">
            Photos ({event.photos?.length || 0})
          </p>

          {event.photos?.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {event.photos.map((photo, idx) => (
                <a
                  key={idx}
                  href={`http://localhost:5000${photo.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-[#E4E7EC]"
                >
                  <img
                    src={`http://localhost:5000${photo.url}`}
                    alt={`Event photo ${idx + 1}`}
                    className="w-full h-28 object-cover hover:scale-105 transition-transform duration-300"
                  />
                </a>
              ))}
            </div>
          )}

          {(isOwner || user?.role === 'SUPER_ADMIN') && (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                className="text-sm"
              />
              <label className="flex items-start gap-2 text-xs text-[#667085]">
                <input
                  type="checkbox"
                  checked={confirmOriginal}
                  onChange={(e) => setConfirmOriginal(e.target.checked)}
                  className="mt-0.5"
                />
                I confirm these are original, unedited photographs of the activity (no
                collages or merged images).
              </label>
              <button
                type="button"
                disabled={uploading}
                onClick={handlePhotoUpload}
                className="px-4 py-2 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload photos'}
              </button>
            </div>
          )}
        </div>

        {canApprove && (
          <div className="mt-6 pt-6 border-t border-[#E4E7EC]">
            {rejecting ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Explain why this event is being rejected..."
                  className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actioning}
                    onClick={handleReject}
                    className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {actioning ? 'Rejecting...' : 'Confirm reject'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(false)
                      setFeedback('')
                    }}
                    className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actioning}
                  onClick={handleApprove}
                  className="px-4 py-2 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50"
                >
                  {actioning ? 'Approving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(true)}
                  className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}

        {isOwner && event.status === 'DRAFT' && (
          <div className="mt-6 pt-6 border-t border-[#E4E7EC] flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-xs text-gray-500">Delete this draft?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-red-600 font-semibold text-xs hover:underline"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-gray-500 text-xs hover:underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="px-4 py-2 rounded-md border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Delete draft
              </button>
            )}
          </div>
        )}
      </div>

      {event.approvalHistory?.length > 0 && (
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#667085] font-semibold mb-4">
            Approval History
          </p>
          <div className="space-y-4">
            {event.approvalHistory.map((entry, idx) => (
              <div key={idx} className="text-sm border-l-2 border-[#E4E7EC] pl-4">
                <p className="text-[#1B2340] font-medium">
                  {entry.action}
                  {entry.approver && (
                    <span className="text-[#667085] font-normal">
                      {' '}
                      by {entry.approver.firstName} {entry.approver.lastName}
                    </span>
                  )}
                </p>
                {entry.feedback && (
                  <p className="text-[#667085] mt-0.5">{entry.feedback}</p>
                )}
                <p className="text-[#98A2B3] text-xs mt-0.5">
                  {formatDateTime(entry.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}