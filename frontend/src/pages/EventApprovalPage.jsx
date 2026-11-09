import React, { useEffect, useState, useCallback, useMemo } from 'react'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS, SCOPE_LEVEL } from '../config/permissions'
import eventService from '../services/eventService'
import publicationService from '../services/publicationService'
import facultyAchievementService from '../services/facultyAchievementService'
import patentService from '../services/patentService'
import { formatDate } from '../utils/date'
import toast from 'react-hot-toast'

const ITEM_LABELS = {
  event: 'event',
  publication: 'publication',
  achievement: 'achievement',
  patent: 'patent',
}

const serviceFor = (itemType) =>
  itemType === 'publication'
    ? publicationService
    : itemType === 'achievement'
      ? facultyAchievementService
      : itemType === 'patent'
        ? patentService
        : eventService

// Photos are stored as "/uploads/events/xxx.jpg" on the backend server.
const photoSrc = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
  return `${base}${url}`
}

// Who posted this item (events use createdBy, the others submittedBy).
function posterOf(item) {
  const p = item.createdBy && typeof item.createdBy === 'object' ? item.createdBy : item.submittedBy
  if (p && typeof p === 'object') {
    const name = `${p.firstName || ''} ${p.lastName || ''}`.trim()
    return { key: String(p._id || p.id || name || 'unknown'), name: name || item.organizerName || 'Unknown' }
  }
  if (typeof p === 'string' && p) return { key: p, name: item.organizerName || 'Unknown' }
  return { key: 'unknown', name: item.organizerName || 'Unknown' }
}

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || '?'

