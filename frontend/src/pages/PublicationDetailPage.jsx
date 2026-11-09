import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import publicationService from '../services/publicationService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import { formatDate, formatDateTime } from '../utils/date'
import { TYPE_LABELS, VENUE_LABELS, buildCitation, normalizeDoi } from '../utils/citation'

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  SUBMITTED: 'bg-[#FBF3E7] text-[#B07C1F]',
  APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  PUBLISHED: 'bg-[#EFF4FF] text-[#1B2340]',
}

export default function PublicationDetailPage() {
  const { id } = useParams()
  const { can, canAccessScope } = usePermissions()

  const [publication, setPublication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await publicationService.getById(id)
      setPublication(response.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this publication.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const canApprove =
    publication &&
    publication.status === 'SUBMITTED' &&
    can(PERMISSIONS.EVENTS_APPROVE) &&
    canAccessScope({
      departmentId: publication.department?._id || publication.department,
      clusterId: publication.cluster,
      sectionId: publication.section,
    })

  const handleApprove = async () => {
    setActioning(true)
    try {
      await publicationService.approve(id)
      toast.success('Publication approved')
      await load()
    } catch (err) {
      const message = err.response?.data?.message || 'Could not approve this publication.'
      setError(message)
      toast.error(message)
    } finally {
      setActioning(false)
    }
  }

  const handleReject = async () => {
    if (!feedback.trim()) {
      setError('Feedback is required to reject a publication.')
      return
    }
    setActioning(true)
    try {
      await publicationService.reject(id, feedback)
      toast.success('Publication rejected')
      setRejecting(false)
      setFeedback('')
      await load()
    } catch (err) {
      const message = err.response?.data?.message || 'Could not reject this publication.'
      setError(message)
      toast.error(message)
    } finally {
      setActioning(false)
    }
  }

  if (loading) return <p className="text-sm text-[#667085]">Loading publication...</p>
  if (error && !publication) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#B42318]">
        {error}
      </div>
    )
  }
  if (!publication) return null

  const extraFields = [
    ['Year', publication.publicationYear],
    ['Volume', publication.volume],
    ['Issue', publication.issue],
    ['Pages', publication.pages],
    ['Publisher', publication.publisher],
    ['Editors', publication.editors],
    ['Edition', publication.edition],
    ['ISBN', publication.isbn],
  ].filter(([, value]) => value)
  const citation = buildCitation(publication)

  return (
    <div className="space-y-6">
      <Link to="/publications" className="text-sm text-[#667085] hover:text-[#1B2340]">
        &larr; Back to publications
      </Link>

      {error && <p className="text-sm text-[#B42318]">{error}</p>}

      <div className="bg-white border border-[#E4E7EC] rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif font-semibold text-2xl text-[#1B2340]">
              {publication.title}
            </h1>
            <p className="text-sm text-[#667085] mt-1">
              {publication.authors?.join(', ')}
            </p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
              STATUS_STYLES[publication.status] || 'bg-[#F2F4F7] text-[#667085]'
            }`}
          >
            {publication.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <p className="text-[#667085]">Type</p>
            <p className="text-[#1B2340] font-medium">
              {TYPE_LABELS[publication.publicationType] || publication.publicationType}
            </p>
          </div>
          {publication.publicationType !== 'BOOK' && (
            <div>
              <p className="text-[#667085]">
                {VENUE_LABELS[publication.publicationType] || 'Venue'}
              </p>
              <p className="text-[#1B2340] font-medium">{publication.venueName || '—'}</p>
            </div>
          )}
          {extraFields.map(([label, value]) => (
            <div key={label}>
              <p className="text-[#667085]">{label}</p>
              <p className="text-[#1B2340] font-medium">{value}</p>
            </div>
          ))}
          {publication.doi && (
            <div>
              <p className="text-[#667085]">DOI</p>
              <a
                href={normalizeDoi(publication.doi) || publication.doi}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9962C] font-medium hover:underline break-all"
              >
                {publication.doi}
              </a>
            </div>
          )}
          <div>
            <p className="text-[#667085]">Indexing</p>
            <p className="text-[#1B2340] font-medium">
              {publication.indexing?.length > 0 ? publication.indexing.join(', ') : '—'}
            </p>
          </div>
          {publication.publicationType === 'CONFERENCE' && (
            <>
              <div>
                <p className="text-[#667085]">Conference Dates</p>
                <p className="text-[#1B2340] font-medium">
                  {publication.conferenceStartDate ? formatDate(publication.conferenceStartDate) : '—'}
                  {publication.conferenceEndDate && ` – ${formatDate(publication.conferenceEndDate)}`}
                </p>
              </div>
              <div>
                <p className="text-[#667085]">Venue / Location</p>
                <p className="text-[#1B2340] font-medium">{publication.conferenceVenue || '—'}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-[#667085]">Department</p>
            <p className="text-[#1B2340] font-medium">{publication.department?.name || '—'}</p>
          </div>
          <div>
            <p className="text-[#667085]">Submitted By</p>
            <p className="text-[#1B2340] font-medium">
              {publication.submittedBy
                ? `${publication.submittedBy.firstName} ${publication.submittedBy.lastName}`
                : '—'}
            </p>
          </div>
        </div>

        {citation && (
          <div className="mt-6 rounded-lg border border-[#C9962C]/30 bg-[#FFFBF2] p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#B07C1F] font-semibold mb-1.5">
              Citation (as it appears in the report)
            </p>
            <p className="text-sm text-[#1B2340] leading-relaxed">{citation}</p>
          </div>
        )}

        {canApprove && (
          <div className="mt-6 pt-6 border-t border-[#E4E7EC]">
            {rejecting ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Explain why this publication is being rejected..."
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
                  className="px-4 py-2 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] disabled:opacity-50"
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
      </div>

      {publication.approvalHistory?.length > 0 && (
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#667085] font-semibold mb-4">
            Approval History
          </p>
          <div className="space-y-4">
            {publication.approvalHistory.map((entry, idx) => (
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
                {entry.feedback && <p className="text-[#667085] mt-0.5">{entry.feedback}</p>}
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