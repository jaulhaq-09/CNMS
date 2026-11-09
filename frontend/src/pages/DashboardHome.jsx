import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { AlertCircle, CalendarPlus, CheckCircle2, Clock, Edit3, MessageSquare } from 'lucide-react'
import eventService from '../services/eventService'
import publicationService from '../services/publicationService'
import patentService from '../services/patentService'
import facultyAchievementService from '../services/facultyAchievementService'
import analyticsService from '../services/analyticsService'
import EventStats from '../components/Analytics/EventStats'
import NewsletterStats from '../components/Analytics/NewsletterStats'
import UserActivityChart from '../components/Analytics/UserActivityChart'
import ActivityRevisionModal from '../components/events/ActivityRevisionModal'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import { formatDate, formatDateLong, formatRelativeTimeCompact } from '../utils/date'

const ROLE_LABELS = {
  SUPER_ADMIN: 'Admin',
  COORDINATOR: 'Coordinator',
  FACULTY: 'Faculty',
  GUEST: 'Guest',
}

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  SUBMITTED: 'bg-[#FBF3E7] text-[#B07C1F]',
  UNDER_REVIEW: 'bg-[#FBF3E7] text-[#B07C1F]',
  APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  PUBLISHED: 'bg-[#EFF4FF] text-[#1B2340]',
}

const ITEM_LABELS = {
  event: 'Event',
  publication: 'Publication',
  patent: 'Patent',
  achievement: 'Achievement',
}

// Loads a list, or an empty one if the service has no getAll or the call fails,
// so one missing list never breaks the whole dashboard.
const safeList = async (service, filters, limit) => {
  try {
    if (typeof service?.getAll !== 'function') return { data: [] }
    return await service.getAll(filters, 1, limit)
  } catch (err) {
    return { data: [] }
  }
}