export default function EventApprovalPage() {
  const { can, scope, role, canAccessScope } = usePermissions()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actioningId, setActioningId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [bulkKey, setBulkKey] = useState(null)
  const [openKey, setOpenKey] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters = { status: 'SUBMITTED' }
      const level = SCOPE_LEVEL[role]
      if (level === 'DEPARTMENT' || level === 'CLUSTER') {
        filters.department = scope.departmentId?._id || scope.departmentId
      }

      const [eventsRes, pubsRes, achievementsRes, patentsRes] = await Promise.all([
        eventService.getAll(filters, 1, 100),
        publicationService.getAll(filters, 1, 100),
        facultyAchievementService.getAll(filters, 1, 100),
        patentService.getAll(filters, 1, 100),
      ])

      setTruncated(
        [eventsRes, pubsRes, achievementsRes, patentsRes].some(
          (res) => (res?.pagination?.totalCount || 0) > 100
        )
      )

      const eventList = Array.isArray(eventsRes?.data) ? eventsRes.data : []
      const pubList = Array.isArray(pubsRes?.data) ? pubsRes.data : []
      const achievementList = Array.isArray(achievementsRes?.data) ? achievementsRes.data : []
      const patentList = Array.isArray(patentsRes?.data) ? patentsRes.data : []

      const scopedEvents = eventList
        .filter((e) =>
          canAccessScope({
            departmentId: e.department?._id || e.department,
            clusterId: e.cluster,
            sectionId: e.section,
          })
        )
        .map((e) => ({ ...e, itemType: 'event' }))

      const scopedPubs = pubList
        .filter((p) =>
          canAccessScope({
            departmentId: p.department?._id || p.department,
            clusterId: p.cluster,
            sectionId: p.section,
          })
        )
        .map((p) => ({ ...p, itemType: 'publication' }))

      const scopedAchievements = achievementList
        .filter((a) =>
          canAccessScope({ departmentId: a.department?._id || a.department, clusterId: a.cluster })
        )
        .map((a) => ({ ...a, itemType: 'achievement' }))

      const scopedPatents = patentList
        .filter((p) =>
          canAccessScope({ departmentId: p.department?._id || p.department, clusterId: p.cluster })
        )
        .map((p) => ({ ...p, itemType: 'patent' }))

      setEvents(
        [...scopedEvents, ...scopedPubs, ...scopedAchievements, ...scopedPatents].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      )
    } catch (err) {
      setError('Could not load pending items.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // One group per faculty member, most items first.
  const groups = useMemo(() => {
    const map = new Map()
    events.forEach((item) => {
      const who = posterOf(item)
      if (!map.has(who.key)) {
        map.set(who.key, { key: who.key, name: who.name, items: [], clusters: new Set(), sections: new Set() })
      }
      const g = map.get(who.key)
      g.items.push(item)
      if (item.cluster) g.clusters.add(item.cluster)
      if (item.section) g.sections.add(item.section)
    })
    return [...map.values()].sort(
      (a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name)
    )
  }, [events])

  if (!can(PERMISSIONS.EVENTS_APPROVE)) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        You don&apos;t have permission to approve events.
      </div>
    )
  }

  const handleApprove = async (id, itemType) => {
    setActioningId(id)
    try {
      await serviceFor(itemType).approve(id)
      setError(null)
      toast.success('Accepted and approved. Faculty member has been notified by email.')
      setEvents((prev) => prev.filter((e) => (e.id || e._id) !== id))
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not approve this item.')
    } finally {
      setActioningId(null)
    }
  }

  const handleReject = async (id, itemType) => {
    if (!feedback.trim()) {
      setError('A comment explaining what needs to be changed or corrected is required.')
      return
    }
    setActioningId(id)
    try {
      await serviceFor(itemType).reject(id, feedback)
      setError(null)
      toast.success('Resent to faculty with your correction comments. They have been notified by email.')
      setEvents((prev) => prev.filter((e) => (e.id || e._id) !== id))
      setRejectingId(null)
      setFeedback('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not return this item to faculty.')
    } finally {
      setActioningId(null)
    }
  }

  // Approves every pending item of one faculty member, one after another.
  const handleApproveAll = async (group) => {
    const ok = window.confirm(
      `Approve all ${group.items.length} pending item(s) from ${group.name}?`
    )
    if (!ok) return

    setBulkKey(group.key)
    setError(null)
    let done = 0
    let failed = 0
    const approvedIds = new Set()

    for (const item of group.items) {
      const id = item.id || item._id
      try {
        await serviceFor(item.itemType).approve(id)
        approvedIds.add(id)
        done += 1
      } catch (err) {
        failed += 1
      }
    }

    setEvents((prev) => prev.filter((e) => !approvedIds.has(e.id || e._id)))
    setBulkKey(null)

    if (done > 0) toast.success(`Approved ${done} item(s) from ${group.name}.`)
    if (failed > 0) setError(`${failed} item(s) from ${group.name} could not be approved. Please try them one by one.`)
  }

  const openGroup = groups.find((g) => g.key === openKey) || null
  const where = (g) =>
    [[...g.clusters].join(', '), [...g.sections].join(', ')].filter(Boolean).join(' · ')

  const renderItem = (event) => {
    const id = event.id || event._id
    const isRejecting = rejectingId === id
    const isActioning = actioningId === id || bulkKey !== null

    return (
      <div key={id} className="border-t border-[#EEF0F3] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-[#1B2340]">
                {event.itemType === 'publication' ||
                  event.itemType === 'achievement' ||
                  event.itemType === 'patent'
                  ? event.title
                  : event.eventName}
              </h3>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${event.itemType === 'publication'
                    ? 'bg-[#EFF4FF] text-[#1B2340]'
                    : event.itemType === 'achievement'
                      ? 'bg-[#ECFDF3] text-[#067647]'
                      : event.itemType === 'patent'
                        ? 'bg-[#FBEBC9] text-[#B07C1F]'
                        : 'bg-[#F2F4F7] text-[#667085]'
                  }`}
              >
                {event.itemType === 'publication'
                  ? 'Publication'
                  : event.itemType === 'achievement'
                    ? 'Achievement'
                    : event.itemType === 'patent'
                      ? 'Patent'
                      : 'Event'}
              </span>
            </div>

            {event.itemType !== 'event' && (event.department?.name || event.cluster) && (
              <p className="text-xs text-[#98A2B3] mt-1">
                {[event.department?.name, event.cluster].filter(Boolean).join(' · ')}
              </p>
            )}

            {event.itemType === 'publication' ? (
              <>
                <p className="text-xs text-[#667085] mt-1">
                  {event.publicationType} &middot; {event.venueName}
                </p>
                <p className="text-xs text-[#667085] mt-1">Authors: {event.authors?.join(', ')}</p>
              </>
            ) : event.itemType === 'achievement' ? (
              <>
                <p className="text-xs text-[#667085] mt-1">{event.category}</p>
                <p className="text-sm text-[#334155] mt-3 whitespace-pre-line">{event.description}</p>
              </>
            ) : event.itemType === 'patent' ? (
              <>
                <p className="text-xs text-[#667085] mt-1">
                  {event.grantStatus} &middot; {event.grantingAuthority}
                </p>
                <p className="text-xs text-[#667085] mt-1">Inventors: {event.inventors?.join(', ')}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-[#667085] mt-1">
                  {event.eventDate ? formatDate(event.eventDate) : ''}
                </p>
                <p className="text-sm text-[#334155] mt-3 whitespace-pre-line">{event.description}</p>
                {Array.isArray(event.photos) && event.photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl">
                    {event.photos.map((photo, i) => {
                      const src = photoSrc(photo.url || photo)
                      return (
                        <a key={i} href={src} target="_blank" rel="noreferrer">
                          <img
                            src={src}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-32 object-cover rounded-md border border-[#E4E7EC] hover:opacity-90"
                          />
                        </a>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-medium">
            Submitted
          </span>
        </div>

        {isRejecting ? (
          <div className="mt-4 p-3.5 bg-[#FEF3F2] border border-[#FECDCA] rounded-lg space-y-2">
            <p className="text-xs font-semibold text-[#B42318]">
              Resend to faculty with feedback / correction instructions:
            </p>
            <textarea
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={`Tell the faculty member what needs to be corrected or revised in this ${ITEM_LABELS[event.itemType] || 'item'}...`}
              className="w-full px-3 py-2 rounded-md border border-[#FECDCA] bg-white text-sm focus:outline-none focus:border-[#B42318]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isActioning}
                onClick={() => handleReject(id, event.itemType)}
                className="px-4 py-2 rounded-md bg-[#B42318] text-white text-sm font-medium hover:bg-[#912018] disabled:opacity-50"
              >
                {actioningId === id ? 'Sending back...' : 'Resend with Comment'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingId(null)
                  setFeedback('')
                }}
                className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              disabled={isActioning}
              onClick={() => handleApprove(id, event.itemType)}
              className="px-4 py-2 rounded-md bg-[#1B2340] text-white text-sm font-semibold hover:bg-[#242b52] disabled:opacity-50"
            >
              {actioningId === id ? 'Accepting...' : 'Accept (Approve)'}
            </button>
            <button
              type="button"
              disabled={isActioning}
              onClick={() => setRejectingId(id)}
              className="px-4 py-2 rounded-md border border-[#FECDCA] text-sm text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-50"
            >
              Resend with Comment
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">Approvals</h2>
        {!loading && events.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-[#C9962C] text-[#1B2340] text-xs font-semibold">
            {events.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="ml-auto text-sm px-3 py-1.5 rounded-md border border-[#E4E7EC] text-[#667085] hover:bg-[#F5F6F8] disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p className="text-sm text-[#667085] -mt-4">
        Choose a faculty member to review their posts. Approve one by one, or use
        &quot;Approve all&quot; for that person.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {truncated && (
        <p className="text-sm text-[#92400E] bg-[#FEF3C7] rounded-md px-3 py-2">
          Showing up to 100 items per type. Decide on some, then refresh to see the rest.
        </p>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E4E7EC] rounded-lg p-5">
              <div className="h-4 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[#F2F4F7] rounded animate-pulse mt-2" />
              <div className="h-3 w-2/3 bg-[#F2F4F7] rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E7EC] rounded-lg p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nothing waiting on you right now — submissions from your scope will show up here.
          </p>
        </div>
      ) : !openGroup ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => setOpenKey(group.key)}
              className="text-left bg-white border border-[#E4E7EC] rounded-lg p-4 hover:border-[#C9962C] hover:shadow-sm transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#1B2340] text-white text-sm font-semibold flex items-center justify-center shrink-0">
                  {initials(group.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1B2340] truncate">{group.name}</p>
                  <p className="text-xs text-[#667085] truncate">{where(group) || 'No cluster'}</p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#C9962C] text-[#1B2340] text-xs font-semibold">
                  {group.items.length}
                </span>
              </div>
              <p className="text-xs text-[#98A2B3] mt-3">
                {group.items.length} pending &middot; click to review
              </p>
            </button>
          ))}
        </div>
      ) : (
        <section className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-[#F8F9FB]">
            <button
              type="button"
              onClick={() => setOpenKey(null)}
              className="shrink-0 text-sm px-3 py-1.5 rounded-md border border-[#E4E7EC] text-[#667085] hover:bg-white"
            >
              &larr; All faculty
            </button>
            <div className="w-11 h-11 rounded-full bg-[#1B2340] text-white text-sm font-semibold flex items-center justify-center shrink-0">
              {initials(openGroup.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#1B2340] truncate">{openGroup.name}</p>
              <p className="text-xs text-[#667085]">
                {where(openGroup) || 'No cluster'} &middot; {openGroup.items.length} pending
              </p>
            </div>
            <button
              type="button"
              disabled={bulkKey !== null || actioningId !== null}
              onClick={() => handleApproveAll(openGroup)}
              className="shrink-0 px-4 py-2 rounded-md bg-[#C9962C] text-[#1B2340] text-sm font-semibold hover:bg-[#b88625] disabled:opacity-50"
            >
              {bulkKey === openGroup.key ? 'Approving…' : `Approve all (${openGroup.items.length})`}
            </button>
          </div>
          {openGroup.items.map(renderItem)}
        </section>
      )}
    </div>
  )
}