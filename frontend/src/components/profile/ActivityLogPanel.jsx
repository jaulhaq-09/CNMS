import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import auditService from '../../services/auditService'
import { formatDateTime, formatRelativeTimeCompact } from '../../utils/date'

const ACTION_LABELS = {
  EVENT_APPROVED: 'approved an event',
  EVENT_REJECTED: 'rejected an event',
  PUBLICATION_APPROVED: 'approved a publication',
  PUBLICATION_REJECTED: 'rejected a publication',
  PATENT_APPROVED: 'approved a patent',
  PATENT_REJECTED: 'rejected a patent',
  ACHIEVEMENT_APPROVED: 'approved an achievement',
  ACHIEVEMENT_REJECTED: 'rejected an achievement',
  NEWSLETTER_GENERATED: 'generated a newsletter',
  NEWSLETTER_SCHEDULED: 'scheduled a newsletter',
  NEWSLETTER_PUBLISHED: 'published a newsletter',
  NEWSLETTER_DELETED: 'deleted a newsletter',
  USER_CREATED: 'created a user',
  USER_ACCESS_UPDATED: 'changed a user\'s access',
  USER_DELETED: 'deleted a user',
  DEPARTMENT_CREATED: 'created a department',
  DEPARTMENT_UPDATED: 'edited a department',
  DEPARTMENT_DEACTIVATED: 'deactivated a department',
  DEPARTMENT_REACTIVATED: 'reactivated a department',
  SETTINGS_UPDATED: 'changed institute settings',
}

const FILTER_LABELS = {
  EVENT_APPROVED: 'Event approved',
  EVENT_REJECTED: 'Event rejected',
  PUBLICATION_APPROVED: 'Publication approved',
  PUBLICATION_REJECTED: 'Publication rejected',
  PATENT_APPROVED: 'Patent approved',
  PATENT_REJECTED: 'Patent rejected',
  ACHIEVEMENT_APPROVED: 'Achievement approved',
  ACHIEVEMENT_REJECTED: 'Achievement rejected',
  NEWSLETTER_GENERATED: 'Newsletter generated',
  NEWSLETTER_SCHEDULED: 'Newsletter scheduled',
  NEWSLETTER_PUBLISHED: 'Newsletter published',
  NEWSLETTER_DELETED: 'Newsletter deleted',
  USER_CREATED: 'User created',
  USER_ACCESS_UPDATED: 'User access changed',
  USER_DELETED: 'User deleted',
  DEPARTMENT_CREATED: 'Department created',
  DEPARTMENT_UPDATED: 'Department edited',
  DEPARTMENT_DEACTIVATED: 'Department deactivated',
  DEPARTMENT_REACTIVATED: 'Department reactivated',
  SETTINGS_UPDATED: 'Settings changed',
}

const GOOD = 'bg-[#ECFDF3] text-[#067647]'
const BAD = 'bg-[#FEF3F2] text-[#B42318]'
const WARN = 'bg-[#FBF3E7] text-[#B07C1F]'
const INFO = 'bg-[#EFF4FF] text-[#1B2340]'

const actionStyle = (action = '') => {
  if (/(REJECTED|DELETED|DEACTIVATED)$/.test(action)) return BAD
  if (/(APPROVED|PUBLISHED|REACTIVATED)$/.test(action)) return GOOD
  if (/SCHEDULED$/.test(action)) return WARN
  return INFO
}

const TARGET_TYPES = [
  'Event',
  'Publication',
  'Patent',
  'Achievement',
  'Newsletter',
  'User',
  'Department',
  'Settings',
]

const PAGE_SIZE = 20

const SELECT_CLASS =
  'border border-[#E4E7EC] rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-[#C9962C] min-w-0'

const actorName = (log) =>
  log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'A deleted user'

const targetName = (log) =>
  log.targetLabel || `${log.targetType} …${String(log.targetId || '').slice(-6)}`

// Turns the free-form details into short readable lines.
const detailLines = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return []
  return Object.entries(metadata)
    .filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    })
    .map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }))
}

const toStartIso = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : '')
const toEndIso = (d) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : '')

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

