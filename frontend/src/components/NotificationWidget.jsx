import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { formatRelativeTime } from '../utils/date'

const ICON_MAP = {
  EVENT_APPROVED: '✓',
  EVENT_REJECTED: '✕',
  EVENT_SUBMITTED: 'E',
  APPROVAL_REQUESTED: '?',
  ITEM_APPROVED: '✓',
  ITEM_REJECTED: '✕',
  APPROVAL_COMPLETED: '✓',
  NEWSLETTER_PUBLISHED: 'N',
  NEWSLETTER_SCHEDULED: 'S',
  COMMENT: 'C',
  MENTION: '@',
  SYSTEM: '⚙',
}

const ICON_STYLES = {
  EVENT_APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  EVENT_REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  ITEM_APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  ITEM_REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  APPROVAL_COMPLETED: 'bg-[#ECFDF3] text-[#067647]',
}
const DEFAULT_ICON_STYLE = 'bg-[#1B2340] text-white'

const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier']

function groupLabel(dateStr) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfToday.getDate() - 1)

  const d = new Date(dateStr)
  if (d >= startOfToday) return 'Today'
  if (d >= startOfYesterday) return 'Yesterday'
  return 'Earlier'
}

export default function NotificationWidget() {
  const {
    notifications,
    unreadCount,
    loading,
    connected,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()

  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const wrapperRef = useRef(null)

  useEffect(() => {
    loadNotifications(1, {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const visible = useMemo(
    () =>
      tab === 'unread'
        ? notifications.filter((n) => !n.channels?.inApp?.read)
        : notifications,
    [notifications, tab]
  )

  const grouped = useMemo(() => {
    const groups = { Today: [], Yesterday: [], Earlier: [] }
    visible.forEach((n) => groups[groupLabel(n.createdAt)].push(n))
    return GROUP_ORDER.filter((label) => groups[label].length > 0).map((label) => ({
      label,
      items: groups[label],
    }))
  }, [visible])

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
      >
        <svg
          className="w-5 h-5 text-[#667085]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C0392B] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-[#E4E7EC] rounded-xl shadow-xl z-30 overflow-hidden animate-[fadeInUp_0.15s_ease-out]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-[#1B2340]">Notifications</h3>
              <span
                title={connected ? 'Live updates on' : 'Reconnecting…'}
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-[#067647]' : 'bg-[#D0D5DD]'
                }`}
              />
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-[#C0392B] hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 px-4 border-b border-[#E4E7EC]">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id
                    ? 'border-[#C0392B] text-[#1B2340]'
                    : 'border-transparent text-[#667085] hover:text-[#1B2340]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="divide-y divide-[#F2F4F7]">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F2F4F7] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/2 bg-[#F2F4F7] rounded animate-pulse" />
                      <div className="h-2.5 w-3/4 bg-[#F2F4F7] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-[#1B2340]">
                  {tab === 'unread' ? "You're all caught up" : 'No notifications yet'}
                </p>
                <p className="text-xs text-[#98A2B3] mt-1">
                  {tab === 'unread'
                    ? 'New updates will show up here.'
                    : 'Updates about your events and submissions will appear here.'}
                </p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-[#98A2B3]">
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map((n) => {
                      const isUnread = !n.channels?.inApp?.read
                      return (
                        <li
                          key={n._id}
                          className={`group relative border-b border-[#F2F4F7] last:border-b-0 ${
                            isUnread ? 'bg-[#FFFBF2]' : 'bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (isUnread) markAsRead(n._id)
                              if (n.data?.relatedUrl) {
                                setIsOpen(false)
                                navigate(n.data.relatedUrl)
                              }
                            }}
                            className="w-full flex items-start gap-3 pl-4 pr-10 py-3 text-left hover:bg-[#F5F6F8] transition-colors"
                          >
                            <span
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${
                                ICON_STYLES[n.type] || DEFAULT_ICON_STYLE
                              }`}
                            >
                              {ICON_MAP[n.type] || '●'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-[#1B2340] leading-snug">
                                {n.title}
                              </p>
                              <p className="text-xs text-[#667085] mt-0.5 line-clamp-2">
                                {n.message}
                              </p>
                              <p className="text-[10px] text-[#98A2B3] mt-1">
                                {formatRelativeTime(n.createdAt)}
                              </p>
                            </div>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-[#C0392B] shrink-0 mt-1.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNotification(n._id)}
                            aria-label="Dismiss notification"
                            title="Dismiss"
                            className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-[11px] text-[#98A2B3] hover:bg-[#FEF3F2] hover:text-[#B42318] transition-colors"
                          >
                            ✕
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}