export default function DashboardHome() {
  const user = useSelector((state) => state.auth?.user)
  const roleLabel = ROLE_LABELS[user?.role]
  const { can, canAccessScope } = usePermissions()
  const canViewAnalytics = can(PERMISSIONS.ANALYTICS_VIEW)
  const canApprove = can(PERMISSIONS.EVENTS_APPROVE)
  const canCreate = can(PERMISSIONS.EVENTS_CREATE)

  const [activity, setActivity] = useState([])
  const [facultyActiveItems, setFacultyActiveItems] = useState([])
  const [revisingItem, setRevisingItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [days, setDays] = useState(30)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const isFaculty = user?.role === 'FACULTY'

  const getFeedback = (item) => {
    if (Array.isArray(item.approvalHistory)) {
      const list = item.approvalHistory.filter((h) => h.action === 'REJECTED' || h.feedback)
      if (list.length > 0) return list[list.length - 1].feedback || ''
    }
    return item.feedback || ''
  }

  useEffect(() => {
    let cancelled = false

    async function loadRecentActivity() {
      try {
        setLoading(true)
        setError('')

        const [eventsRes, pubsRes, patentsRes, achievementsRes] = await Promise.all([
          eventService.getAll({}, 1, 20),
          publicationService.getAll({}, 1, 20),
          safeList(patentService, {}, 20),
          safeList(facultyAchievementService, {}, 20),
        ])

        const events = (eventsRes.data || []).map((e) => ({ ...e, itemType: 'event' }))
        const pubs = (pubsRes.data || []).map((p) => ({ ...p, itemType: 'publication' }))
        const patents = (patentsRes.data || []).map((p) => ({ ...p, itemType: 'patent' }))
        const achievements = (achievementsRes.data || []).map((a) => ({ ...a, itemType: 'achievement' }))

        const isReviewer = can(PERMISSIONS.EVENTS_APPROVE)

        // For Faculty: only show their own items, and once accepted (APPROVED/PUBLISHED),
        // remove from faculty active view (resides on coordinator/admin side).
        const scoped = [...events, ...pubs, ...patents, ...achievements].filter((item) => {
          if (isReviewer) {
            return canAccessScope({
              departmentId: item.department?._id || item.department,
              clusterId: item.cluster,
              sectionId: item.section,
            })
          }
          const ownerId = item.createdBy?._id || item.createdBy || item.submittedBy?._id || item.submittedBy
          return ownerId === user?._id && !['APPROVED', 'PUBLISHED'].includes(item.status)
        })

        const sorted = scoped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        if (!cancelled) {
          setActivity(sorted.slice(0, 5))
          if (isFaculty) {
            setFacultyActiveItems(sorted)
          }
        }
      } catch (err) {
        if (!cancelled) setError('Could not load recent activity.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadPendingReview() {
      if (!can(PERMISSIONS.EVENTS_APPROVE)) return
      try {
        const lists = await Promise.all([
          eventService.getAll({ status: 'SUBMITTED' }, 1, 100),
          publicationService.getAll({ status: 'SUBMITTED' }, 1, 100),
          safeList(patentService, { status: 'SUBMITTED' }, 100),
          safeList(facultyAchievementService, { status: 'SUBMITTED' }, 100),
        ])
        const count = lists
          .flatMap((res) => res.data || [])
          .filter((item) =>
            canAccessScope({
              departmentId: item.department?._id || item.department,
              clusterId: item.cluster,
              sectionId: item.section,
            })
          ).length
        if (!cancelled) setPendingReviewCount(count)
      } catch (err) {
        // non-fatal
      }
    }

    async function loadStats() {
      try {
        setStatsLoading(true)
        if (canViewAnalytics) {
          const res = await analyticsService.getDashboard(days)
          if (cancelled) return
          setStats({
            total: res.data.events.total,
            approved: res.data.events.approved,
            pending: res.data.events.pending,
            newsletters: res.data.newsletters.published,
          })
          setAnalytics(res.data)
        } else {
          const res = await eventService.getAll({}, 1, 100)
          if (cancelled) return
          const mine = (res.data || []).filter(
            (e) => (e.createdBy?._id || e.createdBy) === user?._id
          )
          setStats({
            total: mine.length,
            approved: mine.filter((e) => e.status === 'APPROVED' || e.status === 'PUBLISHED').length,
            pending: mine.filter((e) => e.status === 'SUBMITTED' || e.status === 'UNDER_REVIEW').length,
            drafts: mine.filter((e) => e.status === 'DRAFT').length,
          })
        }
      } catch (err) {
        // non-fatal — dashboard still works without stats
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    loadRecentActivity()
    loadStats()
    loadPendingReview()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, reloadTrigger])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
      {/* Main column */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#C9962C] font-semibold mb-2">
          {formatDateLong()}
        </p>

        <h1 className="font-serif font-semibold text-4xl text-[#1B2340] mb-1">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        {roleLabel && (
          <p className="text-[#667085] mb-10">
            Signed in as <span className="font-medium text-[#1B2340]">{roleLabel}</span>
            {user?.department?.name && <> &middot; {user.department.name}</>}
          </p>
        )}
        {!roleLabel && <div className="mb-10" />}

        {canApprove && pendingReviewCount > 0 && (
          <div className="flex flex-wrap gap-3 mb-8">
            <Link
              to="/approvals"
              className="px-4 py-2 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              {pendingReviewCount} item{pendingReviewCount !== 1 ? 's' : ''} waiting on your review
            </Link>
          </div>
        )}
        {canViewAnalytics && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold">
              Overview
            </p>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        )}
        {!statsLoading && stats && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-[#1B2340] to-[#2A3562] rounded-xl p-5">
                <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                  {canViewAnalytics ? 'Total Events' : 'Your Events'}
                </p>
                <p className="text-3xl font-serif font-semibold text-white">{stats.total}</p>
              </div>
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <p className="text-[11px] uppercase tracking-wide text-[#067647] mb-1">Approved</p>
                <p className="text-3xl font-serif font-semibold text-[#1B2340]">{stats.approved}</p>
              </div>
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <p className="text-[11px] uppercase tracking-wide text-[#B07C1F] mb-1">Pending</p>
                <p className="text-3xl font-serif font-semibold text-[#1B2340]">{stats.pending}</p>
              </div>
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <p className="text-[11px] uppercase tracking-wide text-[#C9962C] mb-1">
                  {canViewAnalytics ? 'Newsletters' : 'Drafts'}
                </p>
                <p className="text-3xl font-serif font-semibold text-[#1B2340]">
                  {canViewAnalytics ? stats.newsletters : stats.drafts}
                </p>
              </div>
            </div>

            {canViewAnalytics && analytics && (
              <div className="space-y-6 mb-6">
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                  <EventStats data={analytics.events} />
                  <NewsletterStats data={analytics.newsletters} />
                </div>
                <UserActivityChart data={analytics.activity} />
              </div>
            )}

            {/* Faculty in-progress submissions and revision requests */}
            {isFaculty && (
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-serif font-semibold text-lg text-[#1B2340]">
                      Your Submissions in Progress
                    </h2>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Activities awaiting coordinator decision or returned with correction notes. Once accepted, items are archived to the department record.
                    </p>
                  </div>
                  <Link
                    to="/post"
                    className="px-3.5 py-1.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-xs font-semibold hover:brightness-105 transition-all inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <CalendarPlus size={14} /> + New Activity
                  </Link>
                </div>

                {facultyActiveItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#D0D5DD] rounded-xl space-y-2">
                    <CheckCircle2 size={30} className="mx-auto text-[#067647]" />
                    <p className="text-sm font-medium text-[#1B2340]">All clear!</p>
                    <p className="text-xs text-[#667085]">
                      You have no pending submissions or requested changes right now. All accepted submissions reside on your coordinator's side.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-xl overflow-hidden">
                    {facultyActiveItems.map((item) => {
                      const isEvent = item.itemType === 'event'
                      const title = isEvent ? item.eventName : item.title
                      const isRejected = item.status === 'REJECTED'
                      const feedback = isRejected ? getFeedback(item) : ''

                      return (
                        <div
                          key={item._id}
                          className={`p-4 transition-colors ${
                            isRejected
                              ? 'bg-[#FEF3F2]/40 hover:bg-[#FEF3F2]/70'
                              : 'bg-white hover:bg-[#F9FAFB]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-[#1B2340] truncate">
                                  {title}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#EFF4FF] text-[#1B2340]">
                                  {ITEM_LABELS[item.itemType] || 'Activity'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    isRejected
                                      ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]'
                                      : 'bg-[#FEF3C7] text-[#92400E]'
                                  }`}
                                >
                                  {isRejected ? 'Changes Requested' : 'Awaiting Coordinator Review'}
                                </span>
                              </div>

                              <p className="text-xs text-[#667085] mt-1">
                                Submitted on {formatDate(item.createdAt)}
                                {item.eventDate && ` · Event Date: ${formatDate(item.eventDate)}`}
                              </p>

                              {/* Coordinator feedback note */}
                              {isRejected && (
                                <div className="mt-3 p-3 rounded-lg bg-white border border-[#FECDCA] space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B42318]">
                                    <MessageSquare size={13} />
                                    Coordinator's Correction Note:
                                  </div>
                                  <p className="text-xs text-[#912018] whitespace-pre-wrap">
                                    {feedback || 'Please update the activity details and resubmit.'}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="shrink-0 flex items-center gap-2">
                              {isRejected ? (
                                <button
                                  type="button"
                                  onClick={() => setRevisingItem(item)}
                                  className="px-3.5 py-2 rounded-lg bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#252f52] transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                  <Edit3 size={13} /> Revise & Resubmit
                                </button>
                              ) : (
                                <span className="text-xs text-[#98A2B3] flex items-center gap-1">
                                  <Clock size={13} /> In review
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Status breakdown — built from the same stats already loaded above */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
              <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold mb-5">
                {canViewAnalytics ? 'Submission Status' : 'Your Submission Status'}
              </p>
              {(() => {
                const total = stats.total || 0
                const approvedPct = total ? Math.round((stats.approved / total) * 100) : 0
                const pendingPct = total ? Math.round((stats.pending / total) * 100) : 0
                const otherPct = Math.max(0, 100 - approvedPct - pendingPct)
                return (
                  <>
                    <div className="w-full h-3 rounded-full overflow-hidden bg-[#F2F4F7] flex mb-5">
                      {approvedPct > 0 && (
                        <div className="h-full bg-[#12B76A]" style={{ width: `${approvedPct}%` }} />
                      )}
                      {pendingPct > 0 && (
                        <div className="h-full bg-[#C9962C]" style={{ width: `${pendingPct}%` }} />
                      )}
                      {otherPct > 0 && (
                        <div className="h-full bg-[#D0D5DD]" style={{ width: `${otherPct}%` }} />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A] shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-[#1B2340]">{stats.approved}</p>
                          <p className="text-xs text-[#667085]">Approved</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#C9962C] shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-[#1B2340]">{stats.pending}</p>
                          <p className="text-xs text-[#667085]">Pending</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#D0D5DD] shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-[#1B2340]">
                            {canViewAnalytics ? stats.newsletters : stats.drafts}
                          </p>
                          <p className="text-xs text-[#667085]">
                            {canViewAnalytics ? 'Newsletters' : 'Drafts'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Side rail — real recent activity */}
      <div className="lg:border-l lg:border-[#E4E7EC] lg:pl-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#667085] font-semibold mb-3">
          Recent Activity
        </p>

        {loading && (
          <div className="bg-white border border-[#E4E7EC] rounded-lg divide-y divide-[#E4E7EC] overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-3.5 w-2/3 bg-[#F2F4F7] rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-[#F2F4F7] rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#B42318]">
            {error}
          </div>
        )}

        {!loading && !error && activity.length === 0 && (
          <div className="bg-white border border-dashed border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
            Nothing to show yet. Approvals, published newsletters, and event
            updates will appear here as they happen.
          </div>
        )}

        {!loading && !error && activity.length > 0 && (
          <div className="bg-white border border-[#E4E7EC] rounded-lg divide-y divide-[#E4E7EC]">
            {activity.map((item) => {
              const isEvent = item.itemType === 'event'
              const title = isEvent ? item.eventName : item.title
              const link =
                item.itemType === 'publication'
                  ? `/publications/${item._id}`
                  : isEvent
                    ? `/events/${item._id}`
                    : '/approvals'
              const submitter = item.submittedBy || item.createdBy
              const who = isEvent
                ? item.organizerName
                : submitter && submitter.firstName && `${submitter.firstName} ${submitter.lastName}`
              return (
                <Link
                  key={item._id}
                  to={link}
                  className="block p-4 hover:bg-[#F5F6F8] hover:pl-5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-[#1B2340] truncate">{title}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[item.status] || 'bg-[#F2F4F7] text-[#667085]'
                        }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">
                    {ITEM_LABELS[item.itemType]} &middot; {who || 'Unknown'} &middot;{' '}
                    {formatRelativeTimeCompact(item.createdAt)}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {revisingItem && (
        <ActivityRevisionModal
          item={revisingItem}
          onClose={() => setRevisingItem(null)}
          onResubmitted={() => {
            setRevisingItem(null)
            setReloadTrigger((v) => v + 1)
          }}
        />
      )}
    </div>
  )
}