export default function ActivityLogPanel({ open, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [exporting, setExporting] = useState(false)

  const [actors, setActors] = useState([])
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Ignores answers from an older request if filters changed in the meantime.
  const requestRef = useRef(0)

  const buildFilters = useCallback(
    () => ({
      action,
      targetType,
      actor,
      from: toStartIso(from),
      to: toEndIso(to),
    }),
    [action, targetType, actor, from, to]
  )

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestRef.current
    try {
      setLoading(true)
      setError('')
      const response = await auditService.getAll(buildFilters(), 1, PAGE_SIZE)
      if (requestId !== requestRef.current) return
      setLogs(response.data || [])
      setPage(1)
      setTotalPages(response.pagination?.pages || 1)
      setTotal(response.pagination?.total || 0)
      setExpandedId(null)
    } catch (err) {
      if (requestId === requestRef.current) {
        setError(err.response?.data?.message || 'Could not load the activity log.')
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [buildFilters])

  useEffect(() => {
    if (open) loadFirstPage()
  }, [open, loadFirstPage])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    auditService
      .getActors()
      .then((response) => {
        if (!cancelled) setActors(response.data || [])
      })
      .catch(() => {
        // The person filter is optional, so the panel still works without it.
      })
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

  const handleLoadMore = async () => {
    try {
      setLoadingMore(true)
      const response = await auditService.getAll(buildFilters(), page + 1, PAGE_SIZE)
      setLogs((prev) => [...prev, ...(response.data || [])])
      setPage(page + 1)
      setTotalPages(response.pagination?.pages || totalPages)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load more entries.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const response = await auditService.getAll(buildFilters(), 1, 1000)
      const rows = response.data || []
      const header = ['When', 'Action', 'Performed by', 'Item', 'Item type', 'Details']
      const lines = rows.map((log) =>
        [
          formatDateTime(log.createdAt),
          FILTER_LABELS[log.action] || log.action,
          actorName(log),
          log.targetLabel || String(log.targetId || ''),
          log.targetType,
          detailLines(log.metadata)
            .map((d) => `${d.key}: ${d.value}`)
            .join('; '),
        ]
          .map(csvCell)
          .join(',')
      )
      // The leading BOM keeps Excel from garbling non-English letters.
      const csv = `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}`
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `activity_log_${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(
        rows.length >= 1000 ? 'Exported the latest 1000 entries' : `Exported ${rows.length} entries`
      )
    } catch (err) {
      toast.error('Could not export the activity log.')
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setAction('')
    setTargetType('')
    setActor('')
    setFrom('')
    setTo('')
  }

  const hasFilters = action || targetType || actor || from || to

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Activity log">
      <button
        type="button"
        aria-label="Close activity log"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      <div className="relative w-full max-w-[760px] h-full bg-white shadow-2xl flex flex-col animate-[fadeInUp_0.2s_ease-out]">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-[#E4E7EC]">
          <div>
            <h2 className="font-serif font-semibold text-xl text-[#1B2340]">Activity log</h2>
            <p className="text-xs text-[#667085] mt-1">
              A record of approvals, publishing and admin changes. Only Admin can see this.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              title="Download the entries matching these filters as a CSV file"
              className="px-3 py-1.5 rounded-md border border-[#C9962C] text-[#1B2340] text-xs font-medium hover:bg-[#C9962C]/10 disabled:opacity-60"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#667085] hover:bg-[#F5F6F8]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-[#E4E7EC] space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={action} onChange={(e) => setAction(e.target.value)} className={SELECT_CLASS} aria-label="Action">
              <option value="">All actions</option>
              {Object.entries(FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={SELECT_CLASS} aria-label="Item type">
              <option value="">All item types</option>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className={SELECT_CLASS} aria-label="Performed by">
              <option value="">Anyone</option>
              {actors.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.firstName} {a.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold">From</label>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={SELECT_CLASS} />
            <label className="text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold">To</label>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={SELECT_CLASS} />
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="text-xs text-[#C9962C] font-medium hover:underline ml-1">
                Clear filters
              </button>
            )}
            <span className="ml-auto text-xs text-[#98A2B3]">{loading ? '' : `${total} entr${total === 1 ? 'y' : 'ies'}`}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <p className="px-6 py-4 text-sm text-[#B42318]">{error}</p>}

          {loading ? (
            <div className="px-6 py-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3.5 w-2/3 bg-[#F2F4F7] rounded animate-pulse" />
                  <div className="h-2.5 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-[#98A2B3]">
              {hasFilters ? 'No entries match these filters.' : 'Nothing has been recorded yet.'}
            </div>
          ) : (
            <ul className="divide-y divide-[#F2F4F7]">
              {logs.map((log) => {
                const lines = detailLines(log.metadata)
                const isOpen = expandedId === log._id
                return (
                  <li key={log._id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : log._id)}
                      className="w-full text-left px-6 py-3.5 hover:bg-[#F5F6F8] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-[#1B2340] min-w-0">
                          <span className="font-semibold">{actorName(log)}</span>{' '}
                          {ACTION_LABELS[log.action] || log.action}
                          {': '}
                          <span className="font-medium break-words">{targetName(log)}</span>
                        </p>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${actionStyle(log.action)}`}
                        >
                          {log.targetType}
                        </span>
                      </div>
                      <p className="text-xs text-[#98A2B3] mt-1" title={formatDateTime(log.createdAt)}>
                        {formatRelativeTimeCompact(log.createdAt)} &middot; {formatDateTime(log.createdAt)}
                      </p>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-4 -mt-1">
                        {lines.length === 0 ? (
                          <p className="text-xs text-[#98A2B3]">No extra details were recorded.</p>
                        ) : (
                          <dl className="bg-[#F5F6F8] rounded-md px-3 py-2 space-y-1">
                            {lines.map((d) => (
                              <div key={d.key} className="flex gap-2 text-xs">
                                <dt className="text-[#667085] capitalize shrink-0">{d.key}:</dt>
                                <dd className="text-[#1B2340] break-words min-w-0">{d.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {!loading && logs.length > 0 && page < totalPages && (
            <div className="px-6 py-4 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8] disabled:opacity-60"